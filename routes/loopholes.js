// ─────────────────────────────────────────────
//  routes/loopholes.js
//  GET /api/loopholes?userId=xxx
// ─────────────────────────────────────────────

const express              = require('express');
const router               = express.Router();
const supabase             = require('../utils/supabase');
const { matchLoopholes }   = require('../tools/loopholeMatcher');

router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { data: user }   = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    const { data: income } = await supabase.from('income_profile').select('*').eq('user_id', userId).maybeSingle();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = { ...user, ...income };
    const result  = matchLoopholes(profile);

    res.json({ success: true, ...result });

  } catch (err) {
    console.error('[/api/loopholes]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
