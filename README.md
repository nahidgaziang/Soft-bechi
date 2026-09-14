# 🏢 SOFTWARE BECHI — Automated Client Onboarding & Payment System

> Enterprise-grade client acquisition, dual e-signature contracting, CRM synchronization, meeting scheduling, and billing engine.

---

## ⚡ Overview

**SOFTWARE BECHI** orchestrates the complete end-to-end lifecycle of prospective client intake:

1. **Intake & Qualification**: Client submits proposal specs via public intake form (`/onboard`).
2. **Real-Time Slack Alerts**: Posts lead notifications directly to `#new-clients`.
3. **HubSpot CRM Pipeline**: Automatically provisions new Contacts and Deals across pipeline stages.
4. **SignWell Dual E-Signature**: Generates and emails custom Master Services Agreements (Order 1: Client signs, Order 2: Admin counter-signs).
5. **Signed PDF & Certificate Delivery**: Upon mutual execution, auto-delivers the executed agreement with audit certificate to the client's inbox.
6. **Calendly Kickoff Dispatch**: Automatically triggers technical kickoff meeting invites.
7. **Stripe Sandbox Billing**: Generates live sandbox checkout links for deliverables and milestone invoices.
8. **Operations Console (`/admin`)**: Internal protected control room with live telemetry for manual override, verification, and audit logging.

---

## 🛠️ Tech Stack & Integrations

- **Backend**: Node.js & Express
- **Frontend**: Vanilla HTML5, Modern CSS Design System (solid executive theme, zero gradients), Vanilla JS
- **E-Signature**: SignWell REST API v1
- **CRM**: HubSpot REST API
- **Notifications**: Slack Web API (`@slack/bolt`)
- **Email Delivery**: Nodemailer (Gmail SMTP with App Password fallback)
- **Payments**: Stripe Sandbox API
- **Scheduling**: Calendly Integration

---

## 🚀 Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v18+ or v20+
- npm v9+

### 2. Installation

```bash
git clone https://github.com/nahidgaziang/Soft-bechi.git
cd Soft-bechi
npm install
```

### 3. Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env
```

Open `.env` and configure your API credentials:

```ini
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
SLACK_CHANNEL_ID=C0123456789

# HubSpot
HUBSPOT_TOKEN=pat-...
HUBSPOT_PIPELINE_ID=default

# SignWell
SIGNWELL_API_KEY=...
SIGNWELL_SENDER_NAME=Nahid Gazi
SIGNWELL_SENDER_EMAIL=admin@softwarebechi.com

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=softwarebechi2026

# Calendly
CALENDLY_LINK=https://calendly.com/...

# Stripe
STRIPE_SECRET_KEY=sk_test_...

# Email (Nodemailer / Gmail App Password)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
EMAIL_FROM_NAME="SOFTWARE BECHI"

# Server
PORT=3000
```

---

## 🖥️ Running Locally

Start the local server:

```bash
npm start
```

Access the web interfaces:
- **Landing Page**: [http://localhost:3000](http://localhost:3000)
- **Client Intake Form**: [http://localhost:3000/onboard](http://localhost:3000/onboard)
- **Operations Console**: [http://localhost:3000/admin](http://localhost:3000/admin) *(Username: `admin`, Password: `softwarebechi2026`)*

---

## 💻 CLI Automation Scripts

You can also trigger individual stages via command line:

```bash
# Ingest client & dispatch contract
npm run onboard

# Check SignWell signature status
npm run check-sign "<DOCUMENT_ID>"

# Dispatch Calendly kickoff meeting email
node scripts/3-send-meeting-link.js "client@company.com" "Client Name"

# Generate Stripe invoice & email client
node scripts/4-send-payment-link.js "client@company.com" "Client Name" "Acme Inc" "Milestone 1 Deliverable" 500000
```

