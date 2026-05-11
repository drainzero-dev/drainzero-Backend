// ─────────────────────────────────────────────
//  utils/gemini.js
//  Direct REST API — bypasses SDK v1beta issues
// ─────────────────────────────────────────────

const MODEL = 'gemini-1.5-flash';

function cleanJSON(text) {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

async function callGemini(contents) {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ contents }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function ask(prompt) {
  return callGemini([{ role: 'user', parts: [{ text: prompt }] }]);
}

async function askJSON(prompt) {
  const raw = await ask(prompt);
  try {
    return JSON.parse(cleanJSON(raw));
  } catch (e) {
    console.error('[Gemini] JSON parse failed:', raw);
    throw new Error('Gemini returned invalid JSON');
  }
}

async function askVision(prompt, base64Data, mimeType = 'application/pdf') {
  return callGemini([{
    role : 'user',
    parts: [
      { text: prompt },
      { inlineData: { data: base64Data, mimeType } }
    ]
  }]);
}

async function askVisionJSON(prompt, base64Data, mimeType = 'application/pdf') {
  const raw = await askVision(prompt, base64Data, mimeType);
  try {
    return JSON.parse(cleanJSON(raw));
  } catch (e) {
    console.error('[Gemini Vision] JSON parse failed:', raw);
    throw new Error('Gemini Vision returned invalid JSON');
  }
}

module.exports = { ask, askJSON, askVision, askVisionJSON };
