const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint to create a PaymentIntent
app.post('/create-payment-intent', async (req, res) => {
  const { plan_type, email, name } = req.body;

  try {
    // Definimos os valores baseados no plano escolhido
    // Para BRL (Reais), o valor é em centavos (ex: 120000 = R$ 1.200,00)
    let amount = 0;

    if (plan_type === 'pix') {
      amount = 120000; // R$ 1.200,00
    } else if (plan_type === 'cartao') {
      amount = 150000; // R$ 1.500,00
    } else {
      return res.status(400).send({ error: 'Plano inválido.' });
    }

    const intentOptions = {
      amount: amount,
      currency: 'brl',
      payment_method_types: plan_type === 'pix' ? ['pix'] : ['card'],
      receipt_email: email,
      description: plan_type === 'pix' ? 'Formação em Vendas Consultivas Signum (Pix)' : 'Formação em Vendas Consultivas Signum (Cartão)',
      metadata: {
        customer_name: name,
        plan: plan_type
      }
    };

    // Ativar parcelamento se for cartão
    if (plan_type === 'cartao') {
      intentOptions.payment_method_options = {
        card: {
          installments: {
            enabled: true
          }
        }
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(intentOptions);

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Erro ao criar PaymentIntent:", error);
    res.status(500).send({ error: error.message });
  }
});

app.get('/config', (req, res) => {
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// Serve static files from the Vite build output directory
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to serving the index.html for any requested path that doesn't match an API route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
