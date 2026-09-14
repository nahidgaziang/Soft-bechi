/**
 * scripts/3-send-meeting-link.js
 * Stage 3: Send Calendly Kickoff Meeting Link
 * Nodemailer Dispatch → HubSpot Deal Stage Update → Slack Notification
 *
 * Usage:
 *   node scripts/3-send-meeting-link.js "john@acme.com" "John Doe"
 */

require('dotenv').config();
const { sendCalendlyInvite } = require('../utils/email-sender');
const { updateDealStage } = require('../utils/hubspot-client');
const { notifyMeetingScheduled } = require('../utils/slack-notify');

async function sendMeetingLink(args = process.argv.slice(2)) {
  const clientEmail = args[0] || 'john@example.com';
  const clientName = args[1] || 'John Doe';
  const customLink = args[2] || process.env.CALENDLY_LINK || 'https://calendly.com/softwarebechi/kickoff-meeting';

  console.log('\n============================================================');
  console.log('📅 SOFTWARE BECHI — Dispatch Calendly Kickoff Meeting');
  console.log('============================================================');
  console.log(`👤 Recipient: ${clientName} <${clientEmail}>`);
  console.log(`🔗 Link:      ${customLink}`);
  console.log('------------------------------------------------------------\n');

  try {
    // 1. Send Email (or print simulation)
    console.log('📧 [Step 1/3] Sending kickoff meeting email with Calendly link...');
    const emailRes = await sendCalendlyInvite(clientEmail, clientName, customLink);
    console.log(`   ↳ Email Status: ${emailRes.simulated ? 'Printed to Console (Simulation)' : 'Dispatched via SMTP'}`);

    // 2. Update HubSpot Deal Stage
    console.log('\n📊 [Step 2/3] Moving HubSpot deal to "Presentation/Meeting Scheduled"...');
    const stageMeeting = process.env.HUBSPOT_STAGE_PRESENTATION || 'presentationscheduled';
    await updateDealStage('sim_meeting_deal', stageMeeting);
    console.log(`   ↳ HubSpot Deal Stage: ${stageMeeting}`);

    // 3. Notify Slack
    console.log('\n💬 [Step 3/3] Notifying Slack channel #new-clients...');
    await notifyMeetingScheduled({
      email: clientEmail,
      name: clientName,
      calendlyLink: customLink
    });
    console.log('   ↳ Slack updated.');

    console.log('\n============================================================');
    console.log('🎉 KICKOFF INVITATION DISPATCHED!');
    console.log('============================================================');
    console.log(`Next Action: After kickoff call concludes, send the Stripe payment link.`);
    console.log(`To create and email the Stripe payment link, run:`);
    console.log(`  node scripts/4-send-payment-link.js "${clientEmail}" "${clientName}" "Acme Corp" "Software MVP" 100000`);
    console.log('============================================================\n');

    return {
      success: true,
      email: clientEmail,
      calendlyLink: customLink
    };
  } catch (err) {
    console.error('\n❌ Failed to dispatch meeting link:', err.message);
    return { success: false, error: err.message };
  }
}

if (require.main === module) {
  sendMeetingLink();
}

module.exports = { sendMeetingLink };
