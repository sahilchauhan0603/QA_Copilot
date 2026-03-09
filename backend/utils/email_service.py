"""
Email Service
Handles email sending for password reset and notifications
"""
import smtplib
import os
import base64
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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
        self._logo_html = self._build_logo_html()
        
        # Check if email is configured
        self.is_configured = bool(self.smtp_user and self.smtp_password)
        
        if not self.is_configured:
            logger.warning("Email service not configured. Set SMTP_USER and SMTP_PASSWORD environment variables.")
    
    def _build_logo_html(self) -> str:
        """Return an <img> tag for the logo.
        Priority: LOGO_URL env var → base64-embedded file → empty string.
        """
        logo_url = os.getenv('LOGO_URL', '').strip()
        if logo_url:
            return f'<img src="{logo_url}" alt="QA Copilot" width="64" height="64" style="display:block;margin:0 auto 16px;border-radius:12px;" />'

        # Try embedding the logo from the filesystem as a base64 data URI
        candidate_paths = [
            os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'logo.png'),
            os.path.join(os.getcwd(), 'frontend', 'public', 'logo.png'),
        ]
        for path in candidate_paths:
            try:
                abs_path = os.path.abspath(path)
                if os.path.exists(abs_path):
                    with open(abs_path, 'rb') as f:
                        data = base64.b64encode(f.read()).decode('utf-8')
                    return (f'<img src="data:image/png;base64,{data}" alt="QA Copilot"'
                            f' width="64" height="64" style="display:block;margin:0 auto 16px;border-radius:12px;" />')
            except Exception:
                continue

        return ''

    def send_email(self, to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
        """
        Send an email
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML email body
            text_body: Optional plain text email body (fallback)
            
        Returns:
            True if sent successfully, False otherwise
        """
        if not self.is_configured:
            logger.error("Cannot send email - email service not configured")
            return False
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # Attach plain text version
            if text_body:
                part1 = MIMEText(text_body, 'plain')
                msg.attach(part1)
            
            # Attach HTML version
            part2 = MIMEText(html_body, 'html')
            msg.attach(part2)
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
    
    def send_password_reset_email(self, to_email: str, username: str, reset_token: str) -> bool:
        """
        Send password reset email with reset link
        
        Args:
            to_email: User's email address
            username: User's username
            reset_token: Password reset token
            
        Returns:
            True if sent successfully, False otherwise
        """
        reset_link = f"{self.app_url}/reset-password?token={reset_token}"
        
        subject = "Password Reset Request - QA Copilot"
        
        text_body = f"""
Hello {username},

We received a request to reset the password for your QA Copilot account.

To reset your password, please click the link in the email or visit your password reset page.

Security Notice:
• This link expires in 1 hour for your protection
• If you didn't request this reset, please ignore this email
• Your password remains unchanged until you complete the reset process

Best regards,
QA Copilot Team
"""
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }}
        .header p {{
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.95;
        }}
        .content {{
            padding: 40px;
        }}
        .greeting {{
            font-size: 18px;
            color: #333;
            margin-bottom: 20px;
        }}
        .message {{
            font-size: 15px;
            color: #555;
            line-height: 1.7;
            margin-bottom: 30px;
        }}
        .button-container {{
            text-align: center;
            margin: 35px 0;
        }}
        .button {{
            display: inline-block;
            padding: 16px 48px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
        }}
        .button:hover {{
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
            transform: translateY(-2px);
        }}
        .security-notice {{
            background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
            border-left: 4px solid #ff9800;
            padding: 20px;
            margin: 30px 0;
            border-radius: 6px;
        }}
        .security-notice h3 {{
            margin: 0 0 12px 0;
            font-size: 16px;
            color: #e65100;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .security-notice ul {{
            margin: 0;
            padding-left: 20px;
            color: #555;
        }}
        .security-notice li {{
            margin: 8px 0;
            font-size: 14px;
        }}
        .footer {{
            padding: 30px 40px;
            background-color: #f9f9f9;
            border-top: 1px solid #e0e0e0;
        }}
        .footer p {{
            margin: 8px 0;
            font-size: 14px;
            color: #666;
        }}
        .footer .signature {{
            font-weight: 600;
            color: #667eea;
            margin-top: 16px;
        }}
        .footer .disclaimer {{
            font-size: 12px;
            color: #999;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            {self._logo_html}
            <h1>🔐 Password Reset Request</h1>
            <p>Secure your account with a new password</p>
        </div>
        
        <div class="content">
            <p class="greeting">Hello <strong>{username}</strong>,</p>
            
            <p class="message">
                We received a request to reset the password for your QA Copilot account. 
                To proceed with resetting your password, please click the button below:
            </p>
            
            <div class="button-container">
                <a href="{reset_link}" class="button">Reset My Password</a>
            </div>
            
            <div class="security-notice">
                <h3>🛡️ Security Notice</h3>
                <ul>
                    <li><strong>This link expires in 1 hour</strong> for your protection</li>
                    <li>If you didn't request this reset, you can safely ignore this email</li>
                    <li>Your password will remain unchanged until you complete the reset process</li>
                    <li>Never share this email or reset link with anyone</li>
                </ul>
            </div>
            
            <p class="message" style="margin-bottom: 0;">
                If you're having trouble with the button above, please contact our support team for assistance.
            </p>
        </div>
        
        <div class="footer">
            <p>Best regards,</p>
            <p class="signature">QA Copilot Team</p>
            <p class="disclaimer">
                This is an automated security message. Please do not reply to this email.
                If you need assistance, please contact our support team.
            </p>
        </div>
    </div>
</body>
</html>
"""
        
        return self.send_email(to_email, subject, html_body, text_body)

    def send_email_verification_email(self, to_email: str, username: str, verification_token: str) -> bool:
        """
        Send email verification message with verification link.

        Args:
            to_email: User's email address
            username: User's username
            verification_token: Email verification token

        Returns:
            True if sent successfully, False otherwise
        """
        verify_link = f"{self.app_url}/verify-email?token={verification_token}"
        subject = "Verify Your Email - QA Copilot"

        text_body = f"""
Hello {username},

Thanks for signing up for QA Copilot.

Please verify your email address by clicking this link:
{verify_link}

Security notice:
- This verification link expires in 24 hours
- If you did not create this account, you can ignore this email

Best regards,
QA Copilot Team
"""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: white;
            padding: 36px 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 30px;
            font-weight: 700;
        }}
        .content {{
            padding: 36px;
        }}
        .button-container {{
            text-align: center;
            margin: 30px 0;
        }}
        .button {{
            display: inline-block;
            padding: 14px 36px;
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
        }}
        .notice {{
            background: #f0f9ff;
            border-left: 4px solid #0284c7;
            padding: 16px;
            border-radius: 6px;
            font-size: 14px;
            color: #0f172a;
        }}
        .footer {{
            padding: 24px 36px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            font-size: 13px;
            color: #64748b;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            {self._logo_html}
            <h1>Verify Your Email</h1>
            <p>Complete your QA Copilot signup</p>
        </div>
        <div class="content">
            <p>Hello <strong>{username}</strong>,</p>
            <p>Thanks for signing up for QA Copilot. Please verify your email to activate login access.</p>
            <div class="button-container">
                <a href="{verify_link}" class="button">Verify Email</a>
            </div>
            <div class="notice">
                <strong>Security notice:</strong><br/>
                This link expires in 24 hours. If you did not create this account, you can ignore this email.
            </div>
        </div>
        <div class="footer">
            QA Copilot Team<br/>
            This is an automated message. Please do not reply.
        </div>
    </div>
</body>
</html>
"""

        return self.send_email(to_email, subject, html_body, text_body)

    def send_team_invitation_email(
        self, to_email: str, to_username: str, team_name: str, invited_by: str, role: str
    ) -> bool:
        """
        Send a team invitation notification email.

        Args:
            to_email: Invitee's email
            to_username: Invitee's username
            team_name: Name of the team
            invited_by: Username of the person who sent the invite
            role: Role being offered (e.g. qa_member)

        Returns:
            True if sent successfully, False otherwise
        """
        inbox_link = f"{self.app_url}/dashboard"
        role_display = role.replace('_', ' ').title()

        subject = f"You're invited to join {team_name} — QA Copilot"

        text_body = f"""
Hello {to_username},

{invited_by} has invited you to join the team "{team_name}" as a {role_display} on QA Copilot.

Log in to your account and check your Inbox to accept or decline this invitation:
{inbox_link}

If you did not expect this invitation, you can safely ignore it.

Best regards,
QA Copilot Team
"""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            padding: 36px 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }}
        .header p {{
            margin: 8px 0 0;
            font-size: 15px;
            opacity: 0.9;
        }}
        .content {{
            padding: 36px;
        }}
        .invite-card {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 20px;
            margin: 24px 0;
        }}
        .invite-card .team-name {{
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 8px;
        }}
        .invite-card .detail {{
            font-size: 14px;
            color: #64748b;
            margin: 4px 0;
        }}
        .invite-card .role-badge {{
            display: inline-block;
            padding: 4px 12px;
            background: #ede9fe;
            color: #6d28d9;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-top: 8px;
        }}
        .button-container {{
            text-align: center;
            margin: 30px 0;
        }}
        .button {{
            display: inline-block;
            padding: 14px 40px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
        }}
        .footer {{
            padding: 24px 36px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            font-size: 13px;
            color: #64748b;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            {self._logo_html}
            <h1>Team Invitation</h1>
            <p>You've been invited to collaborate</p>
        </div>
        <div class="content">
            <p>Hello <strong>{to_username}</strong>,</p>
            <p><strong>{invited_by}</strong> has invited you to join a team on QA Copilot.</p>

            <div class="invite-card">
                <div class="team-name">{team_name}</div>
                <div class="detail">Invited by: {invited_by}</div>
                <span class="role-badge">{role_display}</span>
            </div>

            <p>Log in and open your <strong>Inbox</strong> (profile icon) to accept or decline.</p>

            <div class="button-container">
                <a href="{inbox_link}" class="button">Open QA Copilot</a>
            </div>

            <p style="font-size: 13px; color: #94a3b8;">
                If you did not expect this invitation, you can safely ignore this email.
            </p>
        </div>
        <div class="footer">
            QA Copilot Team<br/>
            This is an automated message. Please do not reply.
        </div>
    </div>
</body>
</html>
"""

        return self.send_email(to_email, subject, html_body, text_body)

    def send_invitation_response_email(
        self, to_email: str, to_username: str, invitee_username: str,
        invitee_email: str, team_name: str, accepted: bool
    ) -> bool:
        """
        Notify the team admin (inviter) that their invitation was accepted or rejected.
        """
        action = "accepted" if accepted else "declined"
        action_past = "accepted" if accepted else "declined"
        emoji = "🎉" if accepted else "❌"
        header_color = "linear-gradient(135deg, #10b981 0%, #059669 100%)" if accepted else "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
        badge_bg = "#d1fae5" if accepted else "#fee2e2"
        badge_color = "#065f46" if accepted else "#991b1b"

        subject = f"{emoji} {invitee_username} {action_past} your invitation to {team_name} — QA Copilot"

        text_body = f"""
Hello {to_username},

{invitee_username} ({invitee_email}) has {action_past} your invitation to join "{team_name}".

{"They are now a member of your team. You can manage members in Team Management." if accepted else "No further action is needed. You can invite someone else anytime."}

Best regards,
QA Copilot Team
"""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; color: #333; max-width: 600px;
            margin: 0 auto; padding: 20px; background-color: #f5f5f5;
        }}
        .container {{ background: #fff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }}
        .header {{
            background: {header_color};
            color: white; padding: 36px 30px; text-align: center;
        }}
        .header h1 {{ margin: 0; font-size: 28px; font-weight: 700; }}
        .header p {{ margin: 8px 0 0; font-size: 15px; opacity: 0.9; }}
        .content {{ padding: 36px; }}
        .invitee-card {{
            background: #f8fafc; border: 1px solid #e2e8f0;
            border-radius: 10px; padding: 20px; margin: 24px 0;
        }}
        .invitee-card .name {{ font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }}
        .invitee-card .email {{ font-size: 14px; color: #64748b; }}
        .status-badge {{
            display: inline-block; padding: 6px 16px;
            background: {badge_bg}; color: {badge_color};
            border-radius: 20px; font-size: 14px; font-weight: 700;
            margin-top: 12px;
        }}
        .info-box {{
            background: #f0f9ff; border-left: 4px solid #0284c7;
            padding: 16px; border-radius: 6px; font-size: 14px; color: #0f172a;
            margin-top: 20px;
        }}
        .footer {{
            padding: 24px 36px; background: #f8fafc;
            border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            {self._logo_html}
            <h1>{emoji} Invitation {action_past.title()}</h1>
            <p>Team: {team_name}</p>
        </div>
        <div class="content">
            <p>Hello <strong>{to_username}</strong>,</p>
            <p>Your team invitation has received a response:</p>
            <div class="invitee-card">
                <div class="name">{invitee_username}</div>
                <div class="email">{invitee_email}</div>
                <span class="status-badge">{emoji} {action_past.title()}</span>
            </div>
            <div class="info-box">
                {"🎉 <strong>" + invitee_username + "</strong> is now a member of <strong>" + team_name + "</strong>. You can manage roles and members in Team Management." if accepted else "No further action needed. You can invite someone else to join <strong>" + team_name + "</strong> at any time."}
            </div>
        </div>
        <div class="footer">
            QA Copilot Team<br/>
            This is an automated message. Please do not reply.
        </div>
    </div>
</body>
</html>
"""
        return self.send_email(to_email, subject, html_body, text_body)


# Singleton instance
email_service = EmailService()
