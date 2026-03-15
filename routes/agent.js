// ─────────────────────────────────────────────
//  routes/agent.js
//  POST /api/agent
//  Runs the full DrainZero agentic loop
//  Supports both regular and streaming responses
// ─────────────────────────────────────────────

const express        = require('express');
const router         = express.Router();
const { runAgent }   = require('../agents/drainzeroAgent');

// ── POST /api/agent ──
// Regular response — waits for full loop to complete
router.post('/', async (req, res) => {
  try {
    const { userId, message, stream } = req.body;

    // ── Validation ──
    if (!userId)  return res.status(400).json({ error: 'userId is required' });
    if (!message) return res.status(400).json({ error: 'message is required' });
    if (message.trim().length === 0) return res.status(400).json({ error: 'message cannot be empty' });
    if (message.length > 2000) return res.status(400).json({ error: 'message too long (max 2000 chars)' });

    // ── Streaming mode ──
    // Sends status updates as Server-Sent Events while loop runs
    if (stream === true) {
      res.setHeader('Content-Type',  'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection',    'keep-alive');

      // Status callback — sends progress to frontend
      const onStatus = (statusMsg) => {
        res.write(`data: ${JSON.stringify({ type: 'status', message: statusMsg })}\n\n`);
      };

      const result = await runAgent(userId, message, onStatus);

      // Send final result
      res.write(`data: ${JSON.stringify({ type: 'result', ...result })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // ── Regular mode ──
    // Returns everything at once when loop is complete
    const result = await runAgent(userId, message);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);

  } catch (err) {
    console.error('[/api/agent]', err.message);
    res.status(500).json({
      success: false,
      error  : err.message,
      message: 'Something went wrong. Please try again.'
    });
  }
});

// ── GET /api/agent/history ──
// Returns conversation history for a user
router.get('/history', async (req, res) => {
  try {
    const { userId, limit = 20 } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const supabase = require('../utils/supabase');
    const { data, error } = await supabase
      .from('chat_history')
      .select('id, role, message, action_cards, kb_citations, created_at, iterations_run, tools_used')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json({ success: true, history: data || [], count: (data || []).length });

  } catch (err) {
    console.error('[/api/agent/history]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/agent/history ──
// Clears conversation history for a user
router.delete('/history', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const supabase = require('../utils/supabase');
    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true, message: 'Conversation history cleared' });

  } catch (err) {
    console.error('[/api/agent/history DELETE]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
