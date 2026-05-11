// ─────────────────────────────────────────────
//  utils/gemini.js — Direct REST API (v1)
//  Used ONLY by: drainzeroAgent (chatbot/RAG)
//                documents (Form 16 vision)
//  NOT used by: tax calculator, profile, analyse
// ─────────────────────────────────────────────

// Primary: gemini-2.5-flash-lite (confirmed quota: 10 RPM / 20 RPD)
// Fallback: gemini-3.1-flash-lite (500 RPD — better for demo)
const CHAT_MODEL    = 'gemini-2.5-flash-lite';
const VISION_MODEL  = 'gemini-2.5-flash-lite';
const BASE_URL      = 'https://generativelanguage.googleapis.com/v1/models';

function cleanJSON(text) {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

async function callGemini(model, contents) {
  const key = process.env.GEMINI_API_KEY;
  const url = `${BASE_URL}/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Text call — used by chatbot agent only ──
async function ask(prompt) {
  return callGemini(CHAT_MODEL, [{ role: 'user', parts: [{ text: prompt }] }]);
}

// ── JSON call — used by chatbot agent only ──
async function askJSON(prompt) {
  const raw = await ask(prompt);
  try {
    return JSON.parse(cleanJSON(raw));
  } catch (e) {
    console.error('[Gemini] JSON parse failed:', raw?.substring(0, 200));
    throw new Error('Gemini returned invalid JSON');
  }
}

// ── Vision call — used by Form 16 upload only ──
async function askVision(prompt, base64Data, mimeType = 'application/pdf') {
  return callGemini(VISION_MODEL, [{
    role : 'user',
    parts: [
      { text: prompt },
      { inlineData: { data: base64Data, mimeType } }
    ]
  }]);
}

// ── Vision + JSON — used by Form 16 upload only ──
async function askVisionJSON(prompt, base64Data, mimeType = 'application/pdf') {
  const raw = await askVision(prompt, base64Data, mimeType);
  try {
    return JSON.parse(cleanJSON(raw));
  } catch (e) {
    console.error('[Gemini Vision] JSON parse failed:', raw?.substring(0, 200));
    throw new Error('Gemini Vision returned invalid JSON');
  }
}

module.exports = { ask, askJSON, askVision, askVisionJSON };
