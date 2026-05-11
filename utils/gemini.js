// utils/gemini.js — Direct REST API v1, chatbot + Form16 only
const MODELS   = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'];
const BASE_URL = 'https://generativelanguage.googleapis.com/v1/models';

function cleanJSON(t) { return t.replace(/```json/gi,'').replace(/```/g,'').trim(); }

async function callGemini(contents) {
  const key = process.env.GEMINI_API_KEY;
  for (const model of MODELS) {
    const res = await fetch(`${BASE_URL}/${model}:generateContent?key=${key}`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ contents, generationConfig: { temperature: 0.3, maxOutputTokens: 1024 } }),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    const err = await res.text();
    console.warn(`[Gemini] ${model} failed (${res.status}), trying next...`, err.substring(0,100));
  }
  throw new Error('All Gemini models failed');
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
