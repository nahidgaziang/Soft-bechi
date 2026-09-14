/**
 * scripts/2-check-signature.js
 * Stage 2: Manual Verification Step
 * Queries SignWell API for Document Status → Updates HubSpot Deal Stage → Slack Alert
 *
 * Usage:
 *   node scripts/2-check-signature.js "YOUR_SIGNWELL_DOC_ID"
 */

require('dotenv').config();
const { getDocumentStatus } = require('../utils/signwell-client');
const { updateDealStage } = require('../utils/hubspot-client');
const { notifyContractSigned } = require('../utils/slack-notify');

async function checkSignature(args = process.argv.slice(2)) {
  const docId = args[0] || 'sw_doc_sample';

  console.log('\n============================================================');
  console.log('🛡️  SOFTWARE BECHI — Document Verification & Audit Check');
  console.log('============================================================');
  console.log(`🔍 Inspecting SignWell Doc ID: ${docId}`);
  console.log('------------------------------------------------------------\n');

  try {
    const statusResult = await getDocumentStatus(docId);

    console.log(`📄 Overall Status:   ${statusResult.status.toUpperCase()}`);
    console.log(`✅ Fully Executed:   ${statusResult.isCompleted ? 'YES' : 'NO'}`);

    if (statusResult.recipients && statusResult.recipients.length > 0) {
      console.log('\n👥 Recipient Breakdown:');
      statusResult.recipients.forEach((r, idx) => {
        const checkMark = r.status === 'signed' ? '✅' : '⏳';
        console.log(`   ${idx + 1}. [${checkMark} ${r.status.toUpperCase()}] ${r.name} (${r.email})`);
      });
    }

    if (statusResult.isCompleted) {
      console.log('\n🛡️  VERIFICATION SUCCESS: All parties have electronically signed.');

      // Move deal in HubSpot to "Contract Sent / Signed" stage
      const stageSigned = process.env.HUBSPOT_STAGE_CONTRACT_SENT || 'contractsent';
      const hubspotUpdate = await updateDealStage(docId, stageSigned);
      console.log(`📊 HubSpot Deal Stage Updated: ${stageSigned}`);

      // Notify Slack
      await notifyContractSigned({ company: 'Client', docId });
      console.log('💬 Slack #new-clients notified of verified contract.');

      console.log('\n============================================================');
      console.log('🎉 VERIFICATION COMPLETE! READY FOR KICKOFF SCHEDULING.');
      console.log('============================================================');
      console.log(`Next Action: Send Calendly booking link to the client.`);
      console.log(`To send the kickoff invite, run:`);
      console.log(`  node scripts/3-send-meeting-link.js "client@example.com" "Client Name"`);
      console.log('============================================================\n');

      return { success: true, verified: true, docId, status: statusResult.status };
    } else {
      console.log('\n⏳ PENDING: One or more signatures are still outstanding.');
      console.log('Document is not yet fully executed.');
      return { success: true, verified: false, docId, status: statusResult.status };
    }
  } catch (err) {
    console.error('\n❌ Verification Failed:', err.message);
    return { success: false, error: err.message };
  }
}

if (require.main === module) {
  checkSignature();
}

module.exports = { checkSignature };
