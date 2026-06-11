const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { plan_type, email, name } = req.body;

  let amount = 0;
  if (plan_type === 'pix') {
    amount = 120000;
  } else if (plan_type === 'cartao') {
    amount = 150000;
  } else {
    return res.status(400).json({ error: 'Plano inválido.' });
  }

  try {
    const intentOptions = {
      amount,
      currency: 'brl',
      payment_method_types: plan_type === 'pix' ? ['pix'] : ['card'],
      receipt_email: email,
      description: plan_type === 'pix'
        ? 'Formação em Vendas Consultivas Signum (Pix)'
        : 'Formação em Vendas Consultivas Signum (Cartão)',
      metadata: { customer_name: name, plan: plan_type }
    };

    if (plan_type === 'cartao') {
      intentOptions.payment_method_options = {
        card: { installments: { enabled: true } }
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(intentOptions);
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
};
