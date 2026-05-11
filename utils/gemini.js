// utils/gemini.js — chatbot + Form16 only
// Tries multiple endpoints/models until one works

const ATTEMPTS = [
  { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent' },
  { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent' },
  { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent' },
];

function cleanJSON(t) { return t.replace(/```json/gi,'').replace(/```/g,'').trim(); }

async function callGemini(contents) {
  const key = process.env.GEMINI_API_KEY;
  let lastErr = '';
  for (const { url } of ATTEMPTS) {
    try {
      const res = await fetch(`${url}?key=${key}`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          contents,
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) return text;
      }
      const err = await res.text().catch(() => res.statusText);
      lastErr = `${url.split('/models/')[1].split(':')[0]}: ${res.status}`;
      console.warn(`[Gemini] Failed — ${lastErr}`);
    } catch (e) {
      lastErr = e.message;
      console.warn(`[Gemini] Error — ${lastErr}`);
    }
  }
  throw new Error(`Gemini failed: ${lastErr}`);
}

async function ask(prompt) {
  return callGemini([{ role: 'user', parts: [{ text: prompt }] }]);
}

async function askJSON(prompt) {
  const raw = await ask(prompt);
  try { return JSON.parse(cleanJSON(raw)); }
  catch { throw new Error('Gemini returned invalid JSON'); }
}

async function askVision(prompt, base64Data, mimeType = 'application/pdf') {
  return callGemini([{ role:'user', parts:[{ text: prompt },{ inlineData:{ data: base64Data, mimeType }}]}]);
}

async function askVisionJSON(prompt, base64Data, mimeType = 'application/pdf') {
  const raw = await askVision(prompt, base64Data, mimeType);
  try { return JSON.parse(cleanJSON(raw)); }
  catch { throw new Error('Gemini Vision returned invalid JSON'); }
}

module.exports = { ask, askJSON, askVision, askVisionJSON };
