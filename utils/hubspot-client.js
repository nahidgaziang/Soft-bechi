/**
 * utils/hubspot-client.js
 * HubSpot CRM v3 API Wrapper (Contacts & Deals)
 */

require('dotenv').config();

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const BASE_URL = 'https://api.hubapi.com';

/**
 * Check if real HubSpot token is configured
 */
function isConfigured() {
  return HUBSPOT_TOKEN && !HUBSPOT_TOKEN.includes('your-hubspot-token');
}

/**
 * Create or retrieve a HubSpot Contact
 * @param {string} name - Full Name
 * @param {string} email - Email
 * @param {string} company - Company Name
 */
async function createContact(name, email, company) {
  if (!isConfigured()) {
    console.log(`📊 [HUBSPOT SIMULATION] Contact created: ${name} (${email}) at ${company}`);
    return { id: 'sim_contact_' + Date.now(), email, name, simulated: true };
  }

  const nameParts = (name || '').trim().split(' ');
  const firstname = nameParts[0] || 'Client';
  const lastname = nameParts.slice(1).join(' ') || 'Lead';

  try {
    const res = await fetch(`${BASE_URL}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          email,
          firstname,
          lastname,
          company,
          lifecyclestage: 'lead'
        }
      })
    });

    const data = await res.json();

    // If contact already exists (409 Conflict), lookup existing contact ID
    if (res.status === 409) {
      console.log(`ℹ️ HubSpot Contact with email ${email} already exists. Fetching existing...`);
      const lookupRes = await fetch(`${BASE_URL}/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`, {
        headers: { 'Authorization': `Bearer ${HUBSPOT_TOKEN}` }
      });
      if (lookupRes.ok) {
        const existingData = await lookupRes.json();
        return { id: existingData.id, email, name, existing: true };
      }
    }

    if (!res.ok) {
      throw new Error(data.message || `HubSpot HTTP ${res.status}`);
    }

    return { id: data.id, email, name, simulated: false };
  } catch (err) {
    console.error('❌ HubSpot Contact Error:', err.message);
    return { id: 'mock_contact_err_' + Date.now(), email, name, error: err.message, simulated: true };
  }
}

/**
 * Create a HubSpot Deal and associate with Contact
 * @param {string} dealName - Title of the deal
 * @param {number} amount - Deal amount in USD
 * @param {string} contactId - HubSpot Contact ID to associate
 * @param {string} stageId - Initial deal stage ID
 */
async function createDeal(dealName, amount, contactId, stageId = null) {
  if (!isConfigured()) {
    console.log(`📊 [HUBSPOT SIMULATION] Deal created: "${dealName}" for $${amount}`);
    return { id: 'sim_deal_' + Date.now(), dealName, amount, simulated: true };
  }

  const pipeline = process.env.HUBSPOT_PIPELINE_ID || 'default';
  const stage = stageId || process.env.HUBSPOT_STAGE_APPOINTMENT_SCHEDULED || 'appointmentscheduled';

  const body = {
    properties: {
      dealname: dealName,
      amount: String(amount),
      pipeline,
      dealstage: stage
    }
  };

  // Associate deal with contact if contactId provided and not simulated
  if (contactId && !contactId.startsWith('sim_') && !contactId.startsWith('mock_')) {
    body.associations = [
      {
        to: { id: contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] // 3 = deal_to_contact
      }
    ];
  }

  try {
    const res = await fetch(`${BASE_URL}/crm/v3/objects/deals`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `HubSpot HTTP ${res.status}`);
    }

    return { id: data.id, dealName, amount, simulated: false };
  } catch (err) {
    console.error('❌ HubSpot Deal Error:', err.message);
    return { id: 'sim_deal_err_' + Date.now(), dealName, amount, error: err.message, simulated: true };
  }
}

/**
 * Update Deal Stage (moves deal through pipeline)
 * @param {string} dealId - HubSpot Deal ID
 * @param {string} newStageId - Target stage ID
 */
async function updateDealStage(dealId, newStageId) {
  if (!dealId || !/^\d+$/.test(String(dealId)) || !isConfigured() || String(dealId).startsWith('sim_') || String(dealId).startsWith('mock_')) {
    console.log(`📊 [HUBSPOT] Deal stage update recorded for ${dealId} -> stage: ${newStageId}`);
    return { success: true, dealId, stage: newStageId, simulated: true };
  }

  try {
    const res = await fetch(`${BASE_URL}/crm/v3/objects/deals/${dealId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          dealstage: newStageId
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `HubSpot HTTP ${res.status}`);
    }

    return { success: true, dealId, stage: newStageId, data, simulated: false };
  } catch (err) {
    console.error('❌ HubSpot Deal Update Error:', err.message);
    return { success: false, dealId, error: err.message, simulated: true };
  }
}

module.exports = {
  createContact,
  createDeal,
  updateDealStage,
  isConfigured
};
