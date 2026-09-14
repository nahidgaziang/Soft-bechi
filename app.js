/**
 * SOFTWARE BECHI — Frontend Controller & Real-Time Pipeline Stream
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const terminalStream = document.getElementById('terminalStream');
  const btnClearTerminal = document.getElementById('btnClearTerminal');

  // Forms
  const formOnboard = document.getElementById('formOnboard');
  const formVerify = document.getElementById('formVerify');
  const formMeeting = document.getElementById('formMeeting');
  const formPayment = document.getElementById('formPayment');

  // Stage Nodes
  const stepNodes = [
    document.getElementById('step-node-1'),
    document.getElementById('step-node-2'),
    document.getElementById('step-node-3'),
    document.getElementById('step-node-4'),
    document.getElementById('step-node-5'),
    document.getElementById('step-node-6')
  ];
  const connectors = [
    document.getElementById('conn-1'),
    document.getElementById('conn-2'),
    document.getElementById('conn-3'),
    document.getElementById('conn-4'),
    document.getElementById('conn-5')
  ];

  // Helper: Format Time
  function getTimestamp() {
    const now = new Date();
    return `[${now.toTimeString().split(' ')[0]}]`;
  }

  // Helper: Append Terminal Log
  function logTerminal(message, type = 'info') {
    const line = document.createElement('div');
    line.className = `terminal-line log-${type}`;
    line.innerHTML = `<span class="term-time">${getTimestamp()}</span> ${message}`;
    terminalStream.appendChild(line);
    terminalStream.scrollTop = terminalStream.scrollHeight;
  }

  // Clear Terminal
  if (btnClearTerminal) {
    btnClearTerminal.addEventListener('click', () => {
      terminalStream.innerHTML = '';
      logTerminal('Terminal buffer cleared. System online.', 'system');
    });
  }

  // Tabs Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetTab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Stage Progress Visualizer
  function updateStageProgress(completedStageIndex) {
    stepNodes.forEach((node, idx) => {
      if (idx < completedStageIndex) {
        node.classList.add('completed');
        node.classList.remove('active');
      } else if (idx === completedStageIndex) {
        node.classList.add('active');
        node.classList.remove('completed');
      } else {
        node.classList.remove('active', 'completed');
      }
    });

    connectors.forEach((conn, idx) => {
      if (idx < completedStageIndex) {
        conn.classList.add('completed');
      } else {
        conn.classList.remove('completed');
      }
    });
  }

  // ────────────────────────────────────────────────────────
  // ADMIN AUTHENTICATION CONTROLLER
  // ────────────────────────────────────────────────────────
  const adminLoginView = document.getElementById('adminLoginView');
  const adminConsoleView = document.getElementById('adminConsoleView');
  const formAdminLogin = document.getElementById('formAdminLogin');
  const adminLoginError = document.getElementById('adminLoginError');
  const adminLoginErrorMsg = document.getElementById('adminLoginErrorMsg');
  const sessionPill = document.getElementById('sessionPill');
  const btnAdminLogout = document.getElementById('btnAdminLogout');

  function checkAdminAuth() {
    const token = sessionStorage.getItem('sb_admin_token');
    if (token) {
      if (adminLoginView) adminLoginView.style.display = 'none';
      if (adminConsoleView) adminConsoleView.style.display = 'block';
      if (sessionPill) sessionPill.style.display = 'inline-flex';
      if (btnAdminLogout) btnAdminLogout.style.display = 'inline-flex';
    } else {
      if (adminLoginView) adminLoginView.style.display = 'block';
      if (adminConsoleView) adminConsoleView.style.display = 'none';
      if (sessionPill) sessionPill.style.display = 'none';
      if (btnAdminLogout) btnAdminLogout.style.display = 'none';
    }
  }

  // Handle Login Submit
  if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btnAdminLoginSubmit');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
      submitBtn.disabled = true;
      if (adminLoginError) adminLoginError.style.display = 'none';

      const username = document.getElementById('adminUsername').value.trim();
      const password = document.getElementById('adminPassword').value.trim();

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          sessionStorage.setItem('sb_admin_token', data.token);
          checkAdminAuth();
          logTerminal(`🛡️ <strong>Admin Verified:</strong> Welcome back, ${data.username || 'Administrator'}. Operations Console unlocked.`, 'success');
        } else {
          if (adminLoginError) {
            adminLoginErrorMsg.textContent = data.error || 'Invalid credentials. Access denied.';
            adminLoginError.style.display = 'flex';
          }
        }
      } catch (err) {
        if (adminLoginError) {
          adminLoginErrorMsg.textContent = 'Network or server error: ' + err.message;
          adminLoginError.style.display = 'flex';
        }
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // Handle Logout
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      sessionStorage.removeItem('sb_admin_token');
      checkAdminAuth();
      logTerminal('🔒 Admin session terminated. Console locked.', 'warning');
    });
  }

  // Initial Auth Check
  checkAdminAuth();

  // ────────────────────────────────────────────────────────
  // STAGE 1: Onboard Client Form Submit
  // ────────────────────────────────────────────────────────
  if (formOnboard) {
    formOnboard.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitOnboard');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Onboarding...';
      btn.disabled = true;

      const payload = {
        name: document.getElementById('clientName').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        company: document.getElementById('clientCompany').value.trim(),
        projectType: document.getElementById('projectType').value,
        amount: parseFloat(document.getElementById('dealAmount').value) || 5000
      };

      logTerminal(`🚀 Initiating Stage 1 Onboard for <strong>${payload.name} (${payload.company})</strong>...`, 'info');

      try {
        const res = await fetch('/api/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
          logTerminal(`✅ <strong>Slack Notification Dispatched:</strong> #${data.slackChannel || 'new-clients'}`, 'success');
          logTerminal(`✅ <strong>HubSpot CRM Synced:</strong> Contact ID ${data.hubspot?.contactId || 'Simulated'}, Deal ID ${data.hubspot?.dealId || 'Simulated'}`, 'success');
          logTerminal(`✅ <strong>SignWell Document Created:</strong> Doc ID <code>${data.signwell?.id || data.signwell?.documentId}</code>`, 'success');
          
          if (data.signwell?.signingUrl) {
            logTerminal(`🔗 <strong>Client Signing Link:</strong> <a href="${data.signwell.signingUrl}" target="_blank" style="color:#00f2fe;text-decoration:underline;">Open SignWell Page</a>`, 'info');
          }

          // Pre-fill next stages
          const verifyDocInput = document.getElementById('verifyDocId');
          if (verifyDocInput && (data.signwell?.id || data.signwell?.documentId)) {
            verifyDocInput.value = data.signwell?.id || data.signwell?.documentId;
          }

          document.getElementById('meetingEmail').value = payload.email;
          document.getElementById('meetingName').value = payload.name;
          document.getElementById('payEmail').value = payload.email;
          document.getElementById('payName').value = payload.name;
          document.getElementById('payCompany').value = payload.company;
          document.getElementById('payService').value = payload.projectType;

          updateStageProgress(3); // Progress to step 4 (Admin Verify)
          logTerminal(`🎉 Stage 1 Complete! Now proceed to Tab 2 to verify document signature once signed.`, 'system');
        } else {
          logTerminal(`⚠️ <strong>Onboarding Warning / Error:</strong> ${data.error || data.message || 'Unknown issue'}`, 'error');
          if (data.details) logTerminal(`Details: ${JSON.stringify(data.details)}`, 'warning');
        }
      } catch (err) {
        logTerminal(`❌ Network / Server Error: ${err.message}`, 'error');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  }

  // ────────────────────────────────────────────────────────
  // STAGE 2: Verify SignWell Document
  // ────────────────────────────────────────────────────────
  if (formVerify) {
    formVerify.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitVerify');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Querying SignWell API...';
      btn.disabled = true;

      const resultContainer = document.getElementById('verifyResultContainer');
      if (resultContainer) {
        resultContainer.innerHTML = '';
        resultContainer.style.display = 'none';
      }

      const docId = document.getElementById('verifyDocId').value.trim();
      logTerminal(`🔍 Checking SignWell status for Document ID: <code>${docId}</code>...`, 'info');

      try {
        const res = await fetch(`/api/check-signature/${encodeURIComponent(docId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
          logTerminal(`📄 Document Status: <strong>${data.status.toUpperCase()}</strong> (Completed: ${data.isCompleted})`, data.isCompleted ? 'success' : 'warning');
          
          if (data.recipients && data.recipients.length > 0) {
            data.recipients.forEach(r => {
              logTerminal(`   • Recipient: ${r.name} (${r.email}) → Status: <strong>${r.status}</strong>`, ['signed', 'completed'].includes(r.status?.toLowerCase()) ? 'success' : 'info');
            });
          }

          // Case A: Client signed, Admin counter-signature pending
          if (data.adminPending) {
            logTerminal(`⚠️ <strong>ACTION REQUIRED:</strong> Client (${data.clientName}) has signed! Admin counter-signature pending.`, 'warning');
            if (data.adminSigningUrl) {
              logTerminal(`✍️ <a href="${data.adminSigningUrl}" target="_blank" style="color:#f59e0b;font-weight:bold;text-decoration:underline;">Click Here to Counter-Sign as Admin</a>`, 'warning');
            }

            if (resultContainer) {
              resultContainer.innerHTML = `
                <div class="verify-result-box verify-pending-box">
                  <div class="verify-header">
                    <i class="fa-solid fa-user-pen verify-icon"></i>
                    <div class="verify-title">Client Has Signed — Admin Counter-Signature Required!</div>
                  </div>
                  <p class="verify-desc">
                    <strong>${data.clientName || 'Client Partner'}</strong> (${data.clientEmail || ''}) has signed the agreement for <strong>${data.company || 'Client Organization'}</strong>. Software Bechi Admin must counter-sign to finalize execution and release the completed documents.
                  </p>
                  <div class="verify-action-buttons">
                    <a href="${data.adminSigningUrl}" target="_blank" class="btn btn-primary btn-sm" id="btnAdminSignLink">
                      <i class="fa-solid fa-pen-nib"></i> ✍️ Counter-Sign as Admin on SignWell
                    </a>
                    <button type="button" class="btn btn-secondary btn-sm" id="btnRecheckStatus">
                      <i class="fa-solid fa-arrows-rotate"></i> Refresh Status
                    </button>
                  </div>
                </div>
              `;
              resultContainer.style.display = 'block';

              document.getElementById('btnRecheckStatus')?.addEventListener('click', () => {
                formVerify.dispatchEvent(new Event('submit'));
              });
            }
          }

          // Case B: Completed - Dual Signatures Complete!
          else if (data.isCompleted) {
            updateStageProgress(4);
            logTerminal(`🛡️ <strong>VERIFIED & EXECUTED:</strong> Both parties have signed!`, 'success');
            logTerminal(`📧 <strong>Executed Agreement Delivered:</strong> Completed PDF & Audit Certificate emailed to <strong>${data.clientEmail || 'Client'}</strong>.`, 'success');
            logTerminal(`📄 <a href="${data.completedPdfUrl}" target="_blank" style="color:#38bdf8;text-decoration:underline;">View / Download Official Completed Contract PDF</a>`, 'info');
            logTerminal(`💬 Slack notification delivered and HubSpot deal advanced to 'Contract Signed'.`, 'success');

            // Pre-fill next stages
            if (data.clientEmail) {
              const meetingEmailInput = document.getElementById('meetingEmail');
              const meetingNameInput = document.getElementById('meetingName');
              const payEmailInput = document.getElementById('payEmail');
              const payNameInput = document.getElementById('payName');
              const payCompanyInput = document.getElementById('payCompany');

              if (meetingEmailInput) meetingEmailInput.value = data.clientEmail;
              if (meetingNameInput) meetingNameInput.value = data.clientName;
              if (payEmailInput) payEmailInput.value = data.clientEmail;
              if (payNameInput) payNameInput.value = data.clientName;
              if (payCompanyInput) payCompanyInput.value = data.company;
            }

            if (resultContainer) {
              resultContainer.innerHTML = `
                <div class="verify-result-box verify-completed-box">
                  <div class="verify-header">
                    <i class="fa-solid fa-circle-check verify-icon"></i>
                    <div class="verify-title">Dual Signatures Complete &amp; Agreement Executed!</div>
                  </div>
                  <p class="verify-desc">
                    Both <strong>${data.clientName || 'Client'}</strong> and <strong>Software Bechi Admin</strong> have signed. The executed Master Services Agreement has been locked and automatically emailed to <code>${data.clientEmail || 'client'}</code>.
                  </p>
                  <div class="verify-action-buttons">
                    <a href="${data.completedPdfUrl}" target="_blank" class="btn btn-primary btn-sm">
                      <i class="fa-solid fa-file-pdf"></i> 📄 Download Executed Contract PDF
                    </a>
                    <button type="button" class="btn btn-secondary btn-sm" id="btnProceedToCalendly">
                      <i class="fa-solid fa-calendar-days"></i> Proceed to Step 2: Calendly Kickoff
                    </button>
                  </div>
                </div>
              `;
              resultContainer.style.display = 'block';

              document.getElementById('btnProceedToCalendly')?.addEventListener('click', () => {
                document.getElementById('tabBtnMeeting')?.click();
              });
            }
          } else {
            logTerminal(`⏳ Document not fully executed yet. Waiting for client or admin to sign.`, 'warning');
          }
        } else {
          logTerminal(`❌ Verification failed: ${data.error || 'Document not found'}`, 'error');
        }
      } catch (err) {
        logTerminal(`❌ Error checking signature: ${err.message}`, 'error');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  }

  // ────────────────────────────────────────────────────────
  // STAGE 3: Dispatch Calendly Meeting Link
  // ────────────────────────────────────────────────────────
  if (formMeeting) {
    formMeeting.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitMeeting');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending Invite...';
      btn.disabled = true;

      const payload = {
        email: document.getElementById('meetingEmail').value.trim(),
        name: document.getElementById('meetingName').value.trim()
      };

      logTerminal(`📅 Dispatching Calendly booking invite to <strong>${payload.email}</strong>...`, 'info');

      try {
        const res = await fetch('/api/send-meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
          logTerminal(`✅ Calendly booking invite sent to <strong>${payload.email}</strong>`, 'success');
          logTerminal(`🔗 <strong>Booking URL:</strong> <a href="${data.calendlyLink}" target="_blank" style="color:#00f2fe;text-decoration:underline;">${data.calendlyLink}</a>`, 'info');
          if (data.emailDelivered) {
            logTerminal(`📬 <strong>Delivered via Gmail SMTP:</strong> ID <code>${data.messageId}</code> (Check Primary, Spam, or Promotions tab).`, 'success');
          } else if (data.simulated) {
            logTerminal(`ℹ️ <strong>[Email Simulation Mode]:</strong> No SMTP credentials configured in <code>.env</code>. The full email was logged to the server terminal.`, 'warning');
          }
          logTerminal(`💬 Slack alerted and HubSpot deal moved to 'Meeting Scheduled'.`, 'success');
          updateStageProgress(5);
        } else {
          logTerminal(`❌ Failed to send meeting invite: ${data.error}`, 'error');
        }
      } catch (err) {
        logTerminal(`❌ Error sending meeting invite: ${err.message}`, 'error');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  }

  // ────────────────────────────────────────────────────────
  // STAGE 4: Dispatch Stripe Payment Link
  // ────────────────────────────────────────────────────────
  if (formPayment) {
    formPayment.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitPayment');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Stripe Link...';
      btn.disabled = true;

      const payload = {
        email: document.getElementById('payEmail').value.trim(),
        name: document.getElementById('payName').value.trim(),
        company: document.getElementById('payCompany').value.trim(),
        service: document.getElementById('payService').value.trim(),
        amount: parseFloat(document.getElementById('payAmount').value) || 1000
      };

      logTerminal(`💳 Creating Stripe Sandbox Payment Link for $${payload.amount} (${payload.service})...`, 'info');

      try {
        const res = await fetch('/api/send-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
          logTerminal(`🎉 <strong>Stripe Payment Link Created:</strong> <a href="${data.paymentUrl}" target="_blank" style="color:#10b981;font-weight:700;text-decoration:underline;">Pay Now: ${data.paymentUrl}</a>`, 'success');
          logTerminal(`📧 Payment invoice email dispatched to <strong>${payload.email}</strong>`, 'info');
          if (data.emailDelivered) {
            logTerminal(`📬 <strong>Delivered via Gmail SMTP:</strong> ID <code>${data.messageId}</code> (Check Primary, Spam, or Promotions tab).`, 'success');
          } else if (data.emailSimulated) {
            logTerminal(`ℹ️ <strong>[Email Simulation Mode]:</strong> Invoice logged to server terminal. To deliver real emails to client inboxes, add your Gmail App Password to <code>.env</code>.`, 'warning');
          }
          logTerminal(`💬 Slack notification delivered. HubSpot deal moved to 'Payment Pending / Closed Won'.`, 'success');
          updateStageProgress(6);
          logTerminal(`🏁 Complete Client Onboarding &amp; Payment Cycle Successfully Completed!`, 'system');
        } else {
          logTerminal(`❌ Failed to create Stripe payment: ${data.error}`, 'error');
        }
      } catch (err) {
        logTerminal(`❌ Error generating payment link: ${err.message}`, 'error');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  }
});
