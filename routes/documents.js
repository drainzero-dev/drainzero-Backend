// ─────────────────────────────────────────────
//  routes/documents.js
//  POST /api/documents
//  Phase 3 — Gemini Vision extraction goes here
// ─────────────────────────────────────────────

const express  = require('express');
const router   = express.Router();

router.post('/', async (req, res) => {
  res.json({
    success: true,
    message: 'Documents route ready — Gemini Vision extraction coming in Phase 3'
  });
});

module.exports = router;
