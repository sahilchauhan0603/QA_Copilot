"""
Email Service
Handles email sending for password reset and notifications
"""
import smtplib
import os
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
        
        # Check if email is configured
        self.is_configured = bool(self.smtp_user and self.smtp_password)
        
        if not self.is_configured:
            logger.warning("Email service not configured. Set SMTP_USER and SMTP_PASSWORD environment variables.")
    
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


# Singleton instance
email_service = EmailService()
