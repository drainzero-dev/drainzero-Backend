// ─────────────────────────────────────────────
//  tools/kbSearch.js
//  Searches DrainZero knowledge base in Supabase
//  Uses text search (pgvector embeddings optional later)
// ─────────────────────────────────────────────

const supabase = require('../utils/supabase');

// ── MAIN SEARCH ──
// Searches KB for relevant tax sections matching the query
async function searchKB(query, limit = 5) {
  try {
    // Text search across title + content + tags
    // Later upgrade: replace with pgvector semantic search
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('id, title, category, content, section, tags, updated_fy')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%,section.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;

    return {
      results: data || [],
      count  : (data || []).length,
      query
    };
  } catch (err) {
    console.error('[kbSearch] Error:', err.message);
    return { results: [], count: 0, query, error: err.message };
  }
}

// ── CATEGORY SEARCH ──
// Get all entries for a specific category (e.g., 'deductions', 'loopholes')
async function searchKBByCategory(category, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('id, title, category, content, section, tags, updated_fy')
      .eq('category', category)
      .limit(limit);

    if (error) throw error;
    return { results: data || [], count: (data || []).length };
  } catch (err) {
    console.error('[kbSearch] Category error:', err.message);
    return { results: [], count: 0, error: err.message };
  }
}

// ── SECTION SEARCH ──
// Look up a specific section (e.g., '80C', '80D', 'HRA')
async function searchKBBySection(section) {
  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .ilike('section', `%${section}%`)
      .limit(3);

    if (error) throw error;
    return { results: data || [], count: (data || []).length };
  } catch (err) {
    console.error('[kbSearch] Section error:', err.message);
    return { results: [], count: 0, error: err.message };
  }
}

module.exports = { searchKB, searchKBByCategory, searchKBBySection };
