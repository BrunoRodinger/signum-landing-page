const { OpenAI } = require('openai');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, company, email, phone, answersText, worstCategory } = req.body;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Serviço de IA não configurado.' });
  if (!name || !answersText) return res.status(400).json({ error: 'Nome e respostas são obrigatórios.' });

  fetch('https://n8n.zetaloc.com.br/webhook/sigfull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body)
  }).catch(err => console.error('Webhook error:', err));

  try {
    const openai = new OpenAI({ apiKey });

    const prompt = `
Aja como um executivo sênior e consultor estratégico de vendas B2B da Signum. Você está falando diretamente com o empresário / CEO ativo chamado "${name}", dono ou líder da empresa "${company || 'sua empresa'}". Seu tom deve ser direto, profissional, altamente analítico e perspicaz.
**REGRA ABSOLUTA: NÃO USE EMOJIS SOB NENHUMA HIPÓTESE.**

O ponto mais crítico detectado é: "${worstCategory || 'Escala e Processos'}".

Respostas do diagnóstico:
${answersText}

1. Cumprimente ${name} e faça uma leitura estratégica do cenário.
2. Aponte 2 a 3 pontos cegos ou riscos ocultos graves.
3. Mostre como a Signum resolve isso (Signum Performance, Signum Talent ou Signum Operação 360).
4. Conclua com o próximo passo óbvio.

Use APENAS HTML sem tags de estrutura de página. Use <h3>, <p>, <ul>, <li>, <strong>. ZERO EMOJIS.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um C-level experiente em crescimento corporativo B2B da Signum. Sem emojis, altamente analítico, responde em HTML.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    res.json({ success: true, html: completion.choices[0].message.content });
  } catch (error) {
    console.error('OpenAI error:', error);
    res.status(500).json({ error: 'Erro ao gerar diagnóstico.' });
  }
};
