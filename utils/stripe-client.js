/**
 * utils/stripe-client.js
 * Stripe Sandbox Payment Links Generator
 */

require('dotenv').config();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

function isConfigured() {
  return STRIPE_KEY && !STRIPE_KEY.includes('your_stripe') && STRIPE_KEY.startsWith('sk_');
}

/**
 * Generate a Stripe Payment Link
 * @param {Object} options
 * @param {string} options.clientName - Client full name
 * @param {string} options.clientCompany - Client company
 * @param {string} options.serviceName - Service description
 * @param {number} options.amountInCents - Price in cents (e.g., $1,000 = 100000)
 */
async function createPaymentLink({
  clientName,
  clientCompany,
  serviceName = 'Software Architecture & Development',
  amountInCents = 100000
}) {
  if (!isConfigured()) {
    const mockId = 'plink_test_' + Math.random().toString(36).substring(2, 9);
    const mockUrl = `https://buy.stripe.com/test_${mockId}`;
    console.log(`\n💳 [STRIPE SIMULATION - No Secret Key]`);
    console.log(`Product: ${serviceName} (${clientCompany})`);
    console.log(`Amount: $${(amountInCents / 100).toLocaleString()}`);
    console.log(`Generated Link: ${mockUrl}\n`);

    return {
      id: mockId,
      url: mockUrl,
      amount: amountInCents,
      currency: 'usd',
      simulated: true
    };
  }

  try {
    const stripe = require('stripe')(STRIPE_KEY);

    // 1. Create a Product
    const product = await stripe.products.create({
      name: `${serviceName} — ${clientCompany}`,
      description: `Bespoke software deliverables for ${clientName} (${clientCompany}) by SOFTWARE BECHI Inc.`
    });

    // 2. Create a One-Time Price
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: amountInCents,
      product: product.id
    });

    // 3. Create a shareable Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: 1
        }
      ],
      metadata: {
        clientName,
        clientCompany,
        serviceName
      }
    });

    return {
      id: paymentLink.id,
      url: paymentLink.url,
      amount: amountInCents,
      currency: 'usd',
      simulated: false
    };
  } catch (err) {
    console.error('❌ Stripe API Error:', err.message);
    const mockUrl = `https://buy.stripe.com/test_fallback_${Date.now()}`;
    return {
      id: 'plink_fallback_' + Date.now(),
      url: mockUrl,
      amount: amountInCents,
      currency: 'usd',
      error: err.message,
      simulated: true
    };
  }
}

module.exports = {
  createPaymentLink,
  isConfigured
};
