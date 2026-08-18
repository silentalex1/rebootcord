const nodemailer = require('nodemailer');

let transporter = null;
let verified = false;
let lastVerifyError = null;

const SMTP_HOST = process.env.SMTP_HOST || process.env.SMTP_SERVER || process.env.MAIL_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || process.env.SMTP_USERNAME || process.env.MAIL_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASS || '';
const SMTP_SECURE = process.env.SMTP_SECURE != null ? process.env.SMTP_SECURE === 'true' : SMTP_PORT === 465;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Reboot Cord <no-reply@rebootcord.world>';
const SITE_URL = process.env.SITE_URL || 'https://rebootcord.world';

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
  transporter.verify((err) => {
    if (err) {
      verified = false;
      lastVerifyError = err.message;
      console.warn('[email] SMTP verify failed:', err.message);
    } else {
      verified = true;
      lastVerifyError = null;
      console.log('[email] SMTP connection verified, ready to send.');
    }
  });
} else {
  console.warn('[email] SMTP not configured — set SMTP_HOST, SMTP_USER and SMTP_PASS to enable outgoing email.');
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function esc(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendMail({ to, subject, text, html, fromName }) {
  if (!transporter) return { sent: false, reason: 'SMTP not configured on the server (missing SMTP_HOST/SMTP_USER/SMTP_PASS).' };
  if (!isValidEmail(to)) return { sent: false, reason: 'Invalid recipient' };
  const from = fromName ? `"${fromName.replace(/["\r\n]/g, '')}" <${EMAIL_FROM.replace(/^.*<|>$/g, '')}>` : EMAIL_FROM;
  try {
    await transporter.sendMail({ from, to, subject, text, html });
    verified = true;
    return { sent: true };
  } catch (e) {
    console.warn('[email] Send failed:', e.message);
    return { sent: false, reason: e.message };
  }
}

function sendWelcomeEmail(to, username) {
  const resetUrl = SITE_URL.replace(/\/$/, '') + '/reset-password';
  return sendMail({
    to,
    subject: 'Welcome to Reboot Cord',
    text: `Welcome to rebootcord.\n\nIf you forgot your password make sure to check out here: ${resetUrl}\n\nIf you have any website suggestions please let me know in the discord server.`,
    html: `<p>Welcome to rebootcord.</p><p>If you forgot your password make sure to check out <a href="${resetUrl}" style="color:#3b82f6;text-decoration:none">here</a>.</p><p>If you have any website suggestions please let me know in the discord server.</p>`,
  });
}

function sendPasswordResetConfirmation(to, username, newPassword) {
  const resetUrl = SITE_URL.replace(/\/$/, '') + '/reset-password';
  return sendMail({
    to,
    subject: 'Your Reboot Cord password was reset',
    text: `Your new password is: ${newPassword}\n\nReady to reset it again? ${resetUrl}`,
    html: `<p>Your new password is: <strong>${esc(newPassword)}</strong></p><p><a href="${resetUrl}" style="color:#3b82f6;text-decoration:none">Ready to reset it again?</a></p>`,
  });
}

function renderTemplate(str, vars) {
  if (typeof str !== 'string') return '';
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

function deriveFirstNameFromEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return 'there';
  const local = email.split('@')[0];
  const parts = local.split(/[._+\-0-9]+/).filter(Boolean);
  const first = parts[0] || local;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function isSmtpConfigured() {
  return !!transporter;
}

function smtpStatus() {
  return { configured: !!transporter, verified, error: lastVerifyError };
}

module.exports = { sendMail, sendWelcomeEmail, sendPasswordResetConfirmation, isValidEmail, renderTemplate, deriveFirstNameFromEmail, isSmtpConfigured, smtpStatus };
