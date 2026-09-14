/**
 * utils/slack-notify.js
 * Slack Notification Utility using Web API / Bolt
 */

require('dotenv').config();

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

/**
 * Send a message to Slack channel via Slack Web API
 * @param {string} text - Fallback plain text
 * @param {Array} blocks - Optional Slack Block Kit blocks
 */
async function sendSlackMessage(text, blocks = null) {
  if (!BOT_TOKEN || BOT_TOKEN.includes('your-bot-token')) {
    console.log(`\n💬 [SLACK SIMULATION - No Token]:\n${text}\n`);
    return { ok: true, simulated: true, channel: CHANNEL_ID || 'new-clients' };
  }

  try {
    const payload = {
      channel: CHANNEL_ID || '#new-clients',
      text
    };
    if (blocks) payload.blocks = blocks;

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!data.ok) {
      console.warn(`⚠️ Slack API Warning: ${data.error}. Falling back to simulation.`);
      return { ok: false, error: data.error, simulated: true };
    }

    return data;
  } catch (err) {
    console.error('❌ Slack Network Error:', err.message);
    return { ok: false, error: err.message, simulated: true };
  }
}

/**
 * Notify when a new client is identified/onboarded
 */
async function notifyNewClient({ name, email, company, projectType, amount }) {
  const text = `🚀 *New Client Onboarding Initiated: ${company}*\n• *Contact:* ${name} (<mailto:${email}|${email}>)\n• *Project:* ${projectType}\n• *Deal Value:* $${amount.toLocaleString()}`;
  
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🚀 New Client Onboarding — SOFTWARE BECHI', emoji: true }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Company:*\n${company}` },
        { type: 'mrkdwn', text: `*Contact Person:*\n${name}` },
        { type: 'mrkdwn', text: `*Email:*\n${email}` },
        { type: 'mrkdwn', text: `*Estimated Value:*\n$${amount.toLocaleString()}` },
        { type: 'mrkdwn', text: `*Project Domain:*\n${projectType}` },
        { type: 'mrkdwn', text: `*Status:*\nSyncing HubSpot & SignWell` }
      ]
    },
    { type: 'divider' }
  ];

  return sendSlackMessage(text, blocks);
}

/**
 * Notify when contract document is dispatched to SignWell
 */
async function notifyContractSent({ name, email, company, docId, signingUrl }) {
  const text = `📄 *SignWell Contract Dispatched:* ${company} (${email})\nDoc ID: \`${docId}\``;
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📄 *Contract Sent for E-Signature*\nAgreement dispatched to *${name}* (${company}) via SignWell.\n*Document ID:* \`${docId}\``
      }
    }
  ];
  if (signingUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open SignWell Document', emoji: true },
          url: signingUrl,
          style: 'primary'
        }
      ]
    });
  }
  return sendSlackMessage(text, blocks);
}

/**
 * Notify when client signs and admin counter-signature is required
 */
async function notifyAdminCounterSignPending({ name, email, company, docId, adminSigningUrl }) {
  const text = `✍️ *Client Signed — Admin Counter-Signature Required: ${company}*\n${name} (${email}) has signed! Admin must counter-sign.\nDoc ID: \`${docId}\``;
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '✍️ Client Signed — Counter-Signature Needed', emoji: true }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Company:*\n${company}` },
        { type: 'mrkdwn', text: `*Signer:*\n${name} (${email})` },
        { type: 'mrkdwn', text: `*Document ID:*\n\`${docId}\`` },
        { type: 'mrkdwn', text: `*Status:*\nAwaiting Admin Counter-Sign` }
      ]
    }
  ];

  if (adminSigningUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✍️ Counter-Sign as Admin', emoji: true },
          url: adminSigningUrl,
          style: 'primary'
        }
      ]
    });
  }

  return sendSlackMessage(text, blocks);
}

/**
 * Notify when contract document is fully signed
 */
async function notifyContractSigned({ company, clientEmail, docId, downloadUrl }) {
  const text = `🎉 *CONTRACT FULLY EXECUTED & DELIVERED:* ${company} (Doc ID: ${docId})`;
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🎉 Contract Fully Executed — Both Parties Signed!', emoji: true }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Master Services Agreement for *${company}* is 100% complete! Both Client and Software Bechi signatures are locked with legal audit certificate.\n\n*Executed Document Dispatched:* Emailed to \`${clientEmail || 'Client'}\`.`
      }
    }
  ];

  if (downloadUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '📄 View Executed PDF', emoji: true },
          url: downloadUrl,
          style: 'primary'
        }
      ]
    });
  }

  return sendSlackMessage(text, blocks);
}

/**
 * Notify when Calendly link is emailed
 */
async function notifyMeetingScheduled({ email, name, calendlyLink }) {
  const text = `📅 *Kickoff Invite Sent:* ${name} (${email})\nCalendly: ${calendlyLink}`;
  return sendSlackMessage(text);
}

/**
 * Notify when Stripe Payment Link is generated & dispatched
 */
async function notifyPaymentSent({ company, email, amount, paymentUrl }) {
  const text = `💰 *Stripe Payment Link Dispatched:* ${company} ($${(amount / 100).toLocaleString()})\nURL: ${paymentUrl}`;
  return sendSlackMessage(text);
}

module.exports = {
  sendSlackMessage,
  notifyNewClient,
  notifyContractSent,
  notifyAdminCounterSignPending,
  notifyContractSigned,
  notifyMeetingScheduled,
  notifyPaymentSent
};
