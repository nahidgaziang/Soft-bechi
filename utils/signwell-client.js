/**
 * utils/signwell-client.js
 * SignWell REST API v1 Client for E-Signatures
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

const API_KEY = process.env.SIGNWELL_API_KEY;
const BASE_HOST = 'www.signwell.com';
const BASE_PATH = '/api/v1';

/**
 * Check if real SignWell API key is configured
 */
function isConfigured() {
  return API_KEY && !API_KEY.includes('your-signwell-api-key');
}

/**
 * Low-level Native HTTPS Request helper
 */
function rawSignwellRequest({ path: endpoint, method = 'GET', body = null, isBinary = false }) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

    const options = {
      hostname: BASE_HOST,
      port: 443,
      path: BASE_PATH + endpoint,
      method,
      headers: {
        'X-Api-Key': API_KEY,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': isBinary ? 'application/pdf' : 'application/json',
        'Connection': 'close'
      }
    };

    if (postData) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (isBinary) {
          return resolve({ status: res.statusCode, buffer, headers: res.headers });
        }
        try {
          const json = JSON.parse(buffer.toString('utf8'));
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: buffer.toString('utf8'), headers: res.headers });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Robust SignWell Request with Automatic Retry & Backoff
 */
async function signwellRequest(params, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await rawSignwellRequest(params);
    } catch (err) {
      if (attempt === retries) throw err;
      // Wait 1.2s before retrying to prevent Cloudflare connection drops
      await new Promise(r => setTimeout(r, 1200));
    }
  }
}

/**
 * Compile HTML contract template by replacing placeholders
 */
function compileContractTemplate(templatePath, data) {
  let content = fs.readFileSync(templatePath, 'utf8');

  const replacements = {
    '{{CLIENT_NAME}}': data.name || 'Valued Client',
    '{{CLIENT_EMAIL}}': data.email || 'client@example.com',
    '{{CLIENT_COMPANY}}': data.company || 'Client Organization',
    '{{PROJECT_TYPE}}': data.projectType || 'Software Engineering Deliverables',
    '{{DEAL_AMOUNT}}': (data.amount || 5000).toLocaleString(),
    '{{DATE}}': data.date || new Date().toISOString().split('T')[0],
    '{{ADMIN_NAME}}': data.adminName || process.env.SIGNWELL_SENDER_NAME || 'Nahid Gazi',
    '{{ADMIN_TITLE}}': data.adminTitle || process.env.SIGNWELL_SENDER_TITLE || 'Managing Director, SOFTWARE BECHI Inc.'
  };

  for (const [key, val] of Object.entries(replacements)) {
    content = content.replaceAll(key, val);
  }

  return content;
}

/**
 * Create a Document in SignWell & dispatch for e-signing
 */
async function createDocument(options = {}) {
  const clientName = options.clientName || options.name || 'Valued Client';
  const clientEmail = options.clientEmail || options.email || '';
  const companyName = options.companyName || options.company || 'Client Organization';
  const projectType = options.projectType || 'Software Engineering Deliverables';
  const amount = options.amount || 5000;
  const templatePath = options.templatePath || path.join(__dirname, '..', 'contract-template.html');

  const adminName = process.env.SIGNWELL_SENDER_NAME || 'Nahid Gazi';
  const adminTitle = process.env.SIGNWELL_SENDER_TITLE || 'Managing Director, SOFTWARE BECHI Inc.';
  const adminEmail = process.env.SIGNWELL_SENDER_EMAIL || 'admin@softwarebechi.com';

  // 1. Compile contract with client and admin data
  const compiledHtml = compileContractTemplate(templatePath, {
    name: clientName,
    email: clientEmail,
    company: companyName,
    projectType,
    amount,
    adminName,
    adminTitle
  });

  const fileBase64 = Buffer.from(compiledHtml, 'utf8').toString('base64');

  if (!isConfigured()) {
    const mockId = 'sw_doc_' + Math.random().toString(36).substring(2, 9);
    console.log(`\n📄 [SIGNWELL SIMULATION - No API Key]`);
    console.log(`Created document "${companyName} - Software Services Agreement"`);
    console.log(`Doc ID: ${mockId}`);

    return {
      id: mockId,
      name: `${companyName} - Software Agreement`,
      status: 'sent',
      test_mode: true,
      recipients: [
        { id: '1', name: clientName, email: clientEmail, status: 'sent', signing_url: `/api/preview-email/contract?name=${encodeURIComponent(clientName)}&company=${encodeURIComponent(companyName)}` },
        { id: '2', name: adminName, email: adminEmail, status: 'waiting', signing_url: `/api/preview-email/contract?name=${encodeURIComponent(adminName)}&company=${encodeURIComponent(companyName)}` }
      ],
      signingUrl: `/api/preview-email/contract?name=${encodeURIComponent(clientName)}&company=${encodeURIComponent(companyName)}`,
      simulated: true
    };
  }

  let effectiveAdminEmail = adminEmail || 'admin@softwarebechi.com';
  if (clientEmail && effectiveAdminEmail.toLowerCase().trim() === clientEmail.toLowerCase().trim()) {
    // SignWell rejects documents if recipient 1 and 2 share the exact same email
    effectiveAdminEmail = 'admin@softwarebechi.com';
  }

  // 2. Prepare SignWell Payload (Dual E-Signature: Client + Admin)
  const safeFilename = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const payload = {
    test_mode: true,
    name: `Master Services Agreement - ${companyName}`,
    subject: `Please sign your Software Agreement with SOFTWARE BECHI`,
    message: `Hi ${clientName}, please review and electronically execute the attached Master Services Agreement for your project.`,
    files: [
      {
        name: `Software_Agreement_${safeFilename}.html`,
        file_base64: fileBase64
      }
    ],
    recipients: [
      {
        id: '1',
        name: clientName,
        email: clientEmail,
        signing_order: 1
      },
      {
        id: '2',
        name: adminName,
        email: effectiveAdminEmail,
        signing_order: 2
      }
    ],
    fields: [
      [
        // Client signature inside left signature cell
        {
          x: 75,
          y: 460,
          width: 130,
          height: 40,
          page: 1,
          recipient_id: '1',
          type: 'signature',
          required: true
        },
        // Provider signature inside right signature cell (shifted right)
        {
          x: 415,
          y: 460,
          width: 130,
          height: 40,
          page: 1,
          recipient_id: '2',
          type: 'signature',
          required: true
        }
      ]
    ],
    apply_signing_order: true,
    reminders: true
  };

  try {
    const res = await signwellRequest({
      path: '/documents',
      method: 'POST',
      body: payload
    });

    if (res.status < 200 || res.status >= 300) {
      const errDetail = JSON.stringify(res.data?.errors || res.data?.error || res.data?.message || res.data);
      throw new Error(`SignWell HTTP ${res.status}: ${errDetail}`);
    }

    const data = res.data;
    const signingUrl = data.recipients?.[0]?.signing_url || null;
    const adminSigningUrl = data.recipients?.[1]?.signing_url || null;

    return {
      id: data.id,
      name: data.name,
      status: data.status,
      recipients: data.recipients,
      signingUrl,
      adminSigningUrl,
      simulated: false
    };
  } catch (err) {
    console.error('❌ SignWell API Error:', err.message);
    if (err.cause) console.error('   Cause:', err.cause);
    throw err;
  }
}

/**
 * Check the signing status of a document
 * @param {string} docId - SignWell Document ID
 */
async function getDocumentStatus(docId) {
  if (!isConfigured() || docId.startsWith('sw_doc_') || docId.startsWith('sw_fallback_')) {
    console.log(`📄 [SIGNWELL SIMULATION] Checking status for doc ID: ${docId}`);
    return {
      id: docId,
      status: 'completed',
      isCompleted: true,
      recipients: [
        { id: '1', name: 'Client Name', email: 'client@example.com', status: 'signed' },
        { id: '2', name: 'Software Bechi Admin', email: 'admin@softwarebechi.com', status: 'signed' }
      ],
      simulated: true
    };
  }

  try {
    const res = await signwellRequest({
      path: `/documents/${docId}`,
      method: 'GET'
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(res.data?.message || `SignWell HTTP ${res.status}`);
    }

    const data = res.data;
    const r1 = data.recipients?.[0];
    const r2 = data.recipients?.[1];
    const r1Status = (r1?.status || '').toLowerCase().trim();
    const r2Status = (r2?.status || '').toLowerCase().trim();

    // In SignWell, signed recipients have status 'completed' or 'signed'
    const clientSigned = ['completed', 'signed'].includes(r1Status);
    const adminSigned = ['completed', 'signed'].includes(r2Status);
    const docStatus = (data.status || '').toLowerCase().trim();
    const isCompleted = docStatus === 'completed' || (clientSigned && (data.recipients?.length < 2 || adminSigned));
    const adminPending = !isCompleted && clientSigned && !adminSigned;

    // Parse company name from document name (e.g. "Master Services Agreement - Acme")
    let parsedCompany = 'Client Partner';
    if (data.name && data.name.includes('-')) {
      parsedCompany = data.name.split('-').slice(1).join('-').trim();
    }

    return {
      id: data.id,
      name: data.name,
      company: parsedCompany,
      status: data.status,
      isCompleted,
      adminPending,
      clientName: r1?.name || 'Client Partner',
      clientEmail: r1?.email || '',
      adminName: r2?.name || 'Software Bechi Admin',
      adminEmail: r2?.email || '',
      adminSigningUrl: r2?.signing_url || null,
      clientSigningUrl: r1?.signing_url || null,
      completedPdfUrl: `/api/contract/${data.id}/pdf`,
      recipients: data.recipients || [],
      simulated: false
    };
  } catch (err) {
    console.error('❌ SignWell Status Error:', err.message);
    return {
      id: docId,
      status: 'error',
      isCompleted: false,
      error: err.message,
      simulated: true
    };
  }
}

/**
 * Fetch the official completed PDF buffer from SignWell
 * @param {string} docId - SignWell Document ID
 */
async function getCompletedPdfBuffer(docId) {
  if (!isConfigured() || docId.startsWith('sw_doc_') || docId.startsWith('sw_fallback_')) {
    return null;
  }

  try {
    const res = await signwellRequest({
      path: `/documents/${docId}/completed_pdf`,
      method: 'GET',
      isBinary: true
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`SignWell HTTP ${res.status}: Failed to fetch completed PDF`);
    }

    return res.buffer;
  } catch (err) {
    console.error('❌ SignWell Completed PDF Error:', err.message);
    return null;
  }
}

module.exports = {
  createDocument,
  getDocumentStatus,
  getCompletedPdfBuffer,
  compileContractTemplate,
  isConfigured
};
