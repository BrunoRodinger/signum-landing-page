const express = require('express');
const cors = require('cors');
const path = require('path');
const { OpenAI } = require('openai');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint to generate diagnostic using OpenAI
app.post('/api/generate-diagnostic', async (req, res) => {
  const { name, company, email, phone, answersText, worstCategory } = req.body;

  if (!openai) {
    return res.status(503).json({ error: 'Serviço de IA não configurado. Configure OPENAI_API_KEY.' });
  }

  if (!name || !answersText) {
    return res.status(400).json({ error: 'Nome e respostas são obrigatórios.' });
  }

  // Enviar para o Webhook sigfull (n8n) em background (não bloqueia a IA)
  try {
    fetch('https://n8n.zetaloc.com.br/webhook/sigfull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    }).catch(err => console.error("Erro ao notificar webhook sigfull:", err));
  } catch (e) {
    console.error("Erro no fetch sigfull:", e);
  }

  try {
    const prompt = `
Aja como um executivo sênior e consultor estratégico de vendas B2B da Signum. Você está falando diretamente com o empresário / CEO ativo chamado "${name}", dono ou líder da empresa "${company || 'sua empresa'}". Seu tom deve ser direto, profissional, altamente analítico e perspicaz. Você deve mostrar pontos cegos na operação que um empresário geralmente não vê.
**REGRA ABSOLUTA: NÃO USE EMOJIS SOB NENHUMA HIPÓTESE. Zero emojis em todo o texto.**

O cliente respondeu a um diagnóstico da arquitetura comercial e o sistema detectou que o ponto mais crítico no momento é a área de: "${worstCategory || 'Escala e Processos'}".

Aqui está o resumo das respostas do diagnóstico dele:
${answersText}

O que você deve fazer:
1. Comece cumprimentando o ${name} pelo nome e faça uma leitura estratégica de 1 parágrafo sobre o cenário da empresa dele baseado nas respostas. Mostre que você entende o peso do problema.
2. Aponte 2 a 3 "pontos cegos" ou riscos ocultos graves que as respostas dele revelam (ex: se ele depende de indicação, mostre como isso mata o valuation; se o fundador vende tudo, mostre o gargalo de escala).
3. Faça a ponte de como a Signum resolve isso através de UM ou MAIS dos nossos 3 pilares, dependendo da dor dele:
   - **Signum Performance:** Se o problema é falta de canais, funil bagunçado, falta de previsibilidade, falta de playbook estruturado.
   - **Signum Talent:** Se o problema é equipe fraca, turnover alto, recrutamento errado, falta de cultura comercial, necessidade de bons vendedores (hunters/closers).
   - **Signum Operação 360:** Se a empresa precisa de tudo, reestruturação completa end-to-end (Geralmente para quem tem muito gargalo junto ou tickets de alto valor precisando de profissionalização severa).
4. Termine com uma conclusão firme sobre o próximo passo óbvio que o CEO deve tomar e faça uma chamada sutil e elegante para ele avançar de fase e estruturar a máquina com a Signum.

Formatação exigida:
Formate a sua resposta usando APENAS HTML sem tags de estrutura de página (sem html, head, body, script).
Use as tags HTML adequadas: <h3> para títulos das seções, <p> para parágrafos, <ul> e <li> para listas de pontos cegos ou pilares. Use <strong> para destacar termos ou frases cruciais. A resposta será inserida diretamente em uma div da página dele.
Mantenha o texto com cerca de 3 a 5 parágrafos bem espaçados. Lembre-se: ZERO EMOJIS.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um C-level experiente em crescimento corporativo B2B e vendas complexas da Signum. Sem rodeios, sem emojis, altamente analítico e estratégico em HTML." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const aiResponseHTML = completion.choices[0].message.content;

    res.json({
      success: true,
      html: aiResponseHTML
    });

  } catch (error) {
    console.error("Erro na OpenAI API:", error);
    res.status(500).json({ error: "Erro ao gerar diagnóstico inteligente." });
  }
});

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
