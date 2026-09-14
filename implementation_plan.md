# 🏢 SOFTWARE BECHI — Client Onboarding & Payment System

> **Goal**: Build an end-to-end automated client onboarding system for a software company called **"SOFTWARE BECHI"** that integrates **Slack**, **HubSpot**, **SignWell**, **Calendly**, and **Stripe**.

---

## 📐 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SOFTWARE BECHI SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ① FIND CLIENT ──▶ ② ONBOARD VIA SLACK ──▶ ③ RECORD IN HUBSPOT       │
│                                                                         │
│  ④ GENERATE CONTRACT ──▶ ⑤ SEND VIA SIGNWELL ──▶ ⑥ CLIENT SIGNS      │
│                                                                         │
│  ⑦ MANUAL VERIFICATION ──▶ ⑧ SEND CALENDLY LINK ──▶ ⑨ STRIPE PAY    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Detailed Data Flow

```
  ┌──────────────┐
  │  Landing Page │  ←  SOFTWARE BECHI website (index.html)
  │  (PUBLIC)     │
  └──────┬───────┘
         │ Team finds a potential client
         ▼
  ┌──────────────┐     ┌──────────────────┐
  │  STEP 1      │     │  SLACK           │
  │  Onboard via │────▶│  #new-clients    │  Post: "New client: Acme Corp"
  │  Slack Bot   │     │  channel         │
  └──────┬───────┘     └──────────────────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────────┐
  │  STEP 2      │     │  HUBSPOT CRM     │
  │  Record in   │────▶│  Create Contact  │  Store name, email, company
  │  HubSpot     │     │  Create Deal     │  Pipeline: "Client Onboarding"
  └──────┬───────┘     └──────────────────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────────┐
  │  STEP 3      │     │  LOCAL FILE      │
  │  Generate    │────▶│  agreement.pdf   │  Fill template with client data
  │  Contract    │     │  (per client)    │
  └──────┬───────┘     └──────────────────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────────┐
  │  STEP 4      │     │  SIGNWELL API    │
  │  Send for    │────▶│  Create Document │  Upload PDF + add signature fields
  │  Signing     │     │  → Email to      │  Client receives email to sign
  └──────┬───────┘     │    client        │
         │             └──────────────────┘
         ▼
  ┌──────────────┐
  │  STEP 5      │  Client opens email → clicks link → signs on SignWell
  │  Client Signs│  Both parties sign (apply_signing_order)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────────┐
  │  STEP 6      │     │  ADMIN DASHBOARD │
  │  Manual      │────▶│  View signed doc │  Admin checks document status
  │  Verification│     │  Mark verified   │  via SignWell API
  └──────┬───────┘     └──────────────────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────────┐
  │  STEP 7      │     │  CALENDLY LINK   │
  │  Send Meeting│────▶│  Email with      │  "Schedule your kickoff meeting"
  │  Invite      │     │  booking link    │
  └──────┬───────┘     └──────────────────┘
         │ Meeting is completed
         ▼
  ┌──────────────┐     ┌──────────────────┐
  │  STEP 8      │     │  STRIPE          │
  │  Send Payment│────▶│  Payment Link    │  Create product + price + link
  │  Link        │     │  via email       │  Client pays (sandbox mode)
  └──────────────┘     └──────────────────┘
```

---

## 🔧 Tools & API Keys Needed

| Tool | What We Use | API Key Source |
|------|------------|----------------|
| **Slack** | Bolt.js Bot (Socket Mode) | Bot Token + App Token from [api.slack.com](https://api.slack.com) |
| **HubSpot** | REST API (Private App) | Private App Token from HubSpot Settings → Integrations → Private Apps |
| **SignWell** | REST API v1 | API Key from [signwell.com](https://www.signwell.com) → Settings → API |
| **Calendly** | Embed widget + REST API | Personal Access Token from [calendly.com](https://calendly.com) → Integrations → API |
| **Stripe** | Node.js SDK (Test mode) | Secret Key from [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API Keys |

> [!IMPORTANT]
> All keys go in a single `.env` file. **Never commit this to Git.**

---

## 📁 Project File Structure

```
c:\Users\ejena\OneDrive\Desktop\DEV\
├── .env                          # All API keys (already exists)
├── package.json                  # Dependencies
│
├── index.html                    # Landing page: "SOFTWARE BECHI"
├── style.css                     # Landing page styling
│
├── contract-template.html        # Contract template with placeholders
│
├── server.js                     # Express server (central orchestrator)
│
├── scripts/
│   ├── 1-onboard-client.js       # Full pipeline: Slack → HubSpot → Contract → SignWell
│   ├── 2-check-signature.js      # Check if document is signed (manual verification)
│   ├── 3-send-meeting-link.js    # Send Calendly link via email after verification
│   └── 4-send-payment-link.js    # Create Stripe payment link and email it
│
└── utils/
    ├── slack-notify.js           # Reusable: Send messages to Slack
    ├── hubspot-client.js         # Reusable: Create contacts & deals
    ├── signwell-client.js        # Reusable: Create & check documents
    ├── calendly-client.js        # Reusable: Get events & scheduling links
    ├── stripe-client.js          # Reusable: Create payment links
    └── email-sender.js           # Reusable: Send emails (via Nodemailer or similar)
```

---

## 🚀 Step-by-Step Implementation Plan

### Phase 0: Project Setup

#### [NEW] `package.json`

Initialize the project and install all dependencies:

```bash
npm init -y
npm install express dotenv @slack/bolt stripe nodemailer
```

#### [MODIFY] `.env`

Add all required environment variables:

```env
# ── Slack ──
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
SLACK_CHANNEL_ID=C...         # #new-clients channel ID

# ── HubSpot ──
HUBSPOT_TOKEN=pat-...
HUBSPOT_PIPELINE_ID=...       # From pipeline query
HUBSPOT_STAGE_ID=...          # First stage ID

# ── SignWell ──
SIGNWELL_API_KEY=...

# ── Calendly ──
CALENDLY_TOKEN=...
CALENDLY_LINK=https://calendly.com/YOUR_USERNAME/30min

# ── Stripe ──
STRIPE_SECRET_KEY=sk_test_...

# ── Email (Gmail App Password) ──
EMAIL_USER=your@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx   # Gmail App Password (not regular password)
```

---

### Phase 1: Landing Page — `index.html` + `style.css`

#### [NEW] [index.html](file:///c:/Users/ejena/OneDrive/Desktop/DEV/index.html)

A professional landing page for "SOFTWARE BECHI" with:
- Hero section with company name and tagline
- Services section (what we build)
- Process section showing our client onboarding workflow
- Contact section with a "Get Started" button
- Footer

#### [NEW] [style.css](file:///c:/Users/ejena/OneDrive/Desktop/DEV/style.css)

Modern dark-theme design with:
- Gradient backgrounds
- Glass-morphism cards
- Smooth animations
- Google Fonts (Inter)
- Responsive design

---

### Phase 2: Utility Modules (Reusable API Wrappers)

#### [NEW] [utils/slack-notify.js](file:///c:/Users/ejena/OneDrive/Desktop/DEV/utils/slack-notify.js)

```javascript
// Sends rich messages to Slack #new-clients channel
// Uses @slack/bolt or simple Webhook POST
// Functions: notifyNewClient(clientData), notifySignComplete(clientData)
```

#### [NEW] [utils/hubspot-client.js](file:///c:/Users/ejena/OneDrive/Desktop/DEV/utils/hubspot-client.js)

```javascript
// HubSpot API wrapper
// Functions:
//   createContact(name, email, company) → returns contactId
//   createDeal(dealName, amount, contactId) → returns dealId
//   updateDealStage(dealId, stageId) → moves deal through pipeline
```

#### [NEW] [utils/signwell-client.js](file:///c:/Users/ejena/OneDrive/Desktop/DEV/utils/signwell-client.js)

SignWell API details:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `https://www.signwell.com/api/v1/documents` | Create document & send for signing |
| `GET` | `https://www.signwell.com/api/v1/documents/{id}` | Check document status |
| `GET` | `https://www.signwell.com/api/v1/documents/{id}/completed_pdf` | Download signed PDF |

**Authentication**: Header `X-Api-Key: YOUR_API_KEY`

**Key: How we create a document in SignWell via API:**

```javascript
const response = await fetch('https://www.signwell.com/api/v1/documents', {
    method: 'POST',
    headers: {
        'X-Api-Key': SIGNWELL_API_KEY,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        test_mode: true,                    // Sandbox mode
        name: 'Software Agreement - Acme Corp',
        subject: 'Please sign your agreement with Software Bechi',
        message: 'Hi, please review and sign the attached agreement.',
        
        // Upload the contract file (base64 or URL)
        files: [{
            name: 'agreement.pdf',
            file_base64: '<base64-encoded-pdf>'   // or file_url for public URL
        }],
        
        // Who needs to sign
        recipients: [
            {
                id: '1',
                name: 'Client Name',
                email: 'client@example.com',
                signing_order: 1                  // Client signs first
            },
            {
                id: '2',
                name: 'Software Bechi Admin',
                email: 'admin@softwarebechi.com',
                signing_order: 2                  // We counter-sign
            }
        ],
        
        // Signature fields on the PDF (coordinates in pixels)
        fields: [[
            {
                x: 100, y: 700, page: 1,
                recipient_id: '1',
                type: 'signature',
                required: true
            },
            {
                x: 100, y: 750, page: 1,
                recipient_id: '1',
                type: 'date',
                required: true,
                lock_sign_date: true
            },
            {
                x: 350, y: 700, page: 1,
                recipient_id: '2',
                type: 'signature',
                required: true
            },
            {
                x: 350, y: 750, page: 1,
                recipient_id: '2',
                type: 'date',
                required: true,
                lock_sign_date: true
            }
        ]],
        
        apply_signing_order: true,    // Enforce order
        reminders: true,              // Auto-remind unsigned
    })
});

const document = await response.json();
// document.id → save this to check status later
// document.recipients[0].signing_url → direct signing link
```

#### [NEW] [utils/stripe-client.js](file:///c:/Users/ejena/OneDrive/Desktop/DEV/utils/stripe-client.js)

```javascript
// Stripe payment link creator
// Functions:
//   createPaymentLink(clientName, serviceName, amountInCents) → returns paymentLink.url
```

#### [NEW] [utils/email-sender.js](file:///c:/Users/ejena/OneDrive/Desktop/DEV/utils/email-sender.js)

```javascript
// Uses Nodemailer with Gmail to send emails
// Functions:
//   sendEmail(to, subject, htmlBody) → sends email
//   sendCalendlyInvite(to, clientName, calendlyLink)
//   sendPaymentEmail(to, clientName, paymentUrl, amount)
```

---

### Phase 3: Main Pipeline Scripts

#### [NEW] [scripts/1-onboard-client.js](file:///c:/Users/ejena/OneDrive/Desktop/DEV/scripts/1-onboard-client.js)

**This is the main script.** When we find a new client, we run this script.

**What it does (in order):**

1. **Takes client info** as input (name, email, company, project type, deal amount)
2. **Notifies Slack** → Posts in `#new-clients`: "🆕 New client: Acme Corp (John Doe)"
3. **Creates HubSpot Contact** → Stores contact with lifecycle stage = "lead"
4. **Creates HubSpot Deal** → Adds to "Client Onboarding" pipeline, first stage
5. **Generates Contract** → Fills in `contract-template.html` with client data, converts to base64
6. **Sends to SignWell** → Creates document with signature fields for both parties
7. **Updates Slack** → Posts: "📄 Contract sent to john@example.com for signing"
8. **Saves document ID** → Stores SignWell doc ID for later status checks

**Usage:**
```bash
node scripts/1-onboard-client.js "John Doe" "john@acme.com" "Acme Corp" "Web Development" 50000
```

#### [NEW] [scripts/2-check-signature.js](file:///c:/Users/ejena/OneDrive/Desktop/DEV/scripts/2-check-signature.js)

**Manual verification step.** Admin runs this to check signing status.

**What it does:**

1. **Takes SignWell document ID** as input
2. **Calls SignWell API** → `GET /api/v1/documents/{id}`
3. **Displays status** for each recipient:
   - `created` → Not yet viewed
   - `sent` → Email sent, not viewed
   - `viewed` → Viewed but not signed
   - `signed` → ✅ Signed!
   - `declined` → ❌ Declined
4. **If all signed** → Shows "✅ VERIFIED — All parties have signed"
5. **Updates HubSpot deal stage** → Moves to "Contract Signed" stage
6. **Notifies Slack** → "✅ Contract for Acme Corp is fully signed and verified"

**Usage:**
```bash
node scripts/2-check-signature.js "SIGNWELL_DOCUMENT_ID"
```

#### [NEW] [scripts/3-send-meeting-link.js](file:///c:/Users/ejena/OneDrive/Desktop/DEV/scripts/3-send-meeting-link.js)

**After verification, send Calendly link.**

**What it does:**

1. **Takes client email and name** as input
2. **Sends email** with Calendly scheduling link
3. **Updates HubSpot deal stage** → Moves to "Meeting Scheduled"
4. **Notifies Slack** → "📅 Calendly link sent to john@acme.com"

**Email content:**
```
Subject: Schedule Your Kickoff Meeting — Software Bechi

Hi John,

Great news! Your agreement has been signed and verified. ✅

Let's schedule your project kickoff meeting. Please pick a time that works for you:

👉 Book Meeting: https://calendly.com/softwarebechi/kickoff

Looking forward to working together!

Best,
Software Bechi Team
```

**Usage:**
```bash
node scripts/3-send-meeting-link.js "john@acme.com" "John Doe"
```

#### [NEW] [scripts/4-send-payment-link.js](file:///c:/Users/ejena/OneDrive/Desktop/DEV/scripts/4-send-payment-link.js)

**After meeting is done, send Stripe payment link.**

**What it does:**

1. **Takes client info and amount** as input
2. **Creates Stripe Product** → "Web Development - Acme Corp"
3. **Creates Stripe Price** → One-time, amount from input
4. **Creates Stripe Payment Link** → Shareable URL
5. **Sends email** with payment link to client
6. **Updates HubSpot deal stage** → Moves to "Payment Pending"
7. **Notifies Slack** → "💰 Payment link ($50,000) sent to john@acme.com"

**Usage:**
```bash
node scripts/4-send-payment-link.js "john@acme.com" "John Doe" "Acme Corp" "Web Development" 5000000
```
*(Amount in cents: 5000000 = $50,000)*

---

### Phase 4: Contract Template

#### [NEW] [contract-template.html](file:///c:/Users/ejena/OneDrive/Desktop/DEV/contract-template.html)

A professional HTML contract template with placeholders:

```
{{CLIENT_NAME}}, {{CLIENT_EMAIL}}, {{CLIENT_COMPANY}},
{{PROJECT_TYPE}}, {{DEAL_AMOUNT}}, {{DATE}}
```

The template includes:
- Service Agreement header
- Scope of Work section
- Payment Terms
- Timeline
- Confidentiality clause
- Signature blocks (for SignWell fields)

---

### Phase 5: Express Server (Optional Admin Dashboard)

#### [NEW] [server.js](file:///c:/Users/ejena/OneDrive/Desktop/DEV/server.js)

A simple Express server that:
- Serves the landing page at `/`
- Has API routes for the admin dashboard:
  - `POST /api/onboard` → Triggers client onboarding
  - `GET /api/check-signature/:docId` → Checks signing status
  - `POST /api/send-meeting` → Sends Calendly link
  - `POST /api/send-payment` → Sends Stripe payment link

---

## ✅ Verification Plan

### Automated Tests (Run Each Script)

```bash
# Step 1: Onboard a test client
node scripts/1-onboard-client.js "Test User" "test@example.com" "Test Corp" "Web Development" 100000

# Step 2: Check signature status (use document ID from step 1)
node scripts/2-check-signature.js "DOCUMENT_ID_FROM_STEP_1"

# Step 3: Send meeting link
node scripts/3-send-meeting-link.js "test@example.com" "Test User"

# Step 4: Send payment link ($1,000 = 100000 cents)
node scripts/4-send-payment-link.js "test@example.com" "Test User" "Test Corp" "Web Development" 100000
```

### Manual Verification

| Step | What to Verify | Where |
|------|---------------|-------|
| 1 | Message appears in Slack `#new-clients` | Slack workspace |
| 2 | Contact + Deal created in HubSpot | HubSpot CRM dashboard |
| 3 | Document created in SignWell | SignWell dashboard |
| 4 | Client received signing email | Client's inbox |
| 5 | Document status shows "signed" | `2-check-signature.js` output |
| 6 | Calendly email received | Client's inbox |
| 7 | Payment link works (test card: `4242 4242 4242 4242`) | Stripe dashboard |
| 8 | Deal stages updated in HubSpot | HubSpot pipeline view |
| 9 | Landing page renders correctly | Browser at `localhost:3000` |

---

## ⚠️ User Review Required

> [!IMPORTANT]
> **Email Sending**: This plan uses **Gmail + Nodemailer** for sending emails (Calendly link, payment link). You'll need to:
> 1. Enable "2-Step Verification" on your Gmail
> 2. Generate an "App Password" at https://myaccount.google.com/apppasswords
> 3. Add it to `.env` as `EMAIL_PASS`
>
> **Alternative**: If you don't want to use Gmail, we can skip email and just print the links in the terminal for you to share manually.

> [!IMPORTANT]
> **SignWell API Key**: You need to get your API key from SignWell dashboard → Settings → API. The free plan allows limited documents but is enough for testing.

> [!WARNING]
> **Stripe is in Test Mode**: All Stripe operations use `sk_test_...` keys. No real money will be charged. Use test card `4242 4242 4242 4242` with any future date and any CVC.

## Open Questions

> [!IMPORTANT]
> 1. **Email or Manual?** — Should the Calendly link and Payment link be emailed automatically, or would you prefer to manually copy-paste the links?
> 2. **HubSpot Pipeline Stages** — Do you want us to create a new pipeline called "Client Onboarding" with custom stages, or use your existing default pipeline?
> 3. **Deal Amount** — Should the deal amount be entered manually each time, or is there a fixed pricing for your services?

---

## 📋 Execution Order

Once approved, I will build in this order:

| # | What | Time |
|---|------|------|
| 1 | Project setup (`package.json`, `.env`, install deps) | 2 min |
| 2 | Landing page (`index.html` + `style.css`) | 5 min |
| 3 | Contract template (`contract-template.html`) | 3 min |
| 4 | Utility modules (`utils/*.js`) | 10 min |
| 5 | Pipeline scripts (`scripts/*.js`) | 15 min |
| 6 | Express server (`server.js`) | 5 min |
| 7 | End-to-end test with dummy data | 5 min |
| **Total** | | **~45 min** |
