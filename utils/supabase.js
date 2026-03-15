// ─────────────────────────────────────────────
//  utils/supabase.js
//  Single Supabase client used across all files
// ─────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY   // service key — full DB access, backend only
);

module.exports = supabase;
