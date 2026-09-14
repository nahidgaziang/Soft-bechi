/**
 * scripts/1-onboard-client.js
 * Stage 1: Full Onboarding Pipeline
 * Slack Alert → HubSpot Contact & Deal → Contract Generation → SignWell E-Sign
 *
 * Usage:
 *   node scripts/1-onboard-client.js "John Doe" "john@acme.com" "Acme Corp" "Web Development" 5000
 */

require('dotenv').config();
const { notifyNewClient, notifyContractSent } = require('../utils/slack-notify');
const { createContact, createDeal } = require('../utils/hubspot-client');
const { createDocument } = require('../utils/signwell-client');

async function runOnboard(args = process.argv.slice(2)) {
  const clientName = args[0] || 'John Doe';
  const clientEmail = args[1] || 'john@example.com';
  const companyName = args[2] || 'Acme Innovations';
  const projectType = args[3] || 'Enterprise Web Application';
  const amount = parseFloat(args[4]) || 5000;

  console.log('\n============================================================');
  console.log('🏢 SOFTWARE BECHI — Automated Client Onboarding Pipeline');
  console.log('============================================================');
  console.log(`👤 Client:   ${clientName} <${clientEmail}>`);
  console.log(`🏢 Company:  ${companyName}`);
  console.log(`💼 Scope:    ${projectType}`);
  console.log(`💰 Deal:     $${amount.toLocaleString()}`);
  console.log('------------------------------------------------------------\n');

  try {
    // ── STEP 1: Notify Slack #new-clients ──
    console.log('💬 [Step 1/4] Sending Slack notification to #new-clients...');
    const slackRes = await notifyNewClient({
      name: clientName,
      email: clientEmail,
      company: companyName,
      projectType,
      amount
    });
    console.log(`   ↳ Slack Status: ${slackRes.simulated ? 'Simulated' : 'Dispatched'}`);

    // ── STEP 2: Record in HubSpot CRM (Contact & Deal) ──
    console.log('\n📊 [Step 2/4] Recording Contact & Deal in HubSpot CRM...');
    const contact = await createContact(clientName, clientEmail, companyName);
    console.log(`   ↳ HubSpot Contact ID: ${contact.id} (${contact.simulated ? 'Simulated' : 'Created'})`);

    const dealTitle = `${companyName} — ${projectType}`;
    const deal = await createDeal(dealTitle, amount, contact.id);
    console.log(`   ↳ HubSpot Deal ID:    ${deal.id} (${deal.simulated ? 'Simulated' : 'Created'})`);

    // ── STEP 3: Generate Contract & Send via SignWell ──
    console.log('\n📄 [Step 3/4] Generating Agreement & Sending via SignWell API...');
    const signwellDoc = await createDocument({
      clientName,
      clientEmail,
      companyName,
      projectType,
      amount
    });
    console.log(`   ↳ SignWell Doc ID:    ${signwellDoc.id}`);
    console.log(`   ↳ Status:             ${signwellDoc.status}`);
    if (signwellDoc.signingUrl) {
      console.log(`   ↳ Signing URL:        ${signwellDoc.signingUrl}`);
    }

    // ── STEP 4: Update Slack with SignWell Doc ID ──
    console.log('\n💬 [Step 4/4] Updating Slack with SignWell details...');
    await notifyContractSent({
      name: clientName,
      email: clientEmail,
      company: companyName,
      docId: signwellDoc.id,
      signingUrl: signwellDoc.signingUrl
    });
    console.log('   ↳ Slack updated.');

    console.log('\n============================================================');
    console.log('🎉 STAGE 1 ONBOARDING COMPLETED SUCCESSFULLY!');
    console.log('============================================================');
    console.log(`Next Action: Client will sign the document via SignWell.`);
    console.log(`To verify the signature when complete, run:`);
    console.log(`  node scripts/2-check-signature.js "${signwellDoc.id}"`);
    console.log('============================================================\n');

    return {
      success: true,
      client: { name: clientName, email: clientEmail, company: companyName },
      hubspot: { contactId: contact.id, dealId: deal.id },
      signwell: { id: signwellDoc.id, status: signwellDoc.status, signingUrl: signwellDoc.signingUrl }
    };
  } catch (err) {
    console.error('\n❌ Onboarding Pipeline Failed:', err);
    return { success: false, error: err.message };
  }
}

// Run directly if executed as main module
if (require.main === module) {
  runOnboard();
}

module.exports = { runOnboard };
