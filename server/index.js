import 'dotenv/config';
import express from 'express';

const app = express();
const port = Number(process.env.PORT || 8787);
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(apiKey),
    provider: apiKey ? 'OpenAI-compatible' : null,
    model: apiKey ? model : null
  });
});

app.post('/api/chat', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  if (message.length > 6000) return res.status(413).json({ error: 'Message is too long (maximum 6000 characters).' });
  if (!apiKey) {
    return res.status(503).json({
      error: 'AI provider is not configured. Add OPENAI_API_KEY to the server environment, then restart the server.'
    });
  }

  const assistantMode = req.body?.model === 'Nova Reasoner' ? 'reasoning-focused' : 'visual-design-focused';
  const hasAsset = Boolean(req.body?.hasAsset);
  const systemPrompt = [
    'You are Nova, a careful 3D asset design assistant inside Nova 3D AI Studio.',
    'Give practical, accurate guidance about 3D modeling, topology, materials, lighting, and asset workflows.',
    'Do not claim to inspect geometry or files unless their data was actually provided.',
    'The app currently supports importing and exporting models, but does not yet generate or edit 3D geometry with AI.',
    'When asked to generate a model, explain that AI text-to-3D is not connected yet and offer a useful modeling specification instead.',
    'Current user mode: ' + assistantMode + '.',
    'A model is loaded in the viewport: ' + (hasAsset ? 'yes' : 'no') + '.'
  ].join(' ');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let upstream;
    try {
      upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.5,
          max_tokens: 700
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const providerMessage = payload?.error?.message;
      return res.status(502).json({
        error: typeof providerMessage === 'string'
          ? 'AI provider error: ' + providerMessage.slice(0, 240)
          : 'AI provider request failed with status ' + upstream.status + '.'
      });
    }

    const reply = payload?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      return res.status(502).json({ error: 'AI provider returned an empty response.' });
    }
    return res.json({ reply: reply.trim(), model });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return res.status(502).json({
      error: timedOut ? 'AI provider request timed out. Please try again.' : 'Could not reach the AI provider. Check the server connection.'
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log('Nova API server listening on port ' + port);
});
