const nodemailer = require('nodemailer');

let transporter = null;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Reboot Cord <no-reply@rebootcord.io>';

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

async function sendMail({ to, subject, text, html, fromName }) {
  if (!transporter || !isValidEmail(to)) return { sent: false, reason: !transporter ? 'SMTP not configured' : 'Invalid recipient' };
  const from = fromName ? `"${fromName.replace(/["\r\n]/g, '')}" <${EMAIL_FROM.replace(/^.*<|>$/g, '')}>` : EMAIL_FROM;
  try {
    await transporter.sendMail({ from, to, subject, text, html });
    return { sent: true };
  } catch (e) {
    console.warn('Email send failed:', e.message);
    return { sent: false, reason: e.message };
  }
}

function sendWelcomeEmail(to, username) {
  return sendMail({
    to,
    subject: 'Welcome to Reboot Cord',
    text: `Hey ${username}, your Reboot Cord account is ready. Log in to start hosting your Discord bot 24/7.`,
    html: `<p>Hey ${username},</p><p>Your Reboot Cord account is ready. Log in to start hosting your Discord bot 24/7.</p>`,
  });
}

function renderTemplate(str, vars) {
  if (typeof str !== 'string') return '';
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

module.exports = { sendMail, sendWelcomeEmail, isValidEmail, renderTemplate };
