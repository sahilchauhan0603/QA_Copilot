"""
Webhook routes — /api/webhooks/*
Handles incoming webhooks from Jira/Azure DevOps and webhook subscription management.
"""
import hashlib
import hmac
import json
import logging
import os
import threading
import traceback
import uuid as uuid_lib
from datetime import datetime

from flask import Blueprint, request, jsonify

from api.decorators import token_required
from api.shared import (
    auth_service, workspace_service, integration_service, db_manager,
    get_orchestrator, _update_progress, get_progress_store, get_progress_lock,
)
from agents.state import TicketInfo
from database.connection import get_db_connection
from database.auth_models import WebhookSubscription, IntegrationType, User
from utils.email_service import email_service

logger = logging.getLogger(__name__)

webhooks_bp = Blueprint('webhooks', __name__, url_prefix='/api/webhooks')

# In-memory debounce tracker: {ticket_key: last_trigger_timestamp}
_debounce_lock = threading.Lock()
_debounce_tracker = {}
DEBOUNCE_SECONDS = 30


# ── Subscription CRUD ──────────────────────────────────────────────

@webhooks_bp.route('/subscriptions', methods=['GET'])
@token_required
def get_subscriptions(current_user):
    """List all webhook subscriptions for the current workspace."""
    try:
        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)
        db = get_db_connection()
        with db.get_session() as session:
            query = session.query(WebhookSubscription).filter(
                WebhookSubscription.user_id == user_id,
            )
            if team_id is None:
                query = query.filter(WebhookSubscription.team_id.is_(None))
            else:
                query = query.filter(WebhookSubscription.team_id == team_id)

            subs = query.order_by(WebhookSubscription.created_at.desc()).all()
            return jsonify({'subscriptions': [s.to_dict() for s in subs]}), 200
    except Exception as e:
        logger.error(f"Get subscriptions error: {e}")
        return jsonify({'error': 'Failed to get subscriptions'}), 500


@webhooks_bp.route('/subscriptions', methods=['POST'])
@token_required
def create_subscription(current_user):
    """Create or re-enable a webhook subscription for a ticket."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        integration_type = data.get('integration_type')
        ticket_id = data.get('ticket_id')
        ticket_title = data.get('ticket_title', '')
        generation_id = data.get('generation_id')

        if not integration_type or not ticket_id:
            return jsonify({'error': 'integration_type and ticket_id are required'}), 400

        try:
            int_type = IntegrationType(integration_type)
        except ValueError:
            return jsonify({'error': f'Invalid integration type: {integration_type}'}), 400

        user_id = current_user['user_id']
        team_id = workspace_service.get_active_workspace(user_id)

        # Compute initial content hash by fetching the ticket
        content_hash = _compute_ticket_hash(integration_type, ticket_id, user_id, team_id)

        db = get_db_connection()
        with db.get_session() as session:
            existing = session.query(WebhookSubscription).filter(
                WebhookSubscription.user_id == user_id,
                WebhookSubscription.integration_type == int_type,
                WebhookSubscription.ticket_id == ticket_id,
                WebhookSubscription.team_id == team_id if team_id else WebhookSubscription.team_id.is_(None),
            ).first()

            if existing:
                existing.is_active = True
                existing.ticket_title = ticket_title or existing.ticket_title
                existing.generation_id = generation_id or existing.generation_id
                if content_hash:
                    existing.content_hash = content_hash
                session.commit()
                return jsonify({'subscription': existing.to_dict(), 'message': 'Subscription re-activated'}), 200

            sub = WebhookSubscription(
                user_id=user_id,
                team_id=team_id,
                integration_type=int_type,
                ticket_id=ticket_id,
                ticket_title=ticket_title,
                generation_id=generation_id,
                content_hash=content_hash,
                is_active=True,
            )
            session.add(sub)
            session.commit()
            return jsonify({'subscription': sub.to_dict(), 'message': 'Subscription created'}), 201

    except Exception as e:
        logger.error(f"Create subscription error: {e}")
        return jsonify({'error': 'Failed to create subscription'}), 500


@webhooks_bp.route('/subscriptions/<int:sub_id>', methods=['PATCH'])
@token_required
def update_subscription(current_user, sub_id):
    """Toggle active state of a subscription."""
    try:
        data = request.get_json() or {}
        user_id = current_user['user_id']
        db = get_db_connection()
        with db.get_session() as session:
            sub = session.query(WebhookSubscription).filter(
                WebhookSubscription.id == sub_id,
                WebhookSubscription.user_id == user_id,
            ).first()
            if not sub:
                return jsonify({'error': 'Subscription not found'}), 404

            if 'is_active' in data:
                sub.is_active = bool(data['is_active'])
            session.commit()
            return jsonify({'subscription': sub.to_dict()}), 200
    except Exception as e:
        logger.error(f"Update subscription error: {e}")
        return jsonify({'error': 'Failed to update subscription'}), 500


@webhooks_bp.route('/subscriptions/<int:sub_id>', methods=['DELETE'])
@token_required
def delete_subscription(current_user, sub_id):
    """Delete a webhook subscription."""
    try:
        user_id = current_user['user_id']
        db = get_db_connection()
        with db.get_session() as session:
            sub = session.query(WebhookSubscription).filter(
                WebhookSubscription.id == sub_id,
                WebhookSubscription.user_id == user_id,
            ).first()
            if not sub:
                return jsonify({'error': 'Subscription not found'}), 404
            session.delete(sub)
            session.commit()
            return jsonify({'message': 'Subscription deleted'}), 200
    except Exception as e:
        logger.error(f"Delete subscription error: {e}")
        return jsonify({'error': 'Failed to delete subscription'}), 500


# ── Incoming Webhook Receivers ──────────────────────────────────────

@webhooks_bp.route('/jira', methods=['POST'])
def receive_jira_webhook():
    """
    Receive a Jira webhook event.
    Verifies signature if JIRA_WEBHOOK_SECRET is configured.
    """
    # Verify signature
    secret = os.getenv('JIRA_WEBHOOK_SECRET', '').strip()
    if secret:
        if not _verify_jira_signature(request, secret):
            logger.warning("Jira webhook signature verification failed")
            return jsonify({'error': 'Invalid signature'}), 401

    try:
        payload = request.get_json(force=True)
        if not payload:
            return jsonify({'ok': True}), 200

        event = payload.get('webhookEvent', '')
        # Only process issue update events
        if 'issue_updated' not in event and 'jira:issue_updated' not in event:
            return jsonify({'ok': True}), 200

        issue = payload.get('issue', {})
        ticket_id = issue.get('key', '')
        if not ticket_id:
            return jsonify({'ok': True}), 200

        # Check if significant fields changed
        changelog = payload.get('changelog', {})
        if not _is_significant_jira_change(changelog):
            logger.debug(f"Jira webhook for {ticket_id}: non-significant change, skipping")
            return jsonify({'ok': True}), 200

        # Respond immediately, process async
        threading.Thread(
            target=_process_webhook_trigger,
            args=('jira', ticket_id),
            daemon=True,
        ).start()

        return jsonify({'ok': True}), 200

    except Exception as e:
        logger.error(f"Jira webhook processing error: {e}")
        return jsonify({'ok': True}), 200


@webhooks_bp.route('/azure-devops', methods=['POST'])
def receive_ado_webhook():
    """
    Receive an Azure DevOps Service Hook event.
    Verifies shared secret via Authorization header if ADO_WEBHOOK_SECRET is configured.
    """
    secret = os.getenv('ADO_WEBHOOK_SECRET', '').strip()
    if secret:
        auth_header = request.headers.get('Authorization', '')
        # ADO can send Basic auth with password = secret
        if not _verify_ado_auth(auth_header, secret):
            logger.warning("Azure DevOps webhook auth verification failed")
            return jsonify({'error': 'Invalid authorization'}), 401

    try:
        payload = request.get_json(force=True)
        if not payload:
            return jsonify({'ok': True}), 200

        event_type = payload.get('eventType', '')
        if 'workitem.updated' not in event_type:
            return jsonify({'ok': True}), 200

        resource = payload.get('resource', {})
        work_item = resource.get('workItemId') or resource.get('id')
        # ADO may nest the work item differently
        if not work_item:
            revision = resource.get('revision', {})
            work_item = revision.get('id')
        if not work_item:
            return jsonify({'ok': True}), 200

        ticket_id = str(work_item)

        # Check significant field changes
        fields_changed = resource.get('fields', {})
        if not _is_significant_ado_change(fields_changed):
            logger.debug(f"ADO webhook for {ticket_id}: non-significant change, skipping")
            return jsonify({'ok': True}), 200

        threading.Thread(
            target=_process_webhook_trigger,
            args=('azure_devops', ticket_id),
            daemon=True,
        ).start()

        return jsonify({'ok': True}), 200

    except Exception as e:
        logger.error(f"Azure DevOps webhook processing error: {e}")
        return jsonify({'ok': True}), 200


# ── Internal Helpers ───────────────────────────────────────────────

def _verify_jira_signature(req, secret):
    """Verify Jira webhook HMAC-SHA256 signature."""
    signature = req.headers.get('X-Hub-Signature', '')
    if not signature:
        return False
    body = req.get_data()
    expected = 'sha256=' + hmac.new(
        secret.encode('utf-8'), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)


def _verify_ado_auth(auth_header, secret):
    """Verify ADO service hook authorization (Basic auth with secret as password)."""
    import base64
    if not auth_header.startswith('Basic '):
        return hmac.compare_digest(auth_header, secret)
    try:
        decoded = base64.b64decode(auth_header[6:]).decode('utf-8')
        # format is "username:password" — we only check password
        _, _, password = decoded.partition(':')
        return hmac.compare_digest(password, secret)
    except Exception:
        return False


SIGNIFICANT_JIRA_FIELDS = {'summary', 'description', 'acceptance criteria', 'labels', 'issuetype'}

def _is_significant_jira_change(changelog):
    """Returns True if the Jira changelog contains a significant field change."""
    if not changelog:
        return True  # If no changelog info, assume significant
    items = changelog.get('items', [])
    for item in items:
        field = (item.get('field', '') or '').lower()
        if field in SIGNIFICANT_JIRA_FIELDS:
            return True
    return False


SIGNIFICANT_ADO_FIELDS = {
    'System.Title', 'System.Description',
    'Microsoft.VSTS.Common.AcceptanceCriteria',
    'System.WorkItemType',
}

def _is_significant_ado_change(fields_changed):
    """Returns True if ADO field changes include significant fields."""
    if not fields_changed:
        return True
    for field_key in fields_changed:
        if field_key in SIGNIFICANT_ADO_FIELDS:
            return True
    return False


def _compute_ticket_hash(integration_type, ticket_id, user_id, team_id):
    """Fetch ticket content and compute a SHA-256 hash for change detection."""
    try:
        ticket_data, error = integration_service.fetch_ticket(
            integration_type, ticket_id, user_id=user_id, team_id=team_id
        )
        if not ticket_data:
            return None
        content = json.dumps({
            'title': ticket_data.get('title', ''),
            'description': ticket_data.get('description', ''),
            'acceptance_criteria': ticket_data.get('acceptance_criteria', []),
        }, sort_keys=True)
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    except Exception as e:
        logger.warning(f"Could not compute ticket hash for {ticket_id}: {e}")
        return None


def _process_webhook_trigger(integration_type, ticket_id):
    """
    Core webhook processing logic:
    1. Find active subscriptions for this ticket
    2. Debounce rapid duplicate events
    3. Verify content actually changed
    4. Re-run generation pipeline
    5. Send email notification
    """
    debounce_key = f"{integration_type}:{ticket_id}"

    with _debounce_lock:
        last = _debounce_tracker.get(debounce_key, 0)
        now = datetime.utcnow().timestamp()
        if now - last < DEBOUNCE_SECONDS:
            logger.info(f"Webhook debounced for {debounce_key}")
            return
        _debounce_tracker[debounce_key] = now

    try:
        int_type = IntegrationType(integration_type)
    except ValueError:
        return

    db = get_db_connection()
    try:
        with db.get_session() as session:
            subs = session.query(WebhookSubscription).filter(
                WebhookSubscription.integration_type == int_type,
                WebhookSubscription.ticket_id == ticket_id,
                WebhookSubscription.is_active == True,
            ).all()

            if not subs:
                logger.debug(f"No active subscriptions for {integration_type}:{ticket_id}")
                return

            for sub in subs:
                try:
                    _process_subscription(session, sub)
                except Exception as e:
                    logger.error(f"Failed to process subscription {sub.id}: {e}")
                    logger.error(traceback.format_exc())

    except Exception as e:
        logger.error(f"Webhook trigger processing error: {e}")
        logger.error(traceback.format_exc())


def _process_subscription(session, sub):
    """Process a single subscription: check hash, regenerate, notify."""
    user_id = sub.user_id
    team_id = sub.team_id
    integration_type = sub.integration_type.value
    ticket_id = sub.ticket_id

    # Fetch current ticket content and hash it
    new_hash = _compute_ticket_hash(integration_type, ticket_id, user_id, team_id)
    if new_hash and sub.content_hash and new_hash == sub.content_hash:
        logger.info(f"Content hash unchanged for {ticket_id}, skipping regeneration")
        return

    # Fetch full ticket data for regeneration
    ticket_data, error = integration_service.fetch_ticket(
        integration_type, ticket_id, user_id=user_id, team_id=team_id
    )
    if not ticket_data:
        logger.error(f"Failed to fetch ticket {ticket_id} for regeneration: {error}")
        return

    ticket_info = TicketInfo(
        ticket_id=ticket_data.get('ticket_id', ticket_id),
        title=ticket_data.get('title', ''),
        description=ticket_data.get('description', ''),
        acceptance_criteria=ticket_data.get('acceptance_criteria', []),
        ticket_type=ticket_data.get('ticket_type', 'story'),
        priority=ticket_data.get('priority', 'P2'),
        status=ticket_data.get('status', ''),
        attachments=ticket_data.get('attachments', []),
        comments=ticket_data.get('comments', []),
        linked_tickets=ticket_data.get('linked_tickets', []),
    )

    logger.info(f"Auto-regenerating tests for {ticket_id} (subscription {sub.id})")

    try:
        orch = get_orchestrator()
        final_state = orch.process_ticket(ticket_info)

        if integration_type:
            final_state['source_integration'] = integration_type

        generation_id = db_manager.save_generation(
            state=final_state,
            user_id=user_id,
            team_id=team_id,
            excel_file_path=None,
        )

        # Update subscription
        sub.content_hash = new_hash
        sub.generation_id = generation_id
        sub.last_triggered_at = datetime.utcnow()
        session.commit()

        total_tests = len(final_state.get('test_cases', []))
        logger.info(f"Auto-regeneration complete for {ticket_id}: {total_tests} test cases, gen={generation_id}")

        # Send email notification
        _send_regeneration_email(user_id, ticket_id, ticket_data.get('title', ''), total_tests, generation_id)

    except Exception as e:
        logger.error(f"Auto-regeneration failed for {ticket_id}: {e}")
        logger.error(traceback.format_exc())
        # Still send notification about failure
        _send_regeneration_failure_email(user_id, ticket_id, ticket_data.get('title', ''), str(e))


def _send_regeneration_email(user_id, ticket_id, ticket_title, total_tests, generation_id):
    """Send email notification when auto-regeneration succeeds."""
    try:
        db = get_db_connection()
        with db.get_session() as session:
            user = session.query(User).filter(User.id == user_id).first()
            if not user or not user.email:
                return

            app_url = os.getenv('APP_URL', 'http://localhost:3000')
            dashboard_link = f"{app_url}/dashboard"

            subject = f"Tests Auto-Regenerated: {ticket_id} — QA Copilot"

            text_body = (
                f"Hello {user.username},\n\n"
                f"The ticket \"{ticket_title}\" ({ticket_id}) was updated and your test cases "
                f"have been automatically regenerated.\n\n"
                f"Results: {total_tests} test cases generated.\n\n"
                f"View results: {dashboard_link}\n\n"
                f"— QA Copilot Team"
            )

            body = (
                f'<p style="margin:0 0 16px;font-size:15px;color:#374151;">Hello <strong>{user.username}</strong>,</p>'
                f'<p style="margin:0 0 6px;font-size:15px;color:#4b5563;line-height:1.7;">'
                f'A ticket you\'re monitoring was updated, and your test cases have been '
                f'automatically regenerated.</p>'
                + email_service._info_box(
                    f'<strong>Ticket:</strong> {ticket_id} — {ticket_title}<br/>'
                    f'<strong>Test Cases Generated:</strong> {total_tests}<br/>'
                    f'<strong>Time:</strong> {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}',
                    border_color='#10b981', bg='#ecfdf5',
                )
                + email_service._btn(dashboard_link, 'View Results', bg='linear-gradient(135deg,#10b981,#059669)')
                + '<p style="margin:0;font-size:13px;color:#9ca3af;">'
                'You can manage your webhook subscriptions in Settings → Webhook Monitoring.</p>'
            )

            html_body = email_service._wrap_html(
                header_bg='linear-gradient(135deg,#10b981,#059669)',
                header_title='Tests Auto-Regenerated',
                header_subtitle=f'{ticket_id} was updated',
                body_html=body,
            )
            email_service.send_email(user.email, subject, html_body, text_body)
    except Exception as e:
        logger.error(f"Failed to send regeneration email: {e}")


def _send_regeneration_failure_email(user_id, ticket_id, ticket_title, error_msg):
    """Send email notification when auto-regeneration fails."""
    try:
        db = get_db_connection()
        with db.get_session() as session:
            user = session.query(User).filter(User.id == user_id).first()
            if not user or not user.email:
                return

            app_url = os.getenv('APP_URL', 'http://localhost:3000')
            settings_link = f"{app_url}/settings"

            subject = f"Auto-Regeneration Failed: {ticket_id} — QA Copilot"

            text_body = (
                f"Hello {user.username},\n\n"
                f"The ticket \"{ticket_title}\" ({ticket_id}) was updated, but the automatic "
                f"test regeneration failed.\n\n"
                f"Error: {error_msg}\n\n"
                f"You can try generating tests manually or check your settings: {settings_link}\n\n"
                f"— QA Copilot Team"
            )

            body = (
                f'<p style="margin:0 0 16px;font-size:15px;color:#374151;">Hello <strong>{user.username}</strong>,</p>'
                f'<p style="margin:0 0 6px;font-size:15px;color:#4b5563;line-height:1.7;">'
                f'A ticket you\'re monitoring was updated, but the automatic test regeneration '
                f'encountered an error.</p>'
                + email_service._info_box(
                    f'<strong>Ticket:</strong> {ticket_id} — {ticket_title}<br/>'
                    f'<strong>Error:</strong> {error_msg}<br/>'
                    f'<strong>Time:</strong> {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}',
                    border_color='#ef4444', bg='#fef2f2',
                )
                + email_service._btn(settings_link, 'Check Settings', bg='linear-gradient(135deg,#ef4444,#dc2626)')
                + '<p style="margin:0;font-size:13px;color:#9ca3af;">'
                'You can manually regenerate from the Test Generation page.</p>'
            )

            html_body = email_service._wrap_html(
                header_bg='linear-gradient(135deg,#ef4444,#dc2626)',
                header_title='Auto-Regeneration Failed',
                header_subtitle=f'{ticket_id} update could not be processed',
                body_html=body,
            )
            email_service.send_email(user.email, subject, html_body, text_body)
    except Exception as e:
        logger.error(f"Failed to send regeneration failure email: {e}")
