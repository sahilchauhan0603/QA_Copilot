"""
Sample ticket data for demo purposes
"""
from agents.state import TicketInfo


SAMPLE_TICKETS = {
    "bug_fix": TicketInfo(
        ticket_id="BUG-1234",
        title="User login fails with special characters in password",
        description="""
**Issue:**
Users are unable to login when their password contains special characters like @, #, $, %.
The login form shows "Invalid credentials" error even when the password is correct.

**Steps to Reproduce:**
1. Create a user account with password containing special characters (e.g., Test@123#)
2. Logout
3. Try to login with the same credentials
4. Error: "Invalid credentials" is displayed

**Expected Behavior:**
Users should be able to login successfully with passwords containing special characters.

**Actual Behavior:**
Login fails with "Invalid credentials" error.

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Version: 2.5.3
        """,
        acceptance_criteria=[
            "Users can login with passwords containing special characters (@, #, $, %, &, *)",
            "No error message is shown for valid credentials",
            "Login process completes within 2 seconds",
            "Existing users with special characters in passwords can login"
        ],
        ticket_type="bug",
        priority="P0",
        status="In Progress",
        attachments=["screenshot_login_error.png", "network_logs.har"],
        comments=[
            {
                "author": "QA Lead",
                "body": "This is affecting 15% of our user base. High priority fix needed."
            },
            {
                "author": "Dev Team",
                "body": "Looks like URL encoding issue in the authentication API. Working on fix."
            }
        ],
        linked_tickets=["STORY-456", "BUG-1100"]
    ),
    
    "feature": TicketInfo(
        ticket_id="FEAT-5678",
        title="Add export to PDF functionality for reports",
        description="""
**Feature Request:**
Users want to export their analytics reports as PDF files for sharing and offline viewing.

**User Story:**
As a business analyst, I want to export my reports as PDF so that I can share them with stakeholders who don't have system access.

**Proposed Solution:**
Add an "Export to PDF" button on the reports page that generates a formatted PDF with:
- Company logo and branding
- Report title and date range
- All charts and graphs
- Data tables
- Footer with page numbers

**Technical Notes:**
- Use existing report data API
- Support charts: bar, line, pie charts
- Maximum report size: 50 pages
- Include download progress indicator
        """,
        acceptance_criteria=[
            "Export button is visible on all report pages",
            "PDF includes company logo and branding",
            "All charts render correctly in PDF",
            "PDF generation completes within 10 seconds for reports up to 50 pages",
            "Downloaded PDF filename includes report name and date",
            "Progress indicator shows during PDF generation"
        ],
        ticket_type="story",
        priority="P1",
        status="Ready for Development",
        attachments=["mockup_export_button.png", "pdf_template.pdf"],
        comments=[
            {
                "author": "Product Manager",
                "body": "This is one of our most requested features. Let's prioritize it."
            },
            {
                "author": "Designer",
                "body": "Mockups are ready. Button should be placed next to the 'Share' button."
            }
        ],
        linked_tickets=["EPIC-123"]
    ),
    
    "api_change": TicketInfo(
        ticket_id="TASK-9012",
        title="Update user profile API to include profile picture upload",
        description="""
**Task:**
Extend the existing /api/v2/users/{userId}/profile endpoint to support profile picture uploads.

**Current API:**
PUT /api/v2/users/{userId}/profile
Request body: { "name": "...", "email": "...", "bio": "..." }

**New API:**
PUT /api/v2/users/{userId}/profile
Request body (multipart/form-data):
- name: string
- email: string
- bio: string
- profilePicture: file (optional)

**Requirements:**
- Support image formats: JPG, PNG, WebP
- Max file size: 5MB
- Auto-resize to 500x500px
- Store in cloud storage (S3)
- Return image URL in response
- Validate file type and size

**Security Considerations:**
- Validate file extension and MIME type
- Scan for malware
- Prevent path traversal attacks
        """,
        acceptance_criteria=[
            "API accepts multipart/form-data requests",
            "Only JPG, PNG, WebP formats are accepted",
            "Files larger than 5MB are rejected with 413 error",
            "Images are automatically resized to 500x500px",
            "Profile picture URL is returned in the response",
            "Old profile pictures are deleted when new ones are uploaded",
            "API returns appropriate error codes for validation failures"
        ],
        ticket_type="task",
        priority="P1",
        status="In Development",
        attachments=["api_spec.yaml"],
        comments=[
            {
                "author": "Tech Lead",
                "body": "Make sure to implement rate limiting for this endpoint."
            },
            {
                "author": "Security Team",
                "body": "Don't forget to add virus scanning for uploaded files."
            }
        ],
        linked_tickets=["FEAT-5000", "BUG-8900"]
    )
}


def get_sample_ticket(ticket_type: str = "bug_fix") -> TicketInfo:
    """
    Get a sample ticket for demo purposes
    
    Args:
        ticket_type: One of 'bug_fix', 'feature', 'api_change'
    
    Returns:
        Sample TicketInfo
    """
    return SAMPLE_TICKETS.get(ticket_type, SAMPLE_TICKETS["bug_fix"])
