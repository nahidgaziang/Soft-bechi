/**
 * server.js
 * SOFTWARE BECHI — Central Orchestrator & Admin Web Server
 */

require('dotenv').config();
const path = require('path');
const express = require('express');

const {
  notifyNewClient,
  notifyContractSent,
  notifyAdminCounterSignPending,
  notifyContractSigned,
  notifyMeetingScheduled,
  notifyPaymentSent
} = require('./utils/slack-notify');

const {
  createContact,
  createDeal,
  updateDealStage,
  isConfigured: isHubSpotConfigured
} = require('./utils/hubspot-client');

const {
  createDocument,
  getDocumentStatus,
  getCompletedPdfBuffer,
  isConfigured: isSignWellConfigured
} = require('./utils/signwell-client');

const {
  createPaymentLink,
  isConfigured: isStripeConfigured
} = require('./utils/stripe-client');

const {
  sendContractInviteEmail,
  sendCalendlyInvite,
  sendPaymentEmail,
  sendCompletedContractEmail,
  isConfigured: isEmailConfigured
} = require('./utils/email-sender');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory sets to prevent duplicate dispatching
const deliveredCompletedEmails = new Set();
const notifiedPendingAdmin = new Set();
const docToDealMap = new Map();
const activePendingDocs = new Set();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname)));

// Page Routes
app.get('/onboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'onboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ────────────────────────────────────────────────────────────
// API ROUTES
// ────────────────────────────────────────────────────────────

/**
 * Health & Configuration Status Endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'SOFTWARE BECHI System Orchestrator',
    timestamp: new Date().toISOString(),
    services: {
      slack: {
        configured: !!(process.env.SLACK_BOT_TOKEN && !process.env.SLACK_BOT_TOKEN.includes('your-bot-token')),
        channel: process.env.SLACK_CHANNEL_ID || 'new-clients'
      },
      hubspot: {
        configured: isHubSpotConfigured(),
        pipeline: process.env.HUBSPOT_PIPELINE_ID || 'default'
      },
      signwell: {
        configured: isSignWellConfigured(),
        testMode: true
      },
      calendly: {
        configured: !!process.env.CALENDLY_LINK,
        link: process.env.CALENDLY_LINK || 'https://calendly.com/softwarebechi/kickoff'
      },
      stripe: {
        configured: isStripeConfigured(),
        mode: 'sandbox'
      },
      email: {
        configured: isEmailConfigured(),
        sender: process.env.EMAIL_USER || 'Simulation Mode'
      }
    }
  });
});

/**
 * 1. Onboard Client (Slack + HubSpot + SignWell)
 */
app.post('/api/onboard', async (req, res) => {
  const { name, email, company, projectType, amount } = req.body;

  if (!name || !email || !company) {
    return res.status(400).json({ success: false, error: 'Name, email, and company are required fields.' });
  }

  const numAmount = parseFloat(amount) || 5000;
  const projectScope = projectType || 'Enterprise Web Application';

  try {
    // 1. Notify Slack
    await notifyNewClient({
      name,
      email,
      company,
      projectType: projectScope,
      amount: numAmount
    });

    // 2. HubSpot Contact & Deal
    const contact = await createContact(name, email, company);
    const dealTitle = `${company} — ${projectScope}`;
    const deal = await createDeal(dealTitle, numAmount, contact.id);

    // 3. Generate & Dispatch SignWell Contract
    const signwellDoc = await createDocument({
      clientName: name,
      clientEmail: email,
      companyName: company,
      projectType: projectScope,
      amount: numAmount
    });

    if (deal && deal.id && signwellDoc && signwellDoc.id) {
      docToDealMap.set(signwellDoc.id, deal.id);
      if (!signwellDoc.simulated) {
        activePendingDocs.add(signwellDoc.id);
      }
    }

    // 4. Send Contract Signing Email directly to Client Inbox
    if (email && signwellDoc && signwellDoc.signingUrl) {
      await sendContractInviteEmail(email, name, company, signwellDoc.signingUrl);
    }

    // 5. Update Slack with SignWell Doc ID
    await notifyContractSent({
      name,
      email,
      company,
      docId: signwellDoc.id,
      signingUrl: signwellDoc.signingUrl
    });

    res.json({
      success: true,
      message: 'Client successfully ingested into pipeline.',
      client: { name, email, company },
      hubspot: { contactId: contact.id, dealId: deal.id },
      signwell: {
        id: signwellDoc.id,
        status: signwellDoc.status,
        signingUrl: signwellDoc.signingUrl,
        simulated: signwellDoc.simulated
      },
      slackChannel: process.env.SLACK_CHANNEL_ID || 'new-clients'
    });
  } catch (err) {
    console.error('API /api/onboard Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin Authentication: Login
 */
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = (process.env.ADMIN_USERNAME || 'admin').trim();
  const validPass = (process.env.ADMIN_PASSWORD || 'softwarebechi2026').trim();
  const secretToken = process.env.ADMIN_SECRET_TOKEN || 'sb_sec_token_99182371982';

  if (username && password && username.trim() === validUser && password.trim() === validPass) {
    return res.json({
      success: true,
      token: secretToken,
      username: validUser,
      message: 'Admin authentication verified.'
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid administrator credentials. Access denied.'
  });
});

/**
 * Admin Authentication: Verify Session Token
 */
app.get('/api/admin/verify-session', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const secretToken = process.env.ADMIN_SECRET_TOKEN || 'sb_sec_token_99182371982';

  if (token && token === secretToken) {
    return res.json({ success: true, authenticated: true });
  }

  return res.status(401).json({ success: false, authenticated: false, error: 'Unauthorized' });
});

/**
 * Stream or Download Completed Executed Contract PDF
 */
app.get('/api/contract/:docId/pdf', async (req, res) => {
  const { docId } = req.params;

  try {
    const pdfBuffer = await getCompletedPdfBuffer(docId);

    if (pdfBuffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Master_Services_Agreement_${docId}.pdf"`);
      return res.send(pdfBuffer);
    }

    // Fallback if simulated or not ready
    const statusData = await getDocumentStatus(docId);
    if (statusData.isCompleted) {
      return res.redirect(`https://www.signwell.com/api/v1/documents/${docId}/completed_pdf`);
    }

    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Contract In Progress | SOFTWARE BECHI</title><link rel="stylesheet" href="/style.css"></head>
      <body style="background:#0b0f19;color:#fff;font-family:Inter,sans-serif;padding:60px;text-align:center;">
        <h2 style="color:#2563eb;">Document Not Yet Executed</h2>
        <p style="color:#94a3b8;">Document <code>${docId}</code> is awaiting dual signatures.</p>
        <p><a href="/admin" style="color:#60a5fa;text-decoration:underline;">Return to Admin Operations Console</a></p>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('API /api/contract/:docId/pdf Error:', err);
    res.status(500).send('Error retrieving completed document: ' + err.message);
  }
});

/**
 * HTML Email Previews (for verification and demonstration)
 */
app.get('/api/preview-email/calendly', (req, res) => {
  const clientName = req.query.name || 'Nahid Gazi';
  const link = process.env.CALENDLY_LINK || 'https://calendly.com/nahidgazi-ang/30min';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Preview: Calendly Kickoff | SOFTWARE BECHI</title>
      <style>body { background: #0b0f19; padding: 40px; font-family: -apple-system, sans-serif; display: flex; justify-content: center; }</style>
    </head>
    <body>
      <div style="font-family: Arial, sans-serif; max-width: 600px; width: 100%; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
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
          <a href="${link}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
            📅 Pick Your Kickoff Time on Calendly
          </a>
        </div>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
          Or copy and paste this link in your browser: <br>
          <a href="${link}" target="_blank" style="color: #2563eb;">${link}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
          SOFTWARE BECHI Inc. • High-Impact Software Engineering
        </p>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/preview-email/contract', (req, res) => {
  const clientName = req.query.name || 'Nahid Gazi';
  const company = req.query.company || 'ang.inc';
  const docId = req.query.docId || 'sample-doc-id';
  const downloadUrl = `${req.protocol}://${req.get('host')}/api/contract/${docId}/pdf`;
  const bookingLink = process.env.CALENDLY_LINK || 'https://calendly.com/nahidgazi-ang/30min';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Preview: Executed Contract | SOFTWARE BECHI</title>
      <style>body { background: #0b0f19; padding: 40px; font-family: -apple-system, sans-serif; display: flex; justify-content: center; }</style>
    </head>
    <body>
      <div style="font-family: Arial, sans-serif; max-width: 600px; width: 100%; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0;">SOFTWARE <span style="color: #2563eb;">BECHI</span></h2>
        </div>
        <p style="font-size: 16px; color: #334155;">Hi <strong>${clientName}</strong>,</p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6;">
          Great news! Your Master Services Agreement for <strong>${company}</strong> has been electronically executed and counter-signed by SOFTWARE BECHI Inc.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 18px; margin: 24px 0;">
          <div style="font-size: 14px; font-weight: bold; color: #166534;">✅ Dual Signatures Complete &amp; Locked</div>
          <div style="font-size: 13px; color: #15803d; margin-top: 4px;">
            Includes full audit trail and Certificate of Completion under ESIGN &amp; UETA standards.
          </div>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${downloadUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
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
          <a href="${bookingLink}" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
            📅 Book Kickoff on Calendly
          </a>
          <div style="font-size: 12px; color: #64748b; margin-top: 10px;">
            Direct link: <a href="${bookingLink}" target="_blank" style="color: #2563eb;">${bookingLink}</a>
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
    </body>
    </html>
  `);
});

app.get('/api/preview-email/payment', (req, res) => {
  const clientName = req.query.name || 'Nahid Gazi';
  const company = req.query.company || 'ang.inc';
  const amount = req.query.amount || '5,000';
  const paymentUrl = req.query.url || 'https://buy.stripe.com/test_bJeaEWdr4ct2cif2nH4Rq03';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Preview: Stripe Payment Invoice | SOFTWARE BECHI</title>
      <style>body { background: #0b0f19; padding: 40px; font-family: -apple-system, sans-serif; display: flex; justify-content: center; }</style>
    </head>
    <body>
      <div style="font-family: Arial, sans-serif; max-width: 600px; width: 100%; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0;">SOFTWARE <span style="color: #2563eb;">BECHI</span></h2>
        </div>
        <p style="font-size: 16px; color: #334155;">Hi <strong>${clientName}</strong>,</p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6;">
          Following our technical kickoff session for <strong>${company}</strong>, here is your secure electronic payment link for the project milestone.
        </p>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin: 24px 0;">
          <div style="font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: bold;">Amount Due</div>
          <div style="font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 4px;">$${amount} USD</div>
          <div style="font-size: 12px; color: #10b981; margin-top: 6px;">🔒 Protected by Stripe 256-Bit SSL Encryption</div>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${paymentUrl}" target="_blank" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
            💳 Complete Secure Payment
          </a>
        </div>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
          Direct payment URL: <br>
          <a href="${paymentUrl}" target="_blank" style="color: #2563eb;">${paymentUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
          SOFTWARE BECHI Inc. • Secure Sandbox Billing via Stripe
        </p>
      </div>
    </body>
    </html>
  `);
});

/**
 * Core processor for document status progression (called by API & background sync)
 */
async function processDocumentStatus(docId, hostUrl) {
  const statusData = await getDocumentStatus(docId);
  const downloadUrl = `${hostUrl}/api/contract/${docId}/pdf`;

  // Case 1: Client signed, Admin pending counter-signature
  if (statusData.adminPending && !notifiedPendingAdmin.has(docId)) {
    notifiedPendingAdmin.add(docId);
    await notifyAdminCounterSignPending({
      name: statusData.clientName,
      email: statusData.clientEmail,
      company: statusData.company,
      docId,
      adminSigningUrl: statusData.adminSigningUrl
    });
  }

  // Case 2: Both parties signed -> Completed!
  if (statusData.isCompleted) {
    // Update HubSpot stage to contract signed
    const stage = process.env.HUBSPOT_STAGE_CONTRACT_SENT || '4295016135';
    const targetDealId = docToDealMap.get(docId) || docId;
    await updateDealStage(targetDealId, stage);

    // Send executed document & certificate to client if not yet dispatched
    if (!deliveredCompletedEmails.has(docId) && statusData.clientEmail) {
      deliveredCompletedEmails.add(docId);

      const pdfBuffer = await getCompletedPdfBuffer(docId);
      const calendlyUrl = process.env.CALENDLY_LINK || 'https://calendly.com/nahidgazi-ang/30min';

      // 1. Send Executed Agreement (with attached PDF & Calendly Next Step button)
      await sendCompletedContractEmail(
        statusData.clientEmail,
        statusData.clientName,
        statusData.company,
        docId,
        downloadUrl,
        pdfBuffer,
        calendlyUrl
      );

      // 2. Automatically dispatch standalone Calendly Kickoff invite as well!
      await sendCalendlyInvite(statusData.clientEmail, statusData.clientName, calendlyUrl);

      // 3. Notify Slack with Executed PDF Download Link
      await notifyContractSigned({
        company: statusData.company,
        clientEmail: statusData.clientEmail,
        docId,
        downloadUrl
      });

      // 4. Also notify Slack of automatic kickoff invite dispatch
      await notifyMeetingScheduled({
        email: statusData.clientEmail,
        name: statusData.clientName,
        calendlyLink: calendlyUrl
      });
    }
  }

  return { statusData, downloadUrl };
}

// Background auto-polling sync (every 60 seconds for pending documents)
setInterval(async () => {
  if (activePendingDocs.size === 0) return;
  for (const docId of Array.from(activePendingDocs)) {
    try {
      const { statusData } = await processDocumentStatus(docId, `http://localhost:${PORT}`);
      if (statusData && statusData.isCompleted) {
        activePendingDocs.delete(docId);
        console.log(`🎉 [AUTO-SYNC] Document ${docId} fully completed. Executed agreement and Calendly invite delivered.`);
      }
    } catch (e) {
      // Quiet background error catch
    }
  }
}, 60000);

/**
 * 2. Check SignWell Signature Status & Auto-Deliver Executed Doc
 */
app.get('/api/check-signature/:docId', async (req, res) => {
  const { docId } = req.params;
  const hostUrl = `${req.protocol}://${req.get('host')}`;

  try {
    const { statusData, downloadUrl } = await processDocumentStatus(docId, hostUrl);

    res.json({
      success: true,
      docId,
      company: statusData.company,
      clientName: statusData.clientName,
      clientEmail: statusData.clientEmail,
      adminName: statusData.adminName,
      adminEmail: statusData.adminEmail,
      status: statusData.status,
      isCompleted: statusData.isCompleted,
      adminPending: statusData.adminPending,
      adminSigningUrl: statusData.adminSigningUrl,
      clientSigningUrl: statusData.clientSigningUrl,
      completedPdfUrl: downloadUrl,
      emailDispatched: deliveredCompletedEmails.has(docId),
      recipients: statusData.recipients || [],
      simulated: statusData.simulated
    });
  } catch (err) {
    console.error('API /api/check-signature Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. Dispatch Calendly Kickoff Link
 */
app.post('/api/send-meeting', async (req, res) => {
  const { email, name, calendlyLink } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Recipient email is required.' });
  }

  const clientName = name || 'Client Partner';
  const link = calendlyLink || process.env.CALENDLY_LINK || 'https://calendly.com/softwarebechi/kickoff-meeting';

  try {
    const emailRes = await sendCalendlyInvite(email, clientName, link);

    // Update HubSpot deal stage
    const stage = process.env.HUBSPOT_STAGE_PRESENTATION || 'presentationscheduled';
    await updateDealStage('meeting_deal_' + Date.now(), stage);

    // Notify Slack
    await notifyMeetingScheduled({
      email,
      name: clientName,
      calendlyLink: link
    });

    res.json({
      success: true,
      message: 'Calendly kickoff invitation dispatched.',
      email,
      calendlyLink: link,
      emailDelivered: emailRes ? emailRes.sent : false,
      messageId: emailRes ? emailRes.messageId : null,
      smtpResponse: emailRes ? emailRes.response : null,
      simulated: emailRes ? emailRes.simulated : true
    });
  } catch (err) {
    console.error('API /api/send-meeting Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Dispatch Stripe Payment Link
 */
app.post('/api/send-payment', async (req, res) => {
  const { email, name, company, service, amount } = req.body;

  if (!email || !company) {
    return res.status(400).json({ success: false, error: 'Email and company name are required.' });
  }

  const clientName = name || 'Client Partner';
  const serviceName = service || 'Milestone Deliverable';
  const amountInCents = Math.round((parseFloat(amount) || 1000) * 100);

  try {
    // 1. Create Stripe Payment Link
    const stripeRes = await createPaymentLink({
      clientName,
      clientCompany: company,
      serviceName,
      amountInCents
    });

    // 2. Email invoice to client
    const emailRes = await sendPaymentEmail(email, clientName, company, stripeRes.url, amountInCents);

    // 3. Move HubSpot deal to Closed Won
    const stage = process.env.HUBSPOT_STAGE_CLOSED_WON || 'closedwon';
    await updateDealStage('paid_deal_' + Date.now(), stage);

    // 4. Notify Slack
    await notifyPaymentSent({
      company,
      email,
      amount: amountInCents,
      paymentUrl: stripeRes.url
    });

    res.json({
      success: true,
      message: 'Stripe Sandbox Payment Link generated & emailed.',
      paymentUrl: stripeRes.url,
      amountInCents,
      emailDelivered: emailRes ? emailRes.sent : false,
      messageId: emailRes ? emailRes.messageId : null,
      smtpResponse: emailRes ? emailRes.response : null,
      simulated: stripeRes.simulated,
      emailSimulated: emailRes ? emailRes.simulated : true
    });
  } catch (err) {
    console.error('API /api/send-payment Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log('\n============================================================');
  console.log('🏢 SOFTWARE BECHI — Orchestration Server Online');
  console.log(`🚀 Landing Page & Console: http://localhost:${PORT}`);
  console.log('============================================================\n');
});

module.exports = app;
