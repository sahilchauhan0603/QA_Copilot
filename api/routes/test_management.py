"""
Test management export routes — /api/test-management/*
Xray, Zephyr Scale, TestRail exports (sync & async).
"""
from flask import Blueprint, request, jsonify
import logging
import traceback

from api.decorators import token_required, workspace_aware
from api.shared import (
    db_manager,
    start_sync_job, cancel_sync_job, is_sync_job_cancelled,
    get_sync_job_status_payload, SyncJobCancelledError,
)
from services.test_management_service import TestManagementService

logger = logging.getLogger(__name__)

test_management_bp = Blueprint('test_management', __name__, url_prefix='/api/test-management')


# ── Xray ────────────────────────────────────────────────────────────

@test_management_bp.route('/export-xray', methods=['POST'])
@token_required
@workspace_aware
def export_to_xray(current_user, active_team_id, is_personal_workspace):
    try:
        data = request.get_json()
        generation_id = data.get('generation_id')
        suite_name = data.get('suite_name')
        ticket_id = data.get('ticket_id')
        if not generation_id:
            return jsonify({'error': 'generation_id is required'}), 400

        user_id = current_user['user_id']
        team_id = active_team_id

        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404

        test_cases = generation_data.get('test_cases', [])
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_xray(
            test_cases=test_cases, user_id=user_id, team_id=team_id,
            suite_name=suite_name, ticket_id=ticket_id
        )

        if export_result['success']:
            return jsonify({'message': 'Successfully exported to Xray', 'result': export_result}), 200
        return jsonify({'error': export_result.get('error', 'Export to Xray failed'), 'result': export_result}), 400
    except Exception as e:
        logger.error(f"Xray export error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': 'Failed to export to Xray. Please try again.'}), 500


@test_management_bp.route('/export-xray-job', methods=['POST'])
@token_required
@workspace_aware
def export_to_xray_job(current_user, active_team_id, is_personal_workspace):
    data = request.get_json()
    generation_id = data.get('generation_id')
    suite_name = data.get('suite_name')
    ticket_id = data.get('ticket_id')
    if not generation_id:
        return jsonify({'error': 'generation_id is required'}), 400

    user_id = current_user['user_id']
    team_id = active_team_id

    def export_xray_job_logic(job_id):
        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')
        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            raise Exception('Generation not found')
        test_cases = generation_data.get('test_cases', [])
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_xray(
            test_cases=test_cases, user_id=user_id, team_id=team_id,
            suite_name=suite_name, ticket_id=ticket_id,
            cancel_check=lambda: is_sync_job_cancelled(job_id)
        )
        if export_result.get('cancelled'):
            raise SyncJobCancelledError('Export cancelled by user')
        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')
        if not export_result.get('success'):
            raise Exception(export_result.get('error', 'Export to Xray failed'))
        return export_result

    job_id = start_sync_job(export_xray_job_logic)
    return jsonify({'job_id': job_id}), 202


# ── Zephyr ──────────────────────────────────────────────────────────

@test_management_bp.route('/export-zephyr', methods=['POST'])
@token_required
@workspace_aware
def export_to_zephyr(current_user, active_team_id, is_personal_workspace):
    try:
        data = request.get_json()
        generation_id = data.get('generation_id')
        cycle_name = data.get('cycle_name')
        ticket_id = data.get('ticket_id')
        if not generation_id:
            return jsonify({'error': 'generation_id is required'}), 400

        user_id = current_user['user_id']
        team_id = active_team_id

        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404

        test_cases = generation_data.get('test_cases', [])
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_zephyr(
            test_cases=test_cases, user_id=user_id, team_id=team_id,
            suite_name=cycle_name, ticket_id=ticket_id
        )

        if export_result['success']:
            return jsonify({'message': 'Successfully exported to Zephyr Scale', 'result': export_result}), 200
        return jsonify({'error': export_result.get('error', 'Export to Zephyr Scale failed'), 'result': export_result}), 400
    except Exception as e:
        logger.error(f"Zephyr export error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': 'Failed to export to Zephyr Scale. Please try again.'}), 500


@test_management_bp.route('/export-zephyr-job', methods=['POST'])
@token_required
@workspace_aware
def export_to_zephyr_job(current_user, active_team_id, is_personal_workspace):
    data = request.get_json()
    generation_id = data.get('generation_id')
    cycle_name = data.get('cycle_name')
    ticket_id = data.get('ticket_id')
    if not generation_id:
        return jsonify({'error': 'generation_id is required'}), 400

    user_id = current_user['user_id']
    team_id = active_team_id

    def export_zephyr_job_logic(job_id):
        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')
        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            raise Exception('Generation not found')
        test_cases = generation_data.get('test_cases', [])
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_zephyr(
            test_cases=test_cases, user_id=user_id, team_id=team_id,
            suite_name=cycle_name, ticket_id=ticket_id,
            cancel_check=lambda: is_sync_job_cancelled(job_id)
        )
        if export_result.get('cancelled'):
            raise SyncJobCancelledError('Export cancelled by user')
        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')
        if not export_result.get('success'):
            raise Exception(export_result.get('error', 'Export to Zephyr Scale failed'))
        return export_result

    job_id = start_sync_job(export_zephyr_job_logic)
    return jsonify({'job_id': job_id}), 202


# ── TestRail ────────────────────────────────────────────────────────

@test_management_bp.route('/export-testrail', methods=['POST'])
@token_required
@workspace_aware
def export_to_testrail(current_user, active_team_id, is_personal_workspace):
    try:
        data = request.get_json()
        generation_id = data.get('generation_id')
        suite_name = data.get('suite_name')
        ticket_id = data.get('ticket_id')
        if not generation_id:
            return jsonify({'error': 'generation_id is required'}), 400
        if not suite_name:
            return jsonify({'error': 'suite_name is required for TestRail'}), 400

        user_id = current_user['user_id']
        team_id = active_team_id

        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            return jsonify({'error': 'Generation not found'}), 404

        test_cases = generation_data.get('test_cases', [])
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_testrail(
            test_cases=test_cases, user_id=user_id, team_id=team_id,
            suite_name=suite_name, ticket_id=ticket_id
        )

        if export_result['success']:
            return jsonify({'message': 'Successfully exported to TestRail', 'result': export_result}), 200
        return jsonify({'error': export_result.get('error', 'Export to TestRail failed'), 'result': export_result}), 400
    except Exception as e:
        logger.error(f"TestRail export error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': 'Failed to export to TestRail. Please try again.'}), 500


@test_management_bp.route('/export-testrail-job', methods=['POST'])
@token_required
@workspace_aware
def export_to_testrail_job(current_user, active_team_id, is_personal_workspace):
    data = request.get_json()
    generation_id = data.get('generation_id')
    suite_name = data.get('suite_name')
    ticket_id = data.get('ticket_id')
    if not generation_id:
        return jsonify({'error': 'generation_id is required'}), 400
    if not suite_name:
        return jsonify({'error': 'suite_name is required for TestRail'}), 400

    user_id = current_user['user_id']
    team_id = active_team_id

    def export_testrail_job_logic(job_id):
        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')
        generation_data = db_manager.get_generation_by_id(generation_id)
        if not generation_data:
            raise Exception('Generation not found')
        test_cases = generation_data.get('test_cases', [])
        test_mgmt_service = TestManagementService()
        export_result = test_mgmt_service.export_to_testrail(
            test_cases=test_cases, user_id=user_id, team_id=team_id,
            suite_name=suite_name, ticket_id=ticket_id,
            cancel_check=lambda: is_sync_job_cancelled(job_id)
        )
        if export_result.get('cancelled'):
            raise SyncJobCancelledError('Export cancelled by user')
        if is_sync_job_cancelled(job_id):
            raise SyncJobCancelledError('Export cancelled by user')
        if not export_result.get('success'):
            raise Exception(export_result.get('error', 'Export to TestRail failed'))
        return export_result

    job_id = start_sync_job(export_testrail_job_logic)
    return jsonify({'job_id': job_id}), 202


# ── Job status / cancel ─────────────────────────────────────────────

@test_management_bp.route('/export/job-status/<job_id>', methods=['GET'])
@token_required
def export_job_status(current_user, job_id):
    payload, status_code = get_sync_job_status_payload(job_id)
    return jsonify(payload), status_code


@test_management_bp.route('/export/cancel/<job_id>', methods=['POST'])
@token_required
def cancel_export_job_endpoint(current_user, job_id):
    if cancel_sync_job(job_id):
        return jsonify({'message': 'Sync/export job cancelled'}), 200
    return jsonify({'error': 'Job not found'}), 404
