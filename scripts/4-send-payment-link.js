/**
 * scripts/4-send-payment-link.js
 * Stage 4: Generate Stripe Payment Link & Dispatch Invoice
 * Stripe Sandbox Product & Link → Email Client → HubSpot Closed Won → Slack Alert
 *
 * Usage:
 *   node scripts/4-send-payment-link.js "john@acme.com" "John Doe" "Acme Corp" "MVP Milestone" 100000
 */

require('dotenv').config();
const { createPaymentLink } = require('../utils/stripe-client');
const { sendPaymentEmail } = require('../utils/email-sender');
const { updateDealStage } = require('../utils/hubspot-client');
const { notifyPaymentSent } = require('../utils/slack-notify');

async function sendPaymentLink(args = process.argv.slice(2)) {
  const clientEmail = args[0] || 'john@example.com';
  const clientName = args[1] || 'John Doe';
  const clientCompany = args[2] || 'Acme Innovations';
  const serviceName = args[3] || 'Phase 1: Architecture & Core Software';
  const amountInCents = parseInt(args[4], 10) || 100000; // Default $1,000 (100,000 cents)

  console.log('\n============================================================');
  console.log('💳 SOFTWARE BECHI — Stripe Sandbox Payment Generation');
  console.log('============================================================');
  console.log(`👤 Client:   ${clientName} <${clientEmail}>`);
  console.log(`🏢 Company:  ${clientCompany}`);
  console.log(`💼 Scope:    ${serviceName}`);
  console.log(`💰 Amount:   $${(amountInCents / 100).toLocaleString()} USD`);
  console.log('------------------------------------------------------------\n');

  try {
    // 1. Generate Stripe Payment Link
    console.log('💳 [Step 1/4] Generating Stripe Sandbox Payment Link...');
    const stripeRes = await createPaymentLink({
      clientName,
      clientCompany,
      serviceName,
      amountInCents
    });
    console.log(`   ↳ Payment Link: ${stripeRes.url}`);
    console.log(`   ↳ Mode:         ${stripeRes.simulated ? 'Simulated' : 'Stripe Test API'}`);

    // 2. Email Payment Link to Client
    console.log('\n📧 [Step 2/4] Emailing invoice and payment link to client...');
    const emailRes = await sendPaymentEmail(
      clientEmail,
      clientName,
      clientCompany,
      stripeRes.url,
      amountInCents
    );
    console.log(`   ↳ Email Status: ${emailRes.simulated ? 'Printed to Console (Simulation)' : 'Dispatched'}`);

    // 3. Move Deal in HubSpot to Closed Won / Payment Pending
    console.log('\n📊 [Step 3/4] Updating HubSpot CRM deal stage...');
    const stageWon = process.env.HUBSPOT_STAGE_CLOSED_WON || 'closedwon';
    await updateDealStage('sim_paid_deal', stageWon);
    console.log(`   ↳ HubSpot Deal Stage: ${stageWon}`);

    // 4. Notify Slack #new-clients
    console.log('\n💬 [Step 4/4] Posting payment details in Slack #new-clients...');
    await notifyPaymentSent({
      company: clientCompany,
      email: clientEmail,
      amount: amountInCents,
      paymentUrl: stripeRes.url
    });
    console.log('   ↳ Slack updated.');

    console.log('\n============================================================');
    console.log('🏁 FULL ONBOARDING & PAYMENT CYCLE COMPLETED!');
    console.log('============================================================');
    console.log(`Summary:`);
    console.log(`  • Client:       ${clientName} (${clientCompany})`);
    console.log(`  • Invoice:      $${(amountInCents / 100).toLocaleString()}`);
    console.log(`  • Payment Link: ${stripeRes.url}`);
    console.log(`  • Test Card:    4242 4242 4242 4242 (Any future date & CVC)`);
    console.log('============================================================\n');

    return {
      success: true,
      clientEmail,
      amount: amountInCents,
      paymentUrl: stripeRes.url
    };
  } catch (err) {
    console.error('\n❌ Failed to generate payment link:', err.message);
    return { success: false, error: err.message };
  }
}

if (require.main === module) {
  sendPaymentLink();
}

module.exports = { sendPaymentLink };
