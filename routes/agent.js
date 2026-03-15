// ─────────────────────────────────────────────
//  routes/agent.js
//  POST /api/agent
//  Phase 3 — full agentic loop goes here
//  For now: placeholder so server starts cleanly
// ─────────────────────────────────────────────

const express  = require('express');
const router   = express.Router();

router.post('/', async (req, res) => {
  // Full agentic loop written in Phase 3
  res.json({
    success: true,
    message: 'Agent route ready — agentic loop coming in Phase 3',
    received: req.body
  });
});

module.exports = router;
