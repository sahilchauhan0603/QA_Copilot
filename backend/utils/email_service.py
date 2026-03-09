"""
Email Service
Handles email sending for password reset, verification, and team notifications.
"""
import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from typing import Optional

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails"""

    def __init__(self):
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_user = os.getenv('SMTP_USER', '')
        self.smtp_password = os.getenv('SMTP_PASSWORD', '')
        self.from_email = os.getenv('FROM_EMAIL', self.smtp_user)
        self.from_name = os.getenv('FROM_NAME', 'QA Copilot')
        self.app_url = os.getenv('APP_URL', 'http://localhost:3000')

        self.is_configured = bool(self.smtp_user and self.smtp_password)
        if not self.is_configured:
            logger.warning("Email service not configured. Set SMTP_USER and SMTP_PASSWORD environment variables.")

        # Pre-load logo bytes (used as CID inline attachment)
        self._logo_bytes: Optional[bytes] = self._load_logo_bytes()
        self._logo_url: Optional[str] = os.getenv('LOGO_URL', '').strip() or None

    # ── Logo helpers ────────────────────────────────────────────────

    def _load_logo_bytes(self) -> Optional[bytes]:
        """Try to read the logo PNG from known filesystem paths."""
        candidate_paths = [
            os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'logo.png'),
            os.path.join(os.getcwd(), 'frontend', 'public', 'logo.png'),
        ]
        for path in candidate_paths:
            try:
                abs_path = os.path.abspath(path)
                if os.path.exists(abs_path):
                    with open(abs_path, 'rb') as f:
                        return f.read()
            except Exception:
                continue
        return None

    def _get_logo_img_tag(self) -> str:
        """Return an <img> tag referencing either LOGO_URL or the CID attachment."""
        if self._logo_url:
            return (
                f'<img src="{self._logo_url}" alt="QA Copilot" width="48" height="48" '
                f'style="display:block;margin:0 auto 12px;border-radius:10px;" />'
            )
        if self._logo_bytes:
            return (
                '<img src="cid:qac_logo" alt="QA Copilot" width="48" height="48" '
                'style="display:block;margin:0 auto 12px;border-radius:10px;" />'
            )
        return ''

    # ── Core send ───────────────────────────────────────────────────

    def send_email(self, to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
        if not self.is_configured:
            logger.error("Cannot send email — service not configured (missing SMTP_USER / SMTP_PASSWORD)")
            return False

        try:
            # Use 'related' as the outer type so CID images work,
            # with an inner 'alternative' part for text/html.
            msg = MIMEMultipart('related')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email

            alt_part = MIMEMultipart('alternative')
            if text_body:
                alt_part.attach(MIMEText(text_body, 'plain', 'utf-8'))
            alt_part.attach(MIMEText(html_body, 'html', 'utf-8'))
            msg.attach(alt_part)

            # Attach logo as CID inline image if available (and not using URL)
            if self._logo_bytes and not self._logo_url:
                logo_img = MIMEImage(self._logo_bytes, _subtype='png')
                logo_img.add_header('Content-ID', '<qac_logo>')
                logo_img.add_header('Content-Disposition', 'inline', filename='logo.png')
                msg.attach(logo_img)

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            logger.info(f"Email sent successfully to {to_email}")
            return True

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed for {self.smtp_user}: {e}")
            return False
        except smtplib.SMTPRecipientsRefused as e:
            logger.error(f"Recipient refused — {to_email}: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    # ── Shared HTML wrapper ─────────────────────────────────────────

    def _wrap_html(self, header_bg: str, header_title: str, header_subtitle: str, body_html: str) -> str:
        """Build a complete, inline-styled HTML email with logo, header, body, and footer."""
        logo = self._get_logo_img_tag()
        year = '2026'

        return f"""\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr>
    <td style="background:{header_bg};padding:36px 32px;text-align:center;">
      {logo}
      <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">{header_title}</h1>
      <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">{header_subtitle}</p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:36px 32px;">
      {body_html}
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6366f1;">QA Copilot Team</p>
      <p style="margin:0;font-size:11px;color:#9ca3af;">This is an automated message. Please do not reply to this email.</p>
      <p style="margin:12px 0 0;font-size:11px;color:#d1d5db;">&copy; {year} QA Copilot. All rights reserved.</p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>"""

    @staticmethod
    def _btn(href: str, label: str, bg: str = 'linear-gradient(135deg,#6366f1,#8b5cf6)') -> str:
        """Return an inline-styled CTA button."""
        return (
            f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto;">'
            f'<tr><td align="center" style="border-radius:8px;background:{bg};">'
            f'<a href="{href}" target="_blank" '
            f'style="display:inline-block;padding:14px 40px;color:#ffffff;font-size:15px;font-weight:600;'
            f'text-decoration:none;border-radius:8px;">{label}</a>'
            f'</td></tr></table>'
        )

    @staticmethod
    def _info_box(html_content: str, border_color: str = '#6366f1', bg: str = '#f5f3ff') -> str:
        """Return an inline-styled info / notice box."""
        return (
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">'
            f'<tr><td style="background:{bg};border-left:4px solid {border_color};'
            f'padding:16px 20px;border-radius:6px;font-size:14px;color:#1e293b;line-height:1.7;">'
            f'{html_content}</td></tr></table>'
        )

    # ── Email: Password Reset ──────────────────────────────────────

    def send_password_reset_email(self, to_email: str, username: str, reset_token: str) -> bool:
        reset_link = f"{self.app_url}/reset-password?token={reset_token}"
        subject = "Password Reset Request — QA Copilot"

        text_body = (
            f"Hello {username},\n\n"
            f"We received a request to reset the password for your QA Copilot account.\n\n"
            f"Reset your password: {reset_link}\n\n"
            f"This link expires in 1 hour.\n"
            f"If you didn't request this, you can safely ignore this email.\n\n"
            f"— QA Copilot Team"
        )

        body = (
            f'<p style="margin:0 0 16px;font-size:15px;color:#374151;">Hello <strong>{username}</strong>,</p>'
            f'<p style="margin:0 0 6px;font-size:15px;color:#4b5563;line-height:1.7;">'
            f'We received a request to reset the password associated with your QA Copilot account. '
            f'Click the button below to set a new password:</p>'
            + self._btn(reset_link, 'Reset My Password')
            + self._info_box(
                '<strong style="color:#b45309;">&#x1f6e1;&#xfe0f; Security Notice</strong><br/>'
                '&#8226; This link expires in <strong>1 hour</strong><br/>'
                '&#8226; If you did not request this reset, please ignore this email<br/>'
                '&#8226; Your password will remain unchanged until you complete the process<br/>'
                '&#8226; Never share this link with anyone',
                border_color='#f59e0b', bg='#fffbeb',
            )
            + '<p style="margin:0;font-size:13px;color:#9ca3af;">Having trouble? Contact our support team for assistance.</p>'
        )

        html_body = self._wrap_html(
            header_bg='linear-gradient(135deg,#667eea,#764ba2)',
            header_title='Password Reset Request',
            header_subtitle='Secure your account with a new password',
            body_html=body,
        )
        return self.send_email(to_email, subject, html_body, text_body)

    # ── Email: Email Verification ──────────────────────────────────

    def send_email_verification_email(self, to_email: str, username: str, verification_token: str) -> bool:
        verify_link = f"{self.app_url}/verify-email?token={verification_token}"
        subject = "Verify Your Email — QA Copilot"

        text_body = (
            f"Hello {username},\n\n"
            f"Thank you for signing up for QA Copilot!\n\n"
            f"Please verify your email address: {verify_link}\n\n"
            f"This link expires in 24 hours.\n"
            f"If you did not create this account, you can ignore this email.\n\n"
            f"— QA Copilot Team"
        )

        body = (
            f'<p style="margin:0 0 16px;font-size:15px;color:#374151;">Hello <strong>{username}</strong>,</p>'
            f'<p style="margin:0 0 6px;font-size:15px;color:#4b5563;line-height:1.7;">'
            f'Thank you for signing up for QA Copilot! To activate your account and start '
            f'generating test cases, please verify your email address by clicking the button below:</p>'
            + self._btn(verify_link, 'Verify My Email', bg='linear-gradient(135deg,#0ea5e9,#0284c7)')
            + self._info_box(
                '<strong>&#x1f512; Security Notice</strong><br/>'
                '&#8226; This verification link expires in <strong>24 hours</strong><br/>'
                '&#8226; If you did not create this account, you can safely ignore this email',
                border_color='#0284c7', bg='#f0f9ff',
            )
        )

        html_body = self._wrap_html(
            header_bg='linear-gradient(135deg,#0ea5e9,#0284c7)',
            header_title='Verify Your Email',
            header_subtitle='One quick step to activate your account',
            body_html=body,
        )
        return self.send_email(to_email, subject, html_body, text_body)

    # ── Email: Team Invitation ─────────────────────────────────────

    def send_team_invitation_email(
        self, to_email: str, to_username: str, team_name: str, invited_by: str, role: str
    ) -> bool:
        inbox_link = f"{self.app_url}/dashboard"
        role_display = role.replace('_', ' ').title()
        subject = f"You're invited to join {team_name} — QA Copilot"

        text_body = (
            f"Hello {to_username},\n\n"
            f"{invited_by} has invited you to join \"{team_name}\" as a {role_display} on QA Copilot.\n\n"
            f"Log in to accept or decline: {inbox_link}\n\n"
            f"If you did not expect this invitation, you can safely ignore it.\n\n"
            f"— QA Copilot Team"
        )

        invite_card = (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            'style="margin:24px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">'
            '<tr><td style="padding:20px;">'
            f'<p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1e293b;">{team_name}</p>'
            f'<p style="margin:0 0 10px;font-size:14px;color:#64748b;">Invited by <strong>{invited_by}</strong></p>'
            f'<span style="display:inline-block;padding:5px 14px;background:#ede9fe;color:#6d28d9;'
            f'border-radius:20px;font-size:13px;font-weight:600;">{role_display}</span>'
            '</td></tr></table>'
        )

        body = (
            f'<p style="margin:0 0 16px;font-size:15px;color:#374151;">Hello <strong>{to_username}</strong>,</p>'
            f'<p style="margin:0 0 6px;font-size:15px;color:#4b5563;line-height:1.7;">'
            f'You have been invited to join a team on QA Copilot. '
            f'Review the details below and head to your Inbox to accept or decline.</p>'
            + invite_card
            + self._btn(inbox_link, 'Open My Inbox', bg='linear-gradient(135deg,#6366f1,#8b5cf6)')
            + '<p style="margin:0;font-size:13px;color:#9ca3af;">'
            'If you did not expect this invitation, you can safely ignore this email.</p>'
        )

        html_body = self._wrap_html(
            header_bg='linear-gradient(135deg,#6366f1,#8b5cf6)',
            header_title='Team Invitation',
            header_subtitle="You've been invited to collaborate",
            body_html=body,
        )
        return self.send_email(to_email, subject, html_body, text_body)

    # ── Email: Invitation Response (to inviter) ────────────────────

    def send_invitation_response_email(
        self, to_email: str, to_username: str, invitee_username: str,
        invitee_email: str, team_name: str, accepted: bool
    ) -> bool:
        action = 'accepted' if accepted else 'declined'
        emoji = '\U0001f389' if accepted else '\u274c'
        header_bg = 'linear-gradient(135deg,#10b981,#059669)' if accepted else 'linear-gradient(135deg,#ef4444,#dc2626)'
        badge_bg = '#d1fae5' if accepted else '#fee2e2'
        badge_color = '#065f46' if accepted else '#991b1b'

        subject = f"{invitee_username} {action} your invitation to {team_name} — QA Copilot"

        follow_up = (
            f'They are now a member of your team. You can manage roles in Team Management.'
            if accepted else
            f'No further action is needed. You can invite someone else at any time.'
        )

        text_body = (
            f"Hello {to_username},\n\n"
            f"{invitee_username} ({invitee_email}) has {action} your invitation to join \"{team_name}\".\n\n"
            f"{follow_up}\n\n"
            f"— QA Copilot Team"
        )

        response_card = (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            'style="margin:24px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">'
            '<tr><td style="padding:20px;">'
            f'<p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b;">{invitee_username}</p>'
            f'<p style="margin:0 0 12px;font-size:14px;color:#64748b;">{invitee_email}</p>'
            f'<span style="display:inline-block;padding:6px 16px;background:{badge_bg};color:{badge_color};'
            f'border-radius:20px;font-size:13px;font-weight:700;">{action.title()}</span>'
            '</td></tr></table>'
        )

        info_html = (
            f'<strong>{invitee_username}</strong> is now a member of <strong>{team_name}</strong>. '
            f'You can manage their role in Team Management.'
            if accepted else
            f'You can invite someone else to join <strong>{team_name}</strong> at any time.'
        )

        body = (
            f'<p style="margin:0 0 16px;font-size:15px;color:#374151;">Hello <strong>{to_username}</strong>,</p>'
            f'<p style="margin:0 0 6px;font-size:15px;color:#4b5563;line-height:1.7;">'
            f'Your team invitation has received a response:</p>'
            + response_card
            + self._info_box(info_html, border_color='#0284c7', bg='#f0f9ff')
        )

        html_body = self._wrap_html(
            header_bg=header_bg,
            header_title=f'Invitation {action.title()}',
            header_subtitle=f'Team: {team_name}',
            body_html=body,
        )
        return self.send_email(to_email, subject, html_body, text_body)


# Singleton instance
email_service = EmailService()
