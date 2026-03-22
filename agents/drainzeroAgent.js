// ─────────────────────────────────────────────
//  agents/drainzeroAgent.js
//  DrainZero Optimized Agent
//  Single-pass: Context → Tool → Respond
//  Max 2 Gemini calls per message (within 10 RPM)
// ─────────────────────────────────────────────

const { askJSON, ask }           = require('../utils/gemini');
const { searchKB }               = require('../tools/kbSearch');
const { webSearch }              = require('../tools/webSearch');
const { calculateTax }           = require('../tools/taxCalculator');
const { matchLoopholes }         = require('../tools/loopholeMatcher');
const { findBenefits }           = require('../tools/benefitsFinder');
const supabase                   = require('../utils/supabase');

// ── CONSTANTS ──
const MAX_KB_CHARS   = 2000;
const MAX_HISTORY    = 4;        // last 4 messages only
const sleep          = (ms) => new Promise(r => setTimeout(r, ms));

// ── TRIM TOOL RESULTS ──
function trimResult(obj, maxChars = MAX_KB_CHARS) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  if (str.length <= maxChars) return str;
  return str.substring(0, maxChars) + '... [trimmed]';
}

// ── FETCH USER PROFILE ──
async function fetchProfile(userId) {
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userErr || !user) throw new Error('User profile not found');

  const { data: income } = await supabase
    .from('income_profile')
    .select('*')
    .eq('user_id', userId)
    .single();

  return { ...user, ...(income || {}) };
}

// ── FETCH CONVERSATION HISTORY ──
async function fetchHistory(userId) {
  const { data } = await supabase
    .from('chat_history')
    .select('role, message')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY);

  if (!data || data.length === 0) return [];
  return data.reverse().map(m => `${m.role.toUpperCase()}: ${m.message}`);
}

// ── SAVE MESSAGE TO DB ──
async function saveMessage(userId, role, message, meta = {}) {
  await supabase.from('chat_history').insert({
    user_id       : userId,
    role,
    message,
    iterations_run: meta.iterationsRun || 0,
    tools_used    : meta.toolsUsed     || [],
    action_cards  : meta.actionCards   || [],
    kb_citations  : meta.kbCitations   || [],
    created_at    : new Date().toISOString()
  });
}

// ── BUILD SYSTEM CONTEXT ──
function buildSystemContext(profile, history) {
  const historyText = history.length > 0
    ? `\nRECENT CONVERSATION:\n${history.join('\n')}`
    : '';

  return `You are DrainZero, an expert Indian tax optimisation AI.
FY 2025-26 rules. Always personalise to this user's exact numbers.

USER:
- Name: ${profile.name || profile.full_name || 'User'}
- Age: ${profile.age || 'Unknown'}, ${profile.marital_status || ''}, ${profile.state || ''}
- Employment: ${profile.employment_type || profile.profession_type || 'Unknown'}, ${profile.sector || ''}
- Gross Salary: ₹${(profile.gross_salary || 0).toLocaleString('en-IN')}
- 80C: ₹${(profile.section_80c || 0).toLocaleString('en-IN')} | 80D: ₹${(profile.section_80d || 0).toLocaleString('en-IN')} | NPS: ₹${(profile.nps_personal || 0).toLocaleString('en-IN')}
- Regime: ${profile.preferred_regime || 'Not set'}
${historyText}`;
}

// ── SMART TOOL PICKER (Rule-based — NO Gemini call) ──
// Avoids 1 Gemini call by using keyword matching instead of AI planner
function pickTool(userMessage) {
  const msg = userMessage.toLowerCase();

  if (msg.includes('loophole') || msg.includes('legal') || msg.includes('trick') || msg.includes('save tax')) {
    return { tool: 'loophole_matcher', query: userMessage };
  }
  if (msg.includes('benefit') || msg.includes('scheme') || msg.includes('scholarship') || msg.includes('govt')) {
    return { tool: 'benefits_finder', query: userMessage };
  }
  if (msg.includes('how much tax') || msg.includes('tax calculat') || msg.includes('old regime') || msg.includes('new regime') || msg.includes('which regime')) {
    return { tool: 'tax_calculator', query: userMessage };
  }
  if (msg.includes('latest') || msg.includes('budget 2025') || msg.includes('budget 2026') || msg.includes('new rule') || msg.includes('recent')) {
    return { tool: 'web_search', query: `${userMessage} India FY 2025-26` };
  }
  // Default — search knowledge base
  return { tool: 'kb_search', query: userMessage };
}

// ── EXECUTE TOOL ──
async function executeTool(toolName, query, profile) {
  switch (toolName) {
    case 'kb_search': {
      const result = await searchKB(query, 4);
      if (!result.results?.length) return { tool: toolName, data: null, summary: 'No KB results found', citations: [] };
      const summary = result.results.map(r => `[${r.section}] ${r.title}: ${r.content.substring(0, 150)}`).join('\n');
      return {
        tool     : toolName,
        data     : result.results,
        summary  : trimResult(summary),
        citations: result.results.map(r => ({ section: r.section, title: r.title }))
      };
    }
    case 'web_search': {
      const result = await webSearch(query, 4);
      if (!result.results?.length) return { tool: toolName, data: null, summary: 'No web results found', citations: [] };
      const summary = result.results.map(r => `${r.title}: ${r.snippet}`).join('\n');
      return { tool: toolName, data: result.results, summary: trimResult(summary), citations: [] };
    }
    case 'tax_calculator': {
      try {
        const result  = calculateTax(profile);
        const summary = `Old: ₹${result.oldRegime.totalTax.toLocaleString('en-IN')} | New: ₹${result.newRegime.totalTax.toLocaleString('en-IN')} | Best: ${result.recommendedRegime} | Save: ₹${result.saving.toLocaleString('en-IN')} | Health: ${result.healthScore}/100`;
        return { tool: toolName, data: result, summary, citations: [] };
      } catch (e) {
        return { tool: toolName, data: null, summary: `Calculation error: ${e.message}`, citations: [] };
      }
    }
    case 'loophole_matcher': {
      try {
        const result  = matchLoopholes(profile);
        const summary = `${result.matchedCount} loopholes: ${result.matched.map(l => l.title).join(', ')}`;
        return { tool: toolName, data: result.matched, summary: trimResult(summary), citations: [] };
      } catch (e) {
        return { tool: toolName, data: null, summary: `Error: ${e.message}`, citations: [] };
      }
    }
    case 'benefits_finder': {
      try {
        const result  = findBenefits(profile);
        const summary = `${result.matchedCount} benefits: ${result.matched.map(b => b.title).join(', ')}`;
        return { tool: toolName, data: result.matched, summary: trimResult(summary), citations: [] };
      } catch (e) {
        return { tool: toolName, data: null, summary: `Error: ${e.message}`, citations: [] };
      }
    }
    default:
      return { tool: toolName, data: null, summary: 'Unknown tool', citations: [] };
  }
}

// ── RESPONDER (1 Gemini call — the only AI call) ──
async function runResponder(systemContext, userMessage, toolResult, profile) {
  const prompt = `${systemContext}

USER QUESTION: "${userMessage}"

TOOL USED: ${toolResult.tool}
FINDINGS: ${toolResult.summary}

Write a helpful, personalised response. Use ₹ amounts from user profile.

Respond ONLY with valid JSON:
{
  "message": "Response text with line breaks (\\n). Specific ₹ amounts. Cite tax sections.",
  "savingsFound": [{"title": "...", "section": "...", "amount": 0, "action": "..."}],
  "actionCards": [{"type": "calculate|remind|profile|learn", "label": "...", "data": "..."}],
  "recommendedRegime": "old|new|null",
  "totalSaving": 0
}`;

  try {
    const result = await askJSON(prompt);
    return { ...result, kbCitations: toolResult.citations || [] };
  } catch (e) {
    // Fallback to plain text if JSON fails
    const text = await ask(`${systemContext}\n\nQ: "${userMessage}"\nFindings: ${toolResult.summary}\n\nGive a helpful, concise answer.`);
    return {
      message          : text,
      savingsFound     : [],
      actionCards      : [],
      recommendedRegime: null,
      totalSaving      : 0,
      kbCitations      : toolResult.citations || []
    };
  }
}

// ── MAIN AGENT FUNCTION ──
// Total Gemini calls: 1 (responder only) — well within 10 RPM
async function runAgent(userId, userMessage, onStatus = null) {
  const startTime = Date.now();
  const status    = (msg) => { console.log(`[Agent] ${msg}`); if (onStatus) onStatus(msg); };

  try {
    // Save user message
    await saveMessage(userId, 'user', userMessage);

    status('Loading your profile...');
    const profile       = await fetchProfile(userId);
    const history       = await fetchHistory(userId);
    const systemContext = buildSystemContext(profile, history);

    // Pick tool using rules (no Gemini call)
    const { tool, query } = pickTool(userMessage);
    status(`Searching ${tool.replace(/_/g, ' ')}...`);

    // Execute tool
    const toolResult = await executeTool(tool, query, profile);

    // Small delay to respect rate limits
    await sleep(500);

    // Generate response (1 Gemini call)
    status('Preparing your answer...');
    const response = await runResponder(systemContext, userMessage, toolResult, profile);

    // Save AI response
    await saveMessage(userId, 'ai', response.message, {
      iterationsRun: 1,
      toolsUsed    : [tool],
      actionCards  : response.actionCards || [],
      kbCitations  : response.kbCitations || []
    });

    return {
      success          : true,
      message          : response.message,
      savingsFound     : response.savingsFound     || [],
      actionCards      : response.actionCards      || [],
      recommendedRegime: response.recommendedRegime || null,
      totalSaving      : response.totalSaving      || 0,
      kbCitations      : response.kbCitations      || [],
      meta: {
        iterationsRun: 1,
        toolsUsed    : [tool],
        goalAchieved : true,
        timeMs       : Date.now() - startTime,
        partial      : false
      }
    };

  } catch (err) {
    console.error('[Agent] Error:', err.message);
    await saveMessage(userId, 'ai', 'I encountered an error. Please try again.', {}).catch(() => {});
    return {
      success: false,
      message: 'I encountered an error. Please try again in a moment.',
      error  : err.message,
      meta   : { timeMs: Date.now() - startTime }
    };
  }
}

module.exports = { runAgent };
