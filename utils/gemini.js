const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

function cleanJSON(text) {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

async function ask(prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function askJSON(prompt) {
  const raw = await ask(prompt);
  try { return JSON.parse(cleanJSON(raw)); }
  catch (e) { throw new Error('Gemini returned invalid JSON'); }
}

async function askVision(prompt, base64Data, mimeType = 'application/pdf') {
  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64Data, mimeType: mimeType } }
  ]);
  return result.response.text();
}

async function askVisionJSON(prompt, base64Data, mimeType = 'application/pdf') {
  const raw = await askVision(prompt, base64Data, mimeType);
  try { return JSON.parse(cleanJSON(raw)); }
  catch (e) { throw new Error('Gemini Vision returned invalid JSON'); }
}

module.exports = { ask, askJSON, askVision, askVisionJSON };
