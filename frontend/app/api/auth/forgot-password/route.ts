import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ detail: 'Email is required' }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

    // Ask Django to generate a reset token
    const djangoRes = await fetch(`${backendUrl}/api/v1/auth/forgot-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const djangoData = await djangoRes.json();

    // If Django returned no token (user not found), still respond 200 to avoid enumeration
    if (!djangoData.token) {
      return NextResponse.json({ detail: djangoData.detail || 'If that email exists, a reset link has been sent.' });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8080';
    const resetUrl = `${appUrl}/reset-password?token=${djangoData.token}`;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'CardVault <noreply@cardvault.app>',
      to: email,
      subject: 'Reset your CardVault password',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; margin-bottom: 16px;">
              <span style="font-size: 28px;">💳</span>
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #1e1b4b;">CardVault</h1>
          </div>

          <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #111827;">Reset your password</h2>
          <p style="margin: 0 0 24px; font-size: 15px; color: #6b7280; line-height: 1.5;">
            Hi ${djangoData.user_name}, we received a request to reset the password for your CardVault account.
            Click the button below to choose a new password.
          </p>

          <a href="${resetUrl}"
             style="display: block; text-align: center; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 10px; font-size: 15px; font-weight: 600; margin-bottom: 24px;">
            Reset Password
          </a>

          <p style="margin: 0 0 8px; font-size: 13px; color: #9ca3af; line-height: 1.5;">
            This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />

          <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
            If the button above doesn't work, copy and paste this link:<br />
            <a href="${resetUrl}" style="color: #6366f1; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
      `,
    });

    return NextResponse.json({ detail: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ detail: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
