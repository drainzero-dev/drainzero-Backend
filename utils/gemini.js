// ─────────────────────────────────────────────
//  utils/gemini.js
//  Wrapper for all Gemini API calls
//  Used by: planner, evaluator, responder, vision
// ─────────────────────────────────────────────

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// ── Strip markdown fences Gemini sometimes wraps JSON in ──
function cleanJSON(text) {
  return text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

// ── Basic text call — returns string ──
async function ask(prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ── JSON call — returns parsed object ──
// Use this whenever you need structured output from Gemini
async function askJSON(prompt) {
  const raw = await ask(prompt);
  try {
    return JSON.parse(cleanJSON(raw));
  } catch (e) {
    console.error('[Gemini] JSON parse failed:', raw);
    throw new Error('Gemini returned invalid JSON');
  }
}

// ── Vision call — for Form 16 / AIS extraction ──
async function askVision(prompt, base64Data, mimeType = 'application/pdf') {
  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data    : base64Data,
        mimeType: mimeType
      }
    }
  ]);
  return result.response.text();
}

// ── Vision + JSON — returns parsed extracted data ──
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
