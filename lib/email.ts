import nodemailer from 'nodemailer'

function createTransporter() {
  if (!process.env.EMAIL_HOST) return null

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT ?? '587', 10),
    secure: parseInt(process.env.EMAIL_PORT ?? '587', 10) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const fromAddress = process.env.EMAIL_FROM ?? 'Velour <noreply@velour.dating>'

const baseStyle = `
  font-family: 'Georgia', serif;
  background-color: #0A0A0F;
  color: #ffffff;
`

function wrapEmail(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="${baseStyle} margin:0; padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0F; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#12121A; border:1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#DC143C,#8F0D25); padding:32px; text-align:center;">
              <span style="font-size:36px; font-weight:bold; color:#ffffff; letter-spacing:4px; font-family:'Georgia',serif;">VELOUR</span>
              <p style="color:rgba(255,255,255,0.8); margin:8px 0 0; font-size:13px; letter-spacing:2px; text-transform:uppercase;">${title}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; border-top:1px solid rgba(255,255,255,0.06); text-align:center;">
              <p style="color:#555566; font-size:12px; margin:0 0 4px;">© ${new Date().getFullYear()} Velour. All rights reserved.</p>
              <p style="color:#555566; font-size:12px; margin:0;">
                <a href="${appUrl}/privacy" style="color:#DC143C; text-decoration:none;">Privacy Policy</a>
                &nbsp;·&nbsp;
                <a href="${appUrl}/terms" style="color:#DC143C; text-decoration:none;">Terms of Service</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${appUrl}/auth/verify-email?token=${token}`

  const body = `
    <h2 style="color:#ffffff; font-family:'Georgia',serif; font-size:24px; margin:0 0 16px;">Verify Your Email</h2>
    <p style="color:#aaaacc; font-size:15px; line-height:1.7; margin:0 0 24px;">
      Welcome to Velour. Please verify your email address to unlock full access to our exclusive community.
    </p>
    <div style="text-align:center; margin:32px 0;">
      <a href="${link}" style="display:inline-block; background:linear-gradient(135deg,#DC143C,#8F0D25); color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:10px; font-weight:600; font-size:15px; letter-spacing:0.5px;">
        Verify Email Address
      </a>
    </div>
    <p style="color:#666677; font-size:13px; line-height:1.6; margin:0 0 8px;">
      Or copy this link into your browser:
    </p>
    <p style="background-color:#0A0A0F; border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; word-break:break-all; font-size:12px; color:#aaaacc; margin:0 0 24px;">
      ${link}
    </p>
    <p style="color:#555566; font-size:13px; margin:0;">
      This link expires in 24 hours. If you did not create a Velour account, you can safely ignore this email.
    </p>
  `

  const html = wrapEmail('Email Verification', body)

  const transporter = createTransporter()
  if (!transporter) {
    console.log('[Velour Email - DEV] Verification email:')
    console.log(`  To: ${to}`)
    console.log(`  Link: ${link}`)
    return
  }

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject: 'Verify your Velour email address',
    html,
  })
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${appUrl}/auth/reset-password?token=${token}`

  const body = `
    <h2 style="color:#ffffff; font-family:'Georgia',serif; font-size:24px; margin:0 0 16px;">Reset Your Password</h2>
    <p style="color:#aaaacc; font-size:15px; line-height:1.7; margin:0 0 24px;">
      We received a request to reset the password for your Velour account. Click the button below to choose a new password.
    </p>
    <div style="text-align:center; margin:32px 0;">
      <a href="${link}" style="display:inline-block; background:linear-gradient(135deg,#DC143C,#8F0D25); color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:10px; font-weight:600; font-size:15px; letter-spacing:0.5px;">
        Reset Password
      </a>
    </div>
    <p style="color:#666677; font-size:13px; line-height:1.6; margin:0 0 8px;">
      Or copy this link into your browser:
    </p>
    <p style="background-color:#0A0A0F; border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; word-break:break-all; font-size:12px; color:#aaaacc; margin:0 0 24px;">
      ${link}
    </p>
    <p style="color:#555566; font-size:13px; margin:0;">
      This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email — your account is secure.
    </p>
  `

  const html = wrapEmail('Password Reset', body)

  const transporter = createTransporter()
  if (!transporter) {
    console.log('[Velour Email - DEV] Password reset email:')
    console.log(`  To: ${to}`)
    console.log(`  Link: ${link}`)
    return
  }

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject: 'Reset your Velour password',
    html,
  })
}
