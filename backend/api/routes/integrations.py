"""
Integration routes — /api/integrations/*
Includes ticket sync endpoints.
"""
from flask import Blueprint, request, jsonify
import logging
import traceback

from api.decorators import token_required
from api.shared import (
    auth_service, workspace_service, integration_service,
    team_service, db_manager,
    start_sync_job, cancel_sync_job, is_sync_job_cancelled,
    get_sync_job_status_payload, SyncJobCancelledError,
)
from utils.excel_exporter import export_to_excel_bytes, get_excel_filename

logger = logging.getLogger(__name__)

integrations_bp = Blueprint('integrations', __name__, url_prefix='/api/integrations')


# ── Config CRUD ─────────────────────────────────────────────────────

@integrations_bp.route('/config', methods=['GET'])
@token_required
def get_integration_configs(current_user):
    try:
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)
        configs = integration_service.get_all_configs(
            user_id=user_id if not team_id else None,
            team_id=team_id
        )
        return jsonify({'integrations': configs}), 200
    except Exception as e:
        logger.error(f"Get integration configs error: {e}")
        return jsonify({'error': 'Failed to get integration configs'}), 500


@integrations_bp.route('/config/<integration_type>', methods=['GET'])
@token_required
def get_integration_config(current_user, integration_type):
    try:
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)
        config = integration_service.get_config(
            integration_type=integration_type,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )
        return jsonify(config), 200
    except Exception as e:
        logger.error(f"Get integration config error: {e}")
        return jsonify({'error': 'Failed to get integration config'}), 500


@integrations_bp.route('/config', methods=['POST'])
@token_required
def save_integration_config(current_user):
    try:
        data = request.get_json()
        integration_type = data.get('integration_type')
        if not integration_type:
            return jsonify({'error': 'integration_type is required'}), 400

        credentials = data.get('credentials', {})
        config = data.get('config', {})
        if not credentials:
            return jsonify({'error': 'credentials are required'}), 400

        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        if integration_type == 'zephyr':
            if not config.get('project_key'):
                return jsonify({'error': 'Zephyr project key is required'}), 400
            stored_zephyr = integration_service.get_credentials(
                integration_type='zephyr',
                user_id=user_id if not team_id else None,
                team_id=team_id
            ) or {}
            zephyr_token = (credentials.get('zephyr_token') or stored_zephyr.get('zephyr_token') or '').strip()
            if not zephyr_token:
                return jsonify({'error': 'Zephyr API token not configured. Please configure Zephyr settings.'}), 400

        success, error = integration_service.save_config(
            integration_type=integration_type,
            credentials=credentials,
            config=config,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )
        if error:
            return jsonify({'error': error}), 400
        return jsonify({'message': f'{integration_type} configuration saved successfully'}), 200
    except Exception as e:
        logger.error(f"Save integration config error: {e}")
        return jsonify({'error': 'Failed to save integration config'}), 500


@integrations_bp.route('/config/<integration_type>', methods=['DELETE'])
@token_required
def delete_integration_config(current_user, integration_type):
    try:
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)
        success, error = integration_service.delete_config(
            integration_type=integration_type,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )
        if error:
            return jsonify({'error': error}), 400
        if not success:
            return jsonify({'error': 'Configuration not found'}), 404
        return jsonify({'message': 'Configuration deleted successfully'}), 200
    except Exception as e:
        logger.error(f"Delete integration config error: {e}")
        return jsonify({'error': 'Failed to delete integration config'}), 500


# ── Credentials / connection ────────────────────────────────────────

@integrations_bp.route('/view-credentials/<integration_type>', methods=['POST'])
@token_required
def view_integration_credentials(current_user, integration_type):
    try:
        data = request.get_json() or {}
        password = data.get('password')
        if not password:
            return jsonify({'error': 'Password is required'}), 400

        user_id = current_user['user_id']

        from database.connection import get_db_connection
        from database.auth_models import User

        db = get_db_connection()
        with db.get_session() as session:
            user = session.query(User).filter(User.id == user_id).first()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            if not auth_service.verify_password(password, user.password_hash):
                return jsonify({'error': 'Invalid password'}), 401

        team_id = workspace_service.get_active_workspace(user_id)
        credentials = integration_service.get_credentials(
            integration_type=integration_type,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )
        if not credentials:
            return jsonify({'error': 'Integration not configured'}), 404

        sensitive_data = {}
        if integration_type == 'jira':
            sensitive_data['api_token'] = credentials.get('api_token', '')
        elif integration_type == 'azure_devops':
            sensitive_data['personal_access_token'] = credentials.get('personal_access_token', '')
        elif integration_type == 'testrail':
            sensitive_data['api_key'] = credentials.get('api_key', '')
        else:
            return jsonify({'error': 'Unsupported integration type'}), 400

        response = jsonify({'credentials': sensitive_data})
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        return response, 200
    except Exception as e:
        logger.error(f"View credentials error: {e}")
        return jsonify({'error': 'Failed to view credentials'}), 500


@integrations_bp.route('/test-connection', methods=['POST'])
@token_required
def test_integration_connection(current_user):
    try:
        data = request.get_json()
        integration_type = data.get('integration_type')
        credentials = data.get('credentials', {}) or {}
        config = data.get('config', {}) or {}
        if not integration_type:
            return jsonify({'error': 'integration_type is required'}), 400

        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)
        stored = integration_service.get_credentials(
            integration_type=integration_type,
            user_id=user_id if not team_id else None,
            team_id=team_id
        ) or {}

        if integration_type == 'jira':
            credentials = {'api_token': credentials.get('api_token') or stored.get('api_token')}
            config = {
                'url': config.get('url') or stored.get('url'),
                'email': config.get('email') or stored.get('email'),
            }
        elif integration_type in ('azure_devops', 'ado', 'azure'):
            credentials = {'personal_access_token': credentials.get('personal_access_token') or stored.get('personal_access_token')}
            config = {
                'organization_url': config.get('organization_url') or stored.get('organization_url'),
                'project': config.get('project') or stored.get('project'),
            }
        elif integration_type == 'testrail':
            credentials = {'api_key': credentials.get('api_key') or stored.get('api_key')}
            config = {
                'url': config.get('url') or stored.get('url'),
                'email': config.get('email') or stored.get('email'),
                'project_id': config.get('project_id') or stored.get('project_id'),
            }

        success, message = integration_service.test_connection(
            integration_type=integration_type,
            credentials=credentials,
            config=config
        )
        return jsonify({'success': success, 'message': message}), 200 if success else 400
    except Exception as e:
        logger.error(f"Test connection error: {e}")
        return jsonify({'error': f'Connection test failed: {str(e)}'}), 500


@integrations_bp.route('/fetch-ticket', methods=['POST'])
@token_required
def fetch_integration_ticket(current_user):
    try:
        data = request.get_json()
        integration_type = data.get('integration_type')
        ticket_id = data.get('ticket_id')
        if not integration_type or not ticket_id:
            return jsonify({'error': 'integration_type and ticket_id are required'}), 400

        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)
        ticket_data, error = integration_service.fetch_ticket(
            integration_type=integration_type,
            ticket_id=ticket_id,
            user_id=user_id if not team_id else None,
            team_id=team_id
        )
        if error:
            return jsonify({'error': error}), 400
        return jsonify({'ticket': ticket_data}), 200
    except Exception as e:
        logger.error(f"Fetch ticket error: {e}")
        return jsonify({'error': f'Failed to fetch ticket: {str(e)}'}), 500


# ── Sync endpoints ──────────────────────────────────────────────────

@integrations_bp.route('/sync/attach-excel', methods=['POST'])
@token_required
def sync_attach_excel(current_user):
    try:
        data = request.get_json()
        integration_type = data.get('integration_type')
        ticket_id = data.get('ticket_id')
        generation_id = data.get('generation_id')
        if not all([integration_type, ticket_id, generation_id]):
            return jsonify({'error': 'integration_type, ticket_id, and generation_id are required'}), 400

        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        def attach_excel_job_logic(job_id):
            generation_data = db_manager.get_generation_by_id(generation_id)
            if not generation_data:
                raise Exception('Generation not found')
            generation = generation_data['generation']
            if generation['user_id'] != user_id:
                if generation['team_id'] is not None:
                    if not team_service.is_team_member(user_id, generation['team_id']):
                        raise Exception('Access denied')
                else:
                    raise Exception('Access denied')

            if is_sync_job_cancelled(job_id):
                raise SyncJobCancelledError('Cancelled by user')

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

            if is_sync_job_cancelled(job_id):
                raise SyncJobCancelledError('Cancelled by user')

            success, error = integration_service.attach_excel_to_ticket(
                integration_type=integration_type,
                ticket_id=ticket_id,
                excel_buffer=excel_buffer,
                filename=filename,
                user_id=user_id if not team_id else None,
                team_id=team_id,
                cancel_check=lambda: is_sync_job_cancelled(job_id)
            )
            if error == 'cancelled':
                raise SyncJobCancelledError('Cancelled by user')
            if error:
                raise Exception(error)
            return {'message': f'Excel file attached to {ticket_id} successfully'}

        job_id = start_sync_job(attach_excel_job_logic)
        return jsonify({'job_id': job_id}), 202
    except Exception as e:
        logger.error(f"Sync attach Excel error: {e}")
        return jsonify({'error': f'Failed to attach Excel: {str(e)}'}), 500


@integrations_bp.route('/sync/add-comment', methods=['POST'])
@token_required
def sync_add_comment(current_user):
    try:
        data = request.get_json()
        integration_type = data.get('integration_type')
        ticket_id = data.get('ticket_id')
        generation_id = data.get('generation_id')
        comment_text_override = data.get('comment')
        if not all([integration_type, ticket_id, generation_id]):
            return jsonify({'error': 'integration_type, ticket_id, and generation_id are required'}), 400

        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        def add_comment_job_logic(job_id):
            generation_data = db_manager.get_generation_by_id(generation_id)
            if not generation_data:
                raise Exception('Generation not found')
            generation = generation_data['generation']
            if generation['user_id'] != user_id:
                if generation['team_id'] is not None:
                    if not team_service.is_team_member(user_id, generation['team_id']):
                        raise Exception('Access denied')
                else:
                    raise Exception('Access denied')

            if is_sync_job_cancelled(job_id):
                raise SyncJobCancelledError('Cancelled by user')

            comment_text = comment_text_override
            if not comment_text:
                test_cases = generation_data.get('test_cases', [])
                coverage_gaps = generation_data.get('coverage_gaps', [])
                risk_areas = generation_data.get('risk_areas', [])

                priority_counts = {}
                for tc in test_cases:
                    p = tc.get('priority', 'P2')
                    priority_counts[p] = priority_counts.get(p, 0) + 1

                category_counts = {}
                for tc in test_cases:
                    c = tc.get('category', 'General')
                    category_counts[c] = category_counts.get(c, 0) + 1

                if integration_type == 'jira':
                    comment_text = f"h3. \U0001f9ea Test Cases Generated by QA Copilot\n\n"
                    comment_text += f"*Total Test Cases:* {len(test_cases)}\n"
                    comment_text += f"*Coverage Gaps:* {len(coverage_gaps)}\n"
                    comment_text += f"*Risk Areas:* {len(risk_areas)}\n\n"
                    if priority_counts:
                        comment_text += "h4. Priority Distribution\n||Priority||Count||\n"
                        for p in sorted(priority_counts.keys()):
                            comment_text += f"|{p}|{priority_counts[p]}|\n"
                        comment_text += "\n"
                    if category_counts:
                        comment_text += "h4. Test Categories\n||Category||Count||\n"
                        for c in sorted(category_counts.keys()):
                            comment_text += f"|{c}|{category_counts[c]}|\n"
                        comment_text += "\n"
                    if test_cases:
                        comment_text += "h4. Test Case Summary\n||ID||Priority||Category||Title||\n"
                        for tc in test_cases[:20]:
                            tc_id = tc.get('id', tc.get('title', '')[:8])
                            comment_text += f"|{tc_id}|{tc.get('priority', 'P2')}|{tc.get('category', '')}|{tc.get('title', '')}|\n"
                        if len(test_cases) > 20:
                            comment_text += f"\n_...and {len(test_cases) - 20} more test cases._\n"
                    if coverage_gaps:
                        comment_text += "\nh4. Coverage Gaps\n"
                        for gap in coverage_gaps[:10]:
                            comment_text += f"* {gap}\n"
                    if risk_areas:
                        comment_text += "\nh4. Risk Areas\n"
                        for risk in risk_areas[:10]:
                            comment_text += f"* (!)\u00a0{risk}\n"
                    comment_text += f"\n----\n_Generated on {generation.get('timestamp', 'N/A')} by QA Copilot_"
                else:
                    comment_text = f"<h3>\U0001f9ea Test Cases Generated by QA Copilot</h3>"
                    comment_text += f"<p><strong>Total Test Cases:</strong> {len(test_cases)}<br>"
                    comment_text += f"<strong>Coverage Gaps:</strong> {len(coverage_gaps)}<br>"
                    comment_text += f"<strong>Risk Areas:</strong> {len(risk_areas)}</p>"
                    if priority_counts:
                        comment_text += "<h4>Priority Distribution</h4><table><tr><th>Priority</th><th>Count</th></tr>"
                        for p in sorted(priority_counts.keys()):
                            comment_text += f"<tr><td>{p}</td><td>{priority_counts[p]}</td></tr>"
                        comment_text += "</table>"
                    if category_counts:
                        comment_text += "<h4>Test Categories</h4><table><tr><th>Category</th><th>Count</th></tr>"
                        for c in sorted(category_counts.keys()):
                            comment_text += f"<tr><td>{c}</td><td>{category_counts[c]}</td></tr>"
                        comment_text += "</table>"
                    if test_cases:
                        comment_text += "<h4>Test Case Summary</h4><table><tr><th>ID</th><th>Priority</th><th>Category</th><th>Title</th></tr>"
                        for tc in test_cases[:20]:
                            tc_id = tc.get('id', tc.get('title', '')[:8])
                            comment_text += f"<tr><td>{tc_id}</td><td>{tc.get('priority', 'P2')}</td><td>{tc.get('category', '')}</td><td>{tc.get('title', '')}</td></tr>"
                        comment_text += "</table>"
                        if len(test_cases) > 20:
                            comment_text += f"<p><em>...and {len(test_cases) - 20} more. See attached Excel for full details.</em></p>"
                    if coverage_gaps:
                        comment_text += "<h4>Coverage Gaps</h4><ul>"
                        for gap in coverage_gaps[:10]:
                            comment_text += f"<li>{gap}</li>"
                        comment_text += "</ul>"
                    if risk_areas:
                        comment_text += "<h4>Risk Areas</h4><ul>"
                        for risk in risk_areas[:10]:
                            comment_text += f"<li>\u26a0\ufe0f {risk}</li>"
                        comment_text += "</ul>"
                    comment_text += f"<hr><p><em>Generated on {generation.get('timestamp', 'N/A')} by QA Copilot</em></p>"

            if is_sync_job_cancelled(job_id):
                raise SyncJobCancelledError('Cancelled by user')

            success, error = integration_service.post_comment_to_ticket(
                integration_type=integration_type,
                ticket_id=ticket_id,
                comment=comment_text,
                user_id=user_id if not team_id else None,
                team_id=team_id,
                cancel_check=lambda: is_sync_job_cancelled(job_id)
            )
            if error == 'cancelled':
                raise SyncJobCancelledError('Cancelled by user')
            if error:
                raise Exception(error)
            return {'message': f'Comment added to {ticket_id} successfully'}

        job_id = start_sync_job(add_comment_job_logic)
        return jsonify({'job_id': job_id}), 202
    except Exception as e:
        logger.error(f"Sync add comment error: {e}")
        return jsonify({'error': f'Failed to add comment: {str(e)}'}), 500


@integrations_bp.route('/sync/full-sync', methods=['POST'])
@token_required
def sync_full_job(current_user):
    data = request.get_json()
    integration_type = data.get('integration_type')
    ticket_id = data.get('ticket_id')
    generation_id = data.get('generation_id')
    if not all([integration_type, ticket_id, generation_id]):
        return jsonify({'error': 'integration_type, ticket_id, and generation_id are required'}), 400

    user_id = current_user['user_id']
    team_id = workspace_service.get_active_workspace(user_id)

    def sync_full_job_logic(job_id):
        results = {'attach_excel': False, 'add_comment': False, 'errors': []}
        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            raise Exception('Generation not found')
        generation = generation_data['generation']
        if generation['user_id'] != user_id:
            if generation['team_id'] is not None:
                if not team_service.is_team_member(user_id, generation['team_id']):
                    raise Exception('Access denied')
            else:
                raise Exception('Access denied')

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

        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Sync cancelled by user')

        excel_buffer = export_to_excel_bytes(state)
        filename = get_excel_filename(state)

        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Sync cancelled by user')

        success, error = integration_service.attach_excel_to_ticket(
            integration_type=integration_type,
            ticket_id=ticket_id,
            excel_buffer=excel_buffer,
            filename=filename,
            user_id=user_id if not team_id else None,
            team_id=team_id,
            cancel_check=lambda: is_sync_job_cancelled(job_id)
        )
        if error == 'cancelled':
            raise SyncJobCancelledError('Sync cancelled by user')
        results['attach_excel'] = success
        if error:
            results['errors'].append(f"Attach Excel: {error}")

        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Sync cancelled by user')

        test_cases = generation_data.get('test_cases', [])
        total = len(test_cases)
        gaps = len(generation_data.get('coverage_gaps', []))
        risks = len(generation_data.get('risk_areas', []))
        if integration_type == 'jira':
            comment = f"h3. \U0001f9ea QA Copilot - Test Generation Complete\n\n"
            comment += f"*{total}* test cases generated | *{gaps}* coverage gaps | *{risks}* risk areas\n\n"
            comment += f"_Full test case Excel report has been attached to this ticket._\n"
            comment += f"----\n_Generated on {generation.get('timestamp', 'N/A')}_"
        else:
            comment = f"<h3>\U0001f9ea QA Copilot - Test Generation Complete</h3>"
            comment += f"<p><strong>{total}</strong> test cases generated | <strong>{gaps}</strong> coverage gaps | <strong>{risks}</strong> risk areas</p>"
            comment += f"<p><em>Full test case Excel report has been attached to this ticket.</em></p>"
            comment += f"<hr><p><em>Generated on {generation.get('timestamp', 'N/A')}</em></p>"

        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Sync cancelled by user')

        success2, error2 = integration_service.post_comment_to_ticket(
            integration_type=integration_type,
            ticket_id=ticket_id,
            comment=comment,
            user_id=user_id if not team_id else None,
            team_id=team_id,
            cancel_check=lambda: is_sync_job_cancelled(job_id)
        )
        if error2 == 'cancelled':
            raise SyncJobCancelledError('Sync cancelled by user')
        results['add_comment'] = success2
        if error2:
            results['errors'].append(f"Add comment: {error2}")
        return results

    job_id = start_sync_job(sync_full_job_logic)
    return jsonify({'job_id': job_id}), 202


# ── Job status / cancel ─────────────────────────────────────────────

@integrations_bp.route('/sync/job-status/<job_id>', methods=['GET'])
@token_required
def sync_job_status(current_user, job_id):
    payload, status_code = get_sync_job_status_payload(job_id)
    return jsonify(payload), status_code


@integrations_bp.route('/sync/cancel/<job_id>', methods=['POST'])
@token_required
def cancel_sync_job_endpoint(current_user, job_id):
    if cancel_sync_job(job_id):
        return jsonify({'message': 'Sync/export job cancelled'}), 200
    return jsonify({'error': 'Job not found'}), 404
