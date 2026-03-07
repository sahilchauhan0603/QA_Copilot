"""
Test generation routes — /api/test-generation/*
"""
from flask import Blueprint, request, jsonify, send_file, Response
import logging
import os
import json
import time
import threading
import uuid as uuid_lib
import traceback
from datetime import datetime

import google.generativeai as genai

from api.decorators import token_required
from api.shared import (
    auth_service, team_service, workspace_service, db_manager,
    get_orchestrator, analyze_screenshots, extract_file_contents,
    AGENT_STEPS, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, MAX_IMAGES,
    MAX_FILE_SIZE, MAX_FILES, ALLOWED_FILE_EXTENSIONS,
    get_progress_store, get_progress_lock, _update_progress,
    start_refine_job, cancel_refine_job, is_refine_job_cancelled,
    get_refine_job_status_payload, RefineJobCancelledError,
)
from agents.refine_agent import RefineAgent
from agents.state import TicketInfo
from utils.rate_limiter import get_rate_limiter
from utils.api_cache import get_api_cache
from utils.excel_exporter import export_to_excel_bytes, get_excel_filename

logger = logging.getLogger(__name__)

generation_bp = Blueprint('generation', __name__, url_prefix='/api/test-generation')


# ── SSE Progress ────────────────────────────────────────────────────

@generation_bp.route('/progress/<job_id>', methods=['GET'])
def stream_progress(job_id):
    _progress_store = get_progress_store()
    _progress_lock = get_progress_lock()

    def generate():
        last_step_count = 0
        timeout = 300
        start = time.time()

        while time.time() - start < timeout:
            with _progress_lock:
                store = _progress_store.get(job_id)

            if not store:
                yield f"data: {json.dumps({'type': 'waiting', 'message': 'Initializing...'})}\n\n"
                time.sleep(0.5)
                continue

            current_steps = store["steps"]
            if len(current_steps) > last_step_count:
                for step in current_steps[last_step_count:]:
                    completed = len([s for s in current_steps if s["status"] == "completed"])
                    total = len(AGENT_STEPS)
                    progress_pct = int((completed / total) * 100)

                    label = step["agent"]
                    for a in AGENT_STEPS:
                        if a["agent"] == step["agent"]:
                            label = a["label"]
                            break

                    yield f"data: {json.dumps({'type': 'step', 'agent': step['agent'], 'label': label, 'status': step['status'], 'progress': progress_pct, 'detail': step.get('detail')})}\n\n"

                last_step_count = len(current_steps)

            if store.get("cancelled"):
                yield f"data: {json.dumps({'type': 'cancelled', 'message': 'Generation cancelled by user'})}\n\n"
                break

            if store["status"] in ("completed", "error"):
                if store["status"] == "completed":
                    yield f"data: {json.dumps({'type': 'complete', 'progress': 100, 'result': store['result']})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'error', 'message': store['error']})}\n\n"
                with _progress_lock:
                    _progress_store.pop(job_id, None)
                break

            time.sleep(0.3)

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return Response(
        generate(), mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive'}
    )


@generation_bp.route('/cancel/<job_id>', methods=['POST'])
@token_required
def cancel_generation(current_user, job_id):
    try:
        _progress_store = get_progress_store()
        _progress_lock = get_progress_lock()
        with _progress_lock:
            store = _progress_store.get(job_id)
            if not store:
                return jsonify({'error': 'Job not found or already completed'}), 404
            if store["status"] in ("completed", "error"):
                return jsonify({'error': 'Job already finished'}), 400
            store["cancelled"] = True
            store["status"] = "cancelled"
            store["error"] = "Cancelled by user"
        return jsonify({'message': 'Generation cancelled successfully'}), 200
    except Exception as e:
        logger.error(f"Cancel generation error: {e}")
        return jsonify({'error': 'Failed to cancel generation'}), 500


# ── Generate ────────────────────────────────────────────────────────

@generation_bp.route('/generate', methods=['POST'])
@token_required
def generate_tests(current_user):
    try:
        uploaded_images = []
        uploaded_code_files = []
        content_type = request.content_type or ''

        if 'multipart/form-data' in content_type:
            ticket_data_str = request.form.get('ticket_data', '{}')
            try:
                data = json.loads(ticket_data_str)
            except json.JSONDecodeError:
                return jsonify({'error': 'Invalid ticket_data JSON in form'}), 400

            raw_files = request.files.getlist('screenshots')
            for f in raw_files:
                if f and f.filename:
                    if f.content_type not in ALLOWED_IMAGE_TYPES:
                        return jsonify({'error': f'Invalid image type: {f.content_type}. Allowed: PNG, JPEG, JPG'}), 400
                    f.seek(0, 2)
                    size = f.tell()
                    f.seek(0)
                    if size > MAX_IMAGE_SIZE:
                        return jsonify({'error': f'Image {f.filename} exceeds 5MB limit'}), 400
                    uploaded_images.append(f)
            if len(uploaded_images) > MAX_IMAGES:
                return jsonify({'error': f'Maximum {MAX_IMAGES} images allowed'}), 400

            # --- Code / config file attachments ---
            uploaded_code_files = []
            raw_code_files = request.files.getlist('code_files')
            for f in raw_code_files:
                if f and f.filename:
                    ext = os.path.splitext(f.filename)[1].lower()
                    if ext not in ALLOWED_FILE_EXTENSIONS:
                        return jsonify({'error': f'Unsupported file type: {ext}. Allowed: {" ".join(sorted(ALLOWED_FILE_EXTENSIONS))}'}), 400
                    f.seek(0, 2)
                    size = f.tell()
                    f.seek(0)
                    if size > MAX_FILE_SIZE:
                        return jsonify({'error': f'File {f.filename} exceeds 500 KB limit'}), 400
                    uploaded_code_files.append(f)
            if len(uploaded_code_files) > MAX_FILES:
                return jsonify({'error': f'Maximum {MAX_FILES} code files allowed'}), 400
        else:
            data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400
        if not all(field in data and data[field] for field in ['title']):
            return jsonify({'error': 'Missing required field: title'}), 400

        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        image_analysis = ''
        screenshot_count = len(uploaded_images)
        if uploaded_images:
            logger.info(f"Analyzing {screenshot_count} screenshot(s) with Gemini multimodal...")
            image_analysis = analyze_screenshots(uploaded_images)
            logger.info(f"Image analysis completed ({len(image_analysis)} chars)")

        file_analysis = ''
        if uploaded_code_files:
            logger.info(f"Extracting content from {len(uploaded_code_files)} code file(s)...")
            file_analysis = extract_file_contents(uploaded_code_files)
            logger.info(f"File extraction completed ({len(file_analysis)} chars)")

        ticket_info = TicketInfo(
            ticket_id=data.get('ticket_id', ''),
            title=data['title'],
            description=data.get('description', ''),
            acceptance_criteria=data.get('acceptance_criteria', []),
            ticket_type=data.get('ticket_type', 'story'),
            priority=data.get('priority', 'P2'),
            status=data.get('status', 'In Progress'),
            attachments=data.get('attachments', []),
            comments=data.get('comments', []),
            linked_tickets=data.get('linked_tickets', []),
            image_analysis=image_analysis,
            file_analysis=file_analysis
        )

        source_integration = data.get('integration_type')
        job_id = str(uuid_lib.uuid4())

        _progress_store = get_progress_store()
        _progress_lock = get_progress_lock()

        with _progress_lock:
            _progress_store[job_id] = {
                "status": "running", "steps": [], "current_agent": None,
                "error": None, "result": None, "cancelled": False,
            }

        def run_generation():
            try:
                with _progress_lock:
                    if _progress_store.get(job_id, {}).get("cancelled"):
                        raise Exception("Generation cancelled by user")

                orch = get_orchestrator()

                def progress_callback(agent_name, state):
                    with _progress_lock:
                        if _progress_store.get(job_id, {}).get("cancelled"):
                            raise Exception("Generation cancelled by user")
                    _update_progress(job_id, agent_name, "completed",
                                     detail=f"Processed by {agent_name}")

                _update_progress(job_id, "ticket_reader", "started", detail="Starting pipeline...")
                final_state = orch.process_ticket(ticket_info, progress_callback=progress_callback)

                with _progress_lock:
                    if _progress_store.get(job_id, {}).get("cancelled"):
                        raise Exception("Generation cancelled by user")

                if source_integration:
                    final_state['source_integration'] = source_integration
                if screenshot_count > 0:
                    final_state['screenshot_count'] = screenshot_count

                generation_id = db_manager.save_generation(
                    state=final_state, user_id=user_id,
                    team_id=team_id, excel_file_path=None
                )
                generation_data = db_manager.get_generation_by_id(generation_id)

                with _progress_lock:
                    store = _progress_store.get(job_id)
                    if store:
                        store["status"] = "completed"
                        store["result"] = {
                            'message': 'Test cases generated successfully',
                            'generation_id': generation_id,
                            'total_test_cases': len(final_state.get('test_cases', [])),
                            'coverage_gaps': len(final_state.get('coverage_gaps', [])),
                            'generation': generation_data
                        }
            except Exception as e:
                logger.error(f"Test generation error: {e}")
                logger.error(traceback.format_exc())
                with _progress_lock:
                    store = _progress_store.get(job_id)
                    if store:
                        if store.get("cancelled") or "cancelled" in str(e).lower():
                            store["status"] = "cancelled"
                        else:
                            store["status"] = "error"
                            store["error"] = str(e)
                    _progress_store.pop(job_id, None)

        thread = threading.Thread(target=run_generation, daemon=True)
        thread.start()

        return jsonify({
            'job_id': job_id,
            'message': 'Generation started. Use SSE endpoint to track progress.',
            'progress_url': f'/api/test-generation/progress/{job_id}'
        }), 202

    except ValueError as ve:
        logger.error(f"Configuration error: {ve}")
        return jsonify({'error': str(ve)}), 500
    except Exception as e:
        logger.error(f"Test generation error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Test generation failed: {str(e)}'}), 500


# ── CRUD ────────────────────────────────────────────────────────────

@generation_bp.route('/generations', methods=['GET'])
@token_required
def get_generations(current_user):
    try:
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        limit = request.args.get('limit', 100, type=int)
        page = request.args.get('page', 1, type=int)
        if page < 1: page = 1
        if limit < 1: limit = 1
        if limit > 100: limit = 100
        offset = (page - 1) * limit
        ticket_id = request.args.get('ticket_id')
        ticket_type = request.args.get('ticket_type')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')

        if any([ticket_id, ticket_type, date_from, date_to]):
            generations = db_manager.search_generations(
                user_id=user_id, team_id=team_id, ticket_id=ticket_id,
                ticket_type=ticket_type, date_from=date_from, date_to=date_to,
                limit=limit, offset=offset
            )
        else:
            generations = db_manager.get_all_generations(
                user_id=user_id, team_id=team_id, limit=limit, offset=offset
            )

        total = db_manager.count_generations(
            user_id=user_id, team_id=team_id, ticket_id=ticket_id,
            ticket_type=ticket_type, date_from=date_from, date_to=date_to
        )
        total_pages = max(1, (total + limit - 1) // limit)
        return jsonify({
            'generations': generations,
            'pagination': {'page': page, 'limit': limit, 'total': total, 'total_pages': total_pages}
        }), 200
    except Exception as e:
        logger.error(f"Get generations error: {e}")
        return jsonify({'error': 'Failed to get generations'}), 500


@generation_bp.route('/generations/<generation_id>', methods=['GET'])
@token_required
def get_generation(current_user, generation_id):
    try:
        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404

        generation = generation_data['generation']
        if generation['user_id'] != current_user['user_id']:
            if generation['team_id'] is not None:
                if not team_service.is_team_member(current_user['user_id'], generation['team_id']):
                    return jsonify({'error': 'Access denied'}), 403
            else:
                return jsonify({'error': 'Access denied'}), 403

        return jsonify(generation_data), 200
    except Exception as e:
        logger.error(f"Get generation error: {e}")
        return jsonify({'error': 'Failed to get generation'}), 500


@generation_bp.route('/generations/<generation_id>', methods=['DELETE'])
@token_required
def delete_generation(current_user, generation_id):
    try:
        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404

        generation = generation_data['generation']
        if generation['user_id'] != current_user['user_id']:
            if generation['team_id'] is not None:
                if not team_service.is_team_admin(current_user['user_id'], generation['team_id']):
                    return jsonify({'error': 'Access denied: Only the owner or team admin can delete'}), 403
            else:
                return jsonify({'error': 'Access denied'}), 403

        success = db_manager.delete_generation(generation_id)
        if success:
            return jsonify({'message': 'Generation deleted successfully'}), 200
        return jsonify({'error': 'Failed to delete generation'}), 500
    except Exception as e:
        logger.error(f"Delete generation error: {e}")
        return jsonify({'error': 'Failed to delete generation'}), 500


@generation_bp.route('/statistics', methods=['GET'])
@token_required
def get_test_statistics(current_user):
    try:
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)
        stats = db_manager.get_statistics(user_id=user_id, team_id=team_id)
        return jsonify(stats), 200
    except Exception as e:
        logger.error(f"Get statistics error: {e}")
        return jsonify({'error': 'Failed to get statistics'}), 500


@generation_bp.route('/download/<generation_id>', methods=['GET'])
@token_required
def download_excel(current_user, generation_id):
    try:
        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404

        generation = generation_data['generation']
        if generation['user_id'] != current_user['user_id']:
            if generation['team_id'] is not None:
                if not team_service.is_team_member(current_user['user_id'], generation['team_id']):
                    return jsonify({'error': 'Access denied'}), 403
            else:
                return jsonify({'error': 'Access denied'}), 403

        meta = generation.get('metadata', {}) or {}
        state = {
            'ticket_info': {
                'ticket_id': generation['ticket_id'],
                'title': generation['ticket_title'],
                'ticket_type': generation['ticket_type'],
                'description': generation.get('ticket_description', ''),
                'acceptance_criteria': generation.get('ticket_acceptance_criteria', ''),
                'priority': meta.get('priority', 'N/A'),
                'status': meta.get('status', 'N/A'),
            },
            'test_cases': generation_data.get('test_cases', []),
            'coverage_gaps': generation_data.get('coverage_gaps', []),
            'qa_roadmap': generation_data.get('qa_roadmap', {}),
            'extracted_requirements': generation_data.get('extracted_requirements', []),
            'acceptance_criteria_gaps': generation_data.get('acceptance_criteria_gaps', []),
            'risk_areas': generation_data.get('risk_areas', []),
            'clarification_questions': generation_data.get('clarification_questions', []),
            'impacted_modules': generation_data.get('impacted_modules', []),
            'dependencies': generation_data.get('dependencies', []),
            'processing_time': meta.get('processing_time', 0),
        }

        excel_buffer = export_to_excel_bytes(state)
        filename = get_excel_filename(state)

        response = send_file(
            excel_buffer, as_attachment=True, download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    except Exception as e:
        logger.error(f"Download Excel error: {e}")
        return jsonify({'error': 'Failed to download file'}), 500


# ── Refine ──────────────────────────────────────────────────────────

@generation_bp.route('/refine', methods=['POST'])
@token_required
def refine_tests(current_user):
    try:
        data = request.get_json()
        generation_id = data.get('generation_id')
        refinement_type = data.get('refinement_type')
        if not generation_id or not refinement_type:
            return jsonify({'error': 'generation_id and refinement_type are required'}), 400

        valid_types = ['minimize', 'focus', 'edge_cases', 'coverage', 'simplify', 'regenerate']
        if refinement_type not in valid_types:
            return jsonify({'error': f'Invalid refinement_type. Must be one of: {", ".join(valid_types)}'}), 400

        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404

        generation = generation_data['generation']
        if generation['user_id'] != current_user['user_id']:
            if generation['team_id'] is not None:
                if not team_service.is_team_member(current_user['user_id'], generation['team_id']):
                    return jsonify({'error': 'Access denied'}), 403
            else:
                return jsonify({'error': 'Access denied'}), 403

        # ── Regenerate entire ──
        if refinement_type == 'regenerate':
            meta = generation.get('metadata', {}) or {}
            source_integration = generation_data.get('source_integration') or meta.get('source_integration')
            ticket_info = TicketInfo(
                ticket_id=generation['ticket_id'],
                title=generation['ticket_title'],
                description=generation.get('ticket_description', ''),
                acceptance_criteria=generation.get('ticket_acceptance_criteria', ''),
                ticket_type=generation['ticket_type'],
                priority=meta.get('priority', 'P2'),
                status=meta.get('status', 'In Progress'),
                attachments=meta.get('attachments', []),
                comments=meta.get('comments', []),
                linked_tickets=meta.get('linked_tickets', [])
            )

            job_id = str(uuid_lib.uuid4())
            _progress_store = get_progress_store()
            _progress_lock = get_progress_lock()

            with _progress_lock:
                _progress_store[job_id] = {
                    "status": "running", "steps": [], "current_agent": None,
                    "error": None, "result": None, "cancelled": False,
                }

            def run_regeneration():
                try:
                    with _progress_lock:
                        if _progress_store.get(job_id, {}).get("cancelled"):
                            raise Exception("Regeneration cancelled by user")

                    orch = get_orchestrator()
                    _update_progress(job_id, "ticket_reader", "started", detail="Regenerating...")
                    final_state = orch.process_ticket(ticket_info)

                    if source_integration:
                        final_state['source_integration'] = source_integration
                    if 'refinement' not in final_state:
                        final_state['refinement'] = {}
                    final_state['refinement']['is_refined'] = True
                    final_state['refinement']['original_generation_id'] = generation_id
                    final_state['refinement']['refinement_type'] = 'regenerate'

                    new_generation_id = db_manager.save_generation(
                        state=final_state, user_id=current_user['user_id'],
                        team_id=generation['team_id'], excel_file_path=None
                    )
                    new_generation_data = db_manager.get_generation_by_id(new_generation_id)

                    with _progress_lock:
                        store = _progress_store.get(job_id)
                        if store:
                            store["status"] = "completed"
                            store["result"] = {
                                'message': 'Test cases regenerated successfully',
                                'generation_id': new_generation_id,
                                'total_test_cases': len(final_state.get('test_cases', [])),
                                'generation': new_generation_data
                            }
                except Exception as e:
                    logger.error(f"Regeneration error: {e}")
                    logger.error(traceback.format_exc())
                    with _progress_lock:
                        store = _progress_store.get(job_id)
                        if store:
                            store["status"] = "error"
                            store["error"] = str(e)

            thread = threading.Thread(target=run_regeneration, daemon=True)
            thread.start()

            return jsonify({
                'job_id': job_id,
                'message': 'Regeneration started. Use SSE endpoint to track progress.',
                'progress_url': f'/api/test-generation/progress/{job_id}'
            }), 202

        # ── Other refinement types via RefineAgent ──
        else:
            meta = generation.get('metadata', {}) or {}
            source_integration = generation_data.get('source_integration') or meta.get('source_integration')
            state = {
                'ticket_info': {
                    'ticket_id': generation['ticket_id'],
                    'title': generation['ticket_title'],
                    'description': generation.get('ticket_description', ''),
                    'acceptance_criteria': generation.get('ticket_acceptance_criteria', ''),
                    'ticket_type': generation['ticket_type'],
                    'priority': meta.get('priority', 'P2'),
                },
                'test_cases': generation_data.get('test_cases', []),
                'coverage_gaps': generation_data.get('coverage_gaps', []),
                'qa_roadmap': generation_data.get('qa_roadmap', {}),
                'source_integration': source_integration,
            }

            refinement_context = {}
            if refinement_type == 'focus':
                focus_area = data.get('focus_area', '')
                if not focus_area:
                    return jsonify({'error': 'focus_area is required for focus refinement'}), 400
                refinement_context['focus_area'] = focus_area

            google_api_key = os.getenv('GOOGLE_API_KEY')
            if not google_api_key:
                return jsonify({'error': 'AI service not configured'}), 500

            def run_refinement_job(job_id):
                if is_refine_job_cancelled(job_id):
                    raise RefineJobCancelledError("Refinement cancelled by user")

                genai.configure(api_key=google_api_key)
                rate_limiter = get_rate_limiter(max_requests=15, time_window=60)
                api_cache = get_api_cache(ttl=3600)
                refine_agent = RefineAgent(genai, rate_limiter, api_cache)

                logger.info(f"Refining generation {generation_id} with type: {refinement_type}")
                refined_state = refine_agent.refine(state, refinement_type, refinement_context)

                if is_refine_job_cancelled(job_id):
                    raise RefineJobCancelledError("Refinement cancelled by user")

                if state.get('source_integration'):
                    refined_state['source_integration'] = state['source_integration']
                if 'refinement' not in refined_state:
                    refined_state['refinement'] = {}
                refined_state['refinement']['is_refined'] = True
                refined_state['refinement']['original_generation_id'] = generation_id
                refined_state['refinement']['refinement_type'] = refinement_type

                new_generation_id = db_manager.save_generation(
                    state=refined_state, user_id=current_user['user_id'],
                    team_id=generation['team_id'], excel_file_path=None
                )
                new_generation_data = db_manager.get_generation_by_id(new_generation_id)

                return {
                    'message': f'Test cases refined successfully ({refinement_type})',
                    'generation_id': new_generation_id,
                    'original_generation_id': generation_id,
                    'refinement_type': refinement_type,
                    'total_test_cases': len(refined_state.get('test_cases', [])),
                    'generation': new_generation_data
                }

            job_id = start_refine_job(current_user['user_id'], run_refinement_job)
            return jsonify({'job_id': job_id, 'message': 'Refinement started'}), 202

    except ValueError as ve:
        logger.error(f"Configuration error: {ve}")
        return jsonify({'error': str(ve)}), 500
    except Exception as e:
        logger.error(f"Refinement error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Refinement failed: {str(e)}'}), 500


@generation_bp.route('/refine/job-status/<job_id>', methods=['GET'])
@token_required
def refine_job_status(current_user, job_id):
    payload, status_code = get_refine_job_status_payload(current_user['user_id'], job_id)
    return jsonify(payload), status_code


@generation_bp.route('/refine/cancel/<job_id>', methods=['POST'])
@token_required
def cancel_refine_job_endpoint(current_user, job_id):
    payload, status_code = get_refine_job_status_payload(current_user['user_id'], job_id)
    if status_code != 200:
        return jsonify(payload), status_code
    if payload.get('status') in ('completed', 'error', 'cancelled'):
        return jsonify({'error': 'Job already finished'}), 400
    if cancel_refine_job(job_id):
        return jsonify({'message': 'Refinement job cancelled'}), 200
    return jsonify({'error': 'Job not found'}), 404


# ── AI describe ─────────────────────────────────────────────────────

@generation_bp.route('/ai-describe', methods=['POST'])
@token_required
def ai_generate_description(current_user):
    try:
        data = request.get_json()
        title = data.get('title', '').strip()
        ticket_type = data.get('ticket_type', 'story')
        priority = data.get('priority', 'P2')
        if not title:
            return jsonify({'error': 'Title is required'}), 400

        google_api_key = os.getenv('GOOGLE_API_KEY')
        if not google_api_key:
            return jsonify({'error': 'AI service not configured'}), 500

        genai.configure(api_key=google_api_key)
        model = genai.GenerativeModel(os.getenv('LLM_MODEL', 'gemini-2.0-flash'))

        prompt = f"""You are a senior QA engineer and business analyst. Given the following ticket information, generate a detailed description and acceptance criteria.

Ticket Title: {title}
Ticket Type: {ticket_type}
Priority: {priority}

Generate:
1. A detailed description (2-4 paragraphs) explaining what this ticket involves, the business context, user impact, and technical considerations.
2. A list of 4-8 specific, testable acceptance criteria.

Respond in this exact JSON format:
{{
    "description": "The detailed description text here...",
    "acceptance_criteria": [
        "First acceptance criterion",
        "Second acceptance criterion",
        "Third acceptance criterion"
    ]
}}

Only return valid JSON, no markdown code blocks or extra text."""

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4, response_mime_type="application/json"
            )
        )

        import json as json_mod
        result = json_mod.loads(response.text)
        return jsonify({
            'description': result.get('description', ''),
            'acceptance_criteria': result.get('acceptance_criteria', [])
        }), 200

    except json.JSONDecodeError:
        try:
            text = response.text.strip()
            if text.startswith('```'):
                text = text.split('\n', 1)[1].rsplit('```', 1)[0].strip()
            result = json.loads(text)
            return jsonify({
                'description': result.get('description', ''),
                'acceptance_criteria': result.get('acceptance_criteria', [])
            }), 200
        except Exception:
            return jsonify({'error': 'Failed to parse AI response'}), 500
    except Exception as e:
        logger.error(f"AI description generation error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'AI generation failed: {str(e)}'}), 500
