"""
Shared state and utilities used across Blueprint modules.
"""
import os
import io
import logging
import threading
import uuid as uuid_lib
import traceback
from datetime import datetime

from services.auth_service import AuthService
from services.team_service import TeamService
from services.workspace_service import WorkspaceService
from services.integration_service import IntegrationService
from database.db_manager import DatabaseManager
from agents.orchestrator import AgentOrchestrator
from utils.excel_exporter import export_to_excel_bytes, get_excel_filename

logger = logging.getLogger(__name__)

# ── Service singletons ──────────────────────────────────────────────
auth_service = AuthService()
team_service = TeamService()
workspace_service = WorkspaceService()
integration_service = IntegrationService()
db_manager = DatabaseManager()

# ── Orchestrator (lazy) ─────────────────────────────────────────────
orchestrator = None

def get_orchestrator():
    global orchestrator
    if orchestrator is None:
        google_api_key = os.getenv('GOOGLE_API_KEY')
        if not google_api_key:
            raise ValueError("GOOGLE_API_KEY not set in environment variables")
        orchestrator = AgentOrchestrator(google_api_key)
    return orchestrator

# ── SSE progress tracking ──────────────────────────────────────────
_progress_store = {}
_progress_lock = threading.Lock()

AGENT_STEPS = [
    {"agent": "ticket_reader", "label": "Reading Ticket", "order": 1},
    {"agent": "context_builder", "label": "Building Context", "order": 2},
    {"agent": "test_strategy", "label": "Creating Test Strategy", "order": 3},
    {"agent": "test_generator", "label": "Generating Test Cases", "order": 4},
    {"agent": "coverage_auditor", "label": "Auditing Coverage", "order": 5},
]

def get_progress_store():
    return _progress_store

def get_progress_lock():
    return _progress_lock

def _update_progress(job_id: str, agent_name: str, status: str = "completed", detail: str = None):
    with _progress_lock:
        if job_id not in _progress_store:
            _progress_store[job_id] = {
                "status": "running",
                "steps": [],
                "current_agent": None,
                "error": None,
                "result": None,
                "cancelled": False,
            }
        store = _progress_store[job_id]
        if status == "started":
            store["current_agent"] = agent_name
        step_info = {
            "agent": agent_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
        }
        if detail:
            step_info["detail"] = detail
        store["steps"].append(step_info)

# ── Refine job management ──────────────────────────────────────────
_refine_job_store = {}
_refine_job_lock = threading.Lock()


class RefineJobCancelledError(Exception):
    """Raised when a refinement job is cancelled by the user."""


def start_refine_job(owner_user_id, target, *args, **kwargs):
    job_id = str(uuid_lib.uuid4())
    with _refine_job_lock:
        _refine_job_store[job_id] = {
            'status': 'running',
            'cancelled': False,
            'result': None,
            'error': None,
            'owner_user_id': owner_user_id,
        }

    def job_wrapper():
        try:
            result = target(job_id, *args, **kwargs)
            with _refine_job_lock:
                if _refine_job_store.get(job_id, {}).get('cancelled'):
                    return
                _refine_job_store[job_id]['result'] = result
                _refine_job_store[job_id]['status'] = 'completed'
        except RefineJobCancelledError:
            with _refine_job_lock:
                if job_id in _refine_job_store:
                    _refine_job_store[job_id]['cancelled'] = True
                    _refine_job_store[job_id]['status'] = 'cancelled'
                    _refine_job_store[job_id]['error'] = 'Cancelled by user'
        except Exception as e:
            with _refine_job_lock:
                if _refine_job_store.get(job_id, {}).get('cancelled'):
                    _refine_job_store[job_id]['status'] = 'cancelled'
                    _refine_job_store[job_id]['error'] = 'Cancelled by user'
                    return
                _refine_job_store[job_id]['error'] = str(e)
                _refine_job_store[job_id]['status'] = 'error'

    t = threading.Thread(target=job_wrapper, daemon=True)
    t.start()
    return job_id


def cancel_refine_job(job_id):
    with _refine_job_lock:
        if job_id in _refine_job_store:
            if _refine_job_store[job_id].get('status') in ('completed', 'error', 'cancelled'):
                return False
            _refine_job_store[job_id]['cancelled'] = True
            _refine_job_store[job_id]['status'] = 'cancelled'
            _refine_job_store[job_id]['error'] = 'Cancelled by user'
            return True
    return False


def is_refine_job_cancelled(job_id):
    with _refine_job_lock:
        return _refine_job_store.get(job_id, {}).get('cancelled', False)


def get_refine_job_status_payload(current_user_id, job_id):
    with _refine_job_lock:
        job = _refine_job_store.get(job_id)
        if not job:
            return {'error': 'Job not found'}, 404
        if job.get('owner_user_id') != current_user_id:
            return {'error': 'Access denied'}, 403
        return {
            'status': job['status'],
            'result': job.get('result'),
            'error': job.get('error'),
        }, 200

# ── Sync / export job management ───────────────────────────────────
sync_job_store = {}
sync_job_lock = threading.Lock()


class SyncJobCancelledError(Exception):
    """Raised when a sync/export job is cancelled by the user."""


def start_sync_job(target, *args, **kwargs):
    job_id = str(uuid_lib.uuid4())
    with sync_job_lock:
        sync_job_store[job_id] = {
            'status': 'running',
            'cancelled': False,
            'result': None,
            'error': None,
        }

    def job_wrapper():
        try:
            result = target(job_id, *args, **kwargs)
            with sync_job_lock:
                if sync_job_store.get(job_id, {}).get('cancelled'):
                    return
                sync_job_store[job_id]['result'] = result
                sync_job_store[job_id]['status'] = 'completed'
        except SyncJobCancelledError:
            with sync_job_lock:
                if job_id in sync_job_store:
                    sync_job_store[job_id]['cancelled'] = True
                    sync_job_store[job_id]['status'] = 'cancelled'
        except Exception as e:
            with sync_job_lock:
                if sync_job_store.get(job_id, {}).get('cancelled'):
                    sync_job_store[job_id]['status'] = 'cancelled'
                    sync_job_store[job_id]['error'] = 'Cancelled by user'
                    return
                sync_job_store[job_id]['error'] = str(e)
                sync_job_store[job_id]['status'] = 'error'

    t = threading.Thread(target=job_wrapper)
    t.start()
    return job_id


def cancel_sync_job(job_id):
    with sync_job_lock:
        if job_id in sync_job_store:
            sync_job_store[job_id]['cancelled'] = True
            sync_job_store[job_id]['status'] = 'cancelled'
            return True
    return False


def is_sync_job_cancelled(job_id):
    with sync_job_lock:
        return sync_job_store.get(job_id, {}).get('cancelled', False)


def get_sync_job_status_payload(job_id):
    with sync_job_lock:
        job = sync_job_store.get(job_id)
        if not job:
            return {'error': 'Job not found'}, 404
        return {
            'status': job['status'],
            'result': job.get('result'),
            'error': job.get('error'),
        }, 200


# ── Screenshot analysis ────────────────────────────────────────────
ALLOWED_IMAGE_TYPES = {'image/png', 'image/jpeg', 'image/jpg'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB per image
MAX_IMAGES = 5

# ── File attachment analysis ───────────────────────────────────────
MAX_FILE_SIZE = 500 * 1024          # 500 KB per file (hard limit)
MAX_FILES = 3                       # max 3 files per request
ALLOWED_FILE_EXTENSIONS = {
    '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cs', '.go', '.rb',
    '.php', '.html', '.css', '.json', '.yaml', '.yml', '.sql', '.md',
    '.txt', '.vue', '.kt', '.swift', '.cpp', '.c',
}


def analyze_screenshots(uploaded_files):
    """Analyze uploaded screenshots using Gemini multimodal API."""
    try:
        from PIL import Image as PILImage

        orch = get_orchestrator()
        model = orch.llm_client.GenerativeModel(
            model_name=os.getenv("LLM_MODEL", "gemini-2.0-flash-exp")
        )

        images = []
        for f in uploaded_files:
            img_bytes = f.read()
            img = PILImage.open(io.BytesIO(img_bytes))
            images.append(img)
            f.seek(0)

        count_label = "this UI screenshot" if len(images) == 1 else f"these {len(images)} UI screenshots"

        prompt = f"""Analyze {count_label} in detail and provide a comprehensive description covering:

1. **UI Layout & Structure**: Page layout, sections, navigation elements, headers, footers
2. **Interactive Elements**: Forms, buttons, inputs, dropdowns, checkboxes, toggles, links
3. **Data & Content**: Any data displayed (tables, lists, cards), text content, labels
4. **Visual States**: Error messages, validation states, loading indicators, success/failure notifications
5. **User Workflow**: What process or task is being performed, current step in the workflow
6. **Edge Cases Visible**: Any unusual states, empty states, boundary conditions shown

Be very specific about element positions, labels, values, and states visible in the screenshot(s).
This description will be used to generate comprehensive test cases, so include every testable detail you can observe."""

        response = model.generate_content([prompt] + images)

        for img in images:
            img.close()

        return response.text
    except ImportError:
        logger.warning("Pillow not installed - image analysis unavailable. Install with: pip install Pillow")
        return "[Image analysis unavailable - Pillow library not installed]"
    except Exception as e:
        logger.error(f"Image analysis failed: {e}")
        logger.error(traceback.format_exc())
        return f"[Image analysis failed: {str(e)}]"


def extract_file_contents(uploaded_files):
    """
    Read uploaded text-based code/config files and return a combined string
    suitable for injection into agent prompts.

    Each file is returned as a labelled block:
    --- filename.py (123 lines) ---
    <content>
    """
    sections = []
    for f in uploaded_files:
        try:
            raw = f.read()
            f.seek(0)
            # Attempt UTF-8 first, fallback to latin-1
            try:
                text = raw.decode('utf-8')
            except UnicodeDecodeError:
                text = raw.decode('latin-1')
            line_count = text.count('\n') + (1 if text and not text.endswith('\n') else 0)
            sections.append(f"--- {f.filename} ({line_count} lines) ---\n{text}")
        except Exception as e:
            logger.warning(f"Could not read file {getattr(f, 'filename', '?')}: {e}")
            sections.append(f"--- {getattr(f, 'filename', 'unknown')} --- [read error]")
    return "\n\n".join(sections)
