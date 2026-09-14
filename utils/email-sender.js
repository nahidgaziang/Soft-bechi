/**
 * utils/email-sender.js
 * Email Dispatcher using Nodemailer (with Console Simulation fallback)
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Software Bechi Team';

function isConfigured() {
  return EMAIL_USER && EMAIL_PASS && EMAIL_USER.includes('@') && !EMAIL_PASS.includes('xxxx');
}

/**
 * Send an email or log it to console if email credentials aren't set
 */
async function sendEmail({ to, subject, html, text, attachments = [] }) {
  if (!isConfigured()) {
    console.log(`\n========================================================`);
    console.log(`📧 [EMAIL SIMULATION — No SMTP Credentials]`);
    console.log(`To: ${to}`);
    console.log(`From: ${FROM_NAME} <${EMAIL_USER || 'no-reply@softwarebechi.com'}>`);
    console.log(`Subject: ${subject}`);
    if (attachments && attachments.length > 0) {
      console.log(`Attachments: ${attachments.map(a => a.filename).join(', ')}`);
    }
    console.log(`--------------------------------------------------------`);
    console.log(text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    console.log(`========================================================\n`);

    return { sent: true, simulated: true, to, subject };
  }

  try {
    const cleanPass = (EMAIL_PASS || '').replace(/\s+/g, '').trim();
    const cleanUser = (EMAIL_USER || '').trim();
    const cleanFrom = (FROM_NAME || 'SOFTWARE BECHI').replace(/["'\\]/g, '').trim();
    const cleanTo = (to || '').trim();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: cleanUser,
        pass: cleanPass
      }
    });

    const mailOptions = {
      from: `"${cleanFrom}" <${cleanUser}>`,
      replyTo: cleanUser,
      to: cleanTo,
      subject,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      html
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully to ${cleanTo} (Message ID: ${info.messageId})`);
    return {
      sent: true,
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      to: cleanTo,
      subject,
      simulated: false
    };
  } catch (err) {
    console.error('❌ Email Sending Error:', err.message);
    return { sent: false, error: err.message, to, subject, simulated: true };
  }
}

/**
 * Send Calendly Kickoff Meeting Link
 */
async function sendCalendlyInvite(toEmail, clientName, calendlyLink) {
  const link = calendlyLink || process.env.CALENDLY_LINK || 'https://calendly.com/softwarebechi/kickoff';
  const subject = `Schedule Your Project Kickoff Meeting — SOFTWARE BECHI`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0;">SOFTWARE <span style="color: #2563eb;">BECHI</span></h2>
      </div>
      <p style="font-size: 16px; color: #334155;">Hi <strong>${clientName}</strong>,</p>
      <p style="font-size: 15px; color: #475569; line-height: 1.6;">
        Great news! Your Master Services Agreement has been verified and executed.
      </p>
      <p style="font-size: 15px; color: #475569; line-height: 1.6;">
        We're thrilled to welcome you. The next step is our technical kickoff meeting where we will finalize architecture specs, milestone timelines, and deliverable handoffs.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${link}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
          📅 Pick Your Kickoff Time on Calendly
        </a>
      </div>
      <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
        Or copy and paste this link in your browser: <br>
        <a href="${link}" style="color: #2563eb;">${link}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        SOFTWARE BECHI Inc. • High-Impact Software Engineering
      </p>
    </div>
  `;

  const text = `Hi ${clientName},\n\nYour agreement is verified! Please schedule your kickoff meeting here: ${link}\n\nBest,\nSOFTWARE BECHI Team`;

  return sendEmail({ to: toEmail, subject, html, text });
}

/**
 * Send Stripe Payment Link
 */
async function sendPaymentEmail(toEmail, clientName, clientCompany, paymentUrl, amountInCents) {
  const formattedAmount = `$${(amountInCents / 100).toLocaleString()}`;
  const subject = `Invoice & Payment Link for ${clientCompany} — SOFTWARE BECHI`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0;">SOFTWARE <span style="color: #2563eb;">BECHI</span></h2>
      </div>
      <p style="font-size: 16px; color: #334155;">Hi <strong>${clientName}</strong>,</p>
      <p style="font-size: 15px; color: #475569; line-height: 1.6;">
        Following our kickoff session for <strong>${clientCompany}</strong>, here is your secure electronic payment link for the project milestone.
      </p>
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin: 24px 0;">
        <div style="font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: bold;">Amount Due</div>
        <div style="font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formattedAmount} USD</div>
        <div style="font-size: 12px; color: #10b981; margin-top: 6px;">🔒 Protected by Stripe 256-Bit SSL Encryption</div>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${paymentUrl}" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
          💳 Complete Secure Payment
        </a>
      </div>
      <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
        Direct payment URL: <br>
        <a href="${paymentUrl}" style="color: #2563eb;">${paymentUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        SOFTWARE BECHI Inc. • Secure Sandbox Billing via Stripe
      </p>
    </div>
  `;

  const text = `Hi ${clientName},\n\nYour invoice of ${formattedAmount} for ${clientCompany} is ready.\nPlease complete payment here: ${paymentUrl}\n\nBest,\nSOFTWARE BECHI Team`;

  return sendEmail({ to: toEmail, subject, html, text });
}

/**
 * Send Completed Executed Contract to Client
 */
async function sendCompletedContractEmail(toEmail, clientName, companyName, docId, downloadUrl = null, pdfBuffer = null, calendlyUrl = null) {
  const subject = `Executed Contract & Certificate of Completion — ${companyName} | SOFTWARE BECHI`;
  const viewLink = downloadUrl || `https://www.signwell.com/api/v1/documents/${docId}/completed_pdf`;
  const bookingLink = calendlyUrl || process.env.CALENDLY_LINK || 'https://calendly.com/nahidgazi-ang/30min';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0;">SOFTWARE <span style="color: #2563eb;">BECHI</span></h2>
      </div>
      <p style="font-size: 16px; color: #334155;">Hi <strong>${clientName}</strong>,</p>
      <p style="font-size: 15px; color: #475569; line-height: 1.6;">
        Great news! Your Master Services Agreement for <strong>${companyName}</strong> has been electronically executed and counter-signed by SOFTWARE BECHI Inc.
      </p>
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 18px; margin: 24px 0;">
        <div style="font-size: 14px; font-weight: bold; color: #166534;">✅ Dual Signatures Complete &amp; Locked</div>
        <div style="font-size: 13px; color: #15803d; margin-top: 4px;">
          Includes full audit trail and Certificate of Completion under ESIGN &amp; UETA standards.
        </div>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${viewLink}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
          📄 Download Completed Agreement PDF
        </a>
      </div>

      <!-- Immediate Next Step: Calendly Kickoff Scheduling -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 28px 0; text-align: center;">
        <div style="font-size: 15px; font-weight: bold; color: #0f172a; margin-bottom: 6px;">
          📅 Step 2: Schedule Technical Kickoff Meeting
        </div>
        <p style="font-size: 14px; color: #475569; margin: 0 0 16px 0; line-height: 1.5;">
          Please pick a convenient time on our calendar to finalize architecture specs, milestone timelines, and deliverable handoffs.
        </p>
        <a href="${bookingLink}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
          📅 Book Kickoff on Calendly
        </a>
        <div style="font-size: 12px; color: #64748b; margin-top: 10px;">
          Direct link: <a href="${bookingLink}" style="color: #2563eb;">${bookingLink}</a>
        </div>
      </div>

      <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
        Document ID: <code>${docId}</code>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        SOFTWARE BECHI Inc. • Master Services Agreement Execution
      </p>
    </div>
  `;

  const text = `Hi ${clientName},\n\nYour agreement for ${companyName} has been fully executed by both parties!\nDownload completed document: ${viewLink}\n\nSchedule your kickoff meeting here: ${bookingLink}\n\nBest,\nSOFTWARE BECHI Team`;

  const attachments = [];
  if (pdfBuffer) {
    attachments.push({
      filename: `Executed_Contract_${(companyName || 'Document').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    });
  }

  return sendEmail({ to: toEmail, subject, html, text, attachments });
}

/**
 * Send Initial SignWell Contract Signing Link to Client upon Onboarding
 */
async function sendContractInviteEmail(toEmail, clientName, companyName, signingUrl) {
  const subject = `Please Review & E-Sign Your Agreement — ${companyName} | SOFTWARE BECHI`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0;">SOFTWARE <span style="color: #2563eb;">BECHI</span></h2>
      </div>
      <p style="font-size: 16px; color: #334155;">Hi <strong>${clientName}</strong>,</p>
      <p style="font-size: 15px; color: #475569; line-height: 1.6;">
        Welcome to SOFTWARE BECHI! Your Master Services Agreement for <strong>${companyName}</strong> has been generated and is ready for your review and electronic signature.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${signingUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
          ✍️ Review &amp; Sign Agreement on SignWell
        </a>
      </div>
      <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
        Or copy and paste this link in your browser: <br>
        <a href="${signingUrl}" style="color: #2563eb;">${signingUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        SOFTWARE BECHI Inc. • Master Services Agreement Dispatch
      </p>
    </div>
  `;

  const text = `Hi ${clientName},\n\nYour Master Services Agreement for ${companyName} is ready for signing:\n${signingUrl}\n\nBest,\nSOFTWARE BECHI Team`;

  return sendEmail({ to: toEmail, subject, html, text });
}

module.exports = {
  sendEmail,
  sendContractInviteEmail,
  sendCalendlyInvite,
  sendPaymentEmail,
  sendCompletedContractEmail,
  isConfigured
};
