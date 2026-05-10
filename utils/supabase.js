// ─────────────────────────────────────────────
//  utils/supabase.js
//  Single Supabase client — service role key
// ─────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service role — bypasses RLS
);

module.exports = supabase;
