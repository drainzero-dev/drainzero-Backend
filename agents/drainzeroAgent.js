// ─────────────────────────────────────────────
//  agents/drainzeroAgent.js
//  DrainZero Optimized Agent
//  1 Gemini call per message + guardrails + web search
// ─────────────────────────────────────────────

const { askJSON, ask }       = require('../utils/gemini');
const { searchKB }           = require('../tools/kbSearch');
const { webSearch }          = require('../tools/webSearch');
const { calculateTax }       = require('../tools/taxCalculator');
const { matchLoopholes }     = require('../tools/loopholeMatcher');
const { findBenefits }       = require('../tools/benefitsFinder');
const supabase               = require('../utils/supabase');

// ── CONSTANTS ──
const MAX_KB_CHARS = 2000;
const MAX_HISTORY  = 4;
const sleep        = (ms) => new Promise(r => setTimeout(r, ms));

// ── GUARDRAILS — Block non-tax questions ──
const TAX_KEYWORDS = [
  'tax', 'income', 'salary', 'deduction', 'regime', 'itr', 'return', 'tds',
  'gst', 'invest', 'saving', 'loophole', 'benefit', 'section', '80c', '80d',
  'nps', 'hra', 'refund', 'pan', 'form 16', 'form16', 'ais', 'ca', 'chartered',
  'fiscal', 'finance', 'money', 'rupee', '₹', 'pay', 'exempt', 'rebate',
  'surcharge', 'cess', 'property', 'capital gain', 'ltcg', 'stcg', 'crypto',
  'mutual fund', 'elss', 'ppf', 'fd', 'fixed deposit', 'insurance', 'premium',
  'advance tax', 'challan', 'assessment', 'audit', 'depreciation', 'business',
  'freelance', 'profession', 'rent', 'housing loan', 'home loan', 'vehicle',
  'electric', 'ev', 'how much', 'how to', 'should i', 'can i', 'what is',
  'which', 'when', 'why', 'where', 'help', 'drainzero', 'analyze', 'suggest'
];

function isOffTopic(message) {
  const msg = message.toLowerCase();
  // Allow general financial/help questions
  const hasTaxKeyword = TAX_KEYWORDS.some(k => msg.includes(k));
  if (hasTaxKeyword) return false;

  // Block clearly off-topic
  const offTopicPatterns = [
    /\b(cricket|football|sport|game|movie|film|song|music|recipe|cook|weather|news|politics|religion|love|relationship|dating)\b/i,
    /\b(write.*code|program|javascript|python|html|css|hack|chatgpt|openai)\b/i,
    /\b(joke|funny|meme|tiktok|instagram|youtube|netflix)\b/i,
  ];
  return offTopicPatterns.some(p => p.test(msg));
}

const OFF_TOPIC_RESPONSE = {
  success          : true,
  message          : "I'm DrainZero, your Indian tax optimization assistant! 🇮🇳\n\nI can only help with tax-related questions like:\n• Which tax regime saves you more?\n• How to maximize your deductions\n• Legal loopholes to reduce tax\n• Form 16, ITR, TDS queries\n• Investment options for tax saving\n\nPlease ask me something related to your taxes! 😊",
  savingsFound     : [],
  actionCards      : [],
  recommendedRegime: null,
  totalSaving      : 0,
  kbCitations      : [],
  meta             : { iterationsRun: 0, toolsUsed: [], goalAchieved: true, timeMs: 0 }
};

// ── TRIM TOOL RESULTS ──
function trimResult(obj, maxChars = MAX_KB_CHARS) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return str.length <= maxChars ? str : str.substring(0, maxChars) + '... [trimmed]';
}

// ── FETCH USER PROFILE ──
async function fetchProfile(userId) {
  const { data: user, error } = await supabase
    .from('users').select('*').eq('id', userId).single();
  if (error || !user) throw new Error('User profile not found');
  const { data: income } = await supabase
    .from('income_profile').select('*').eq('user_id', userId).single();
  return { ...user, ...(income || {}) };
}

// ── FETCH CONVERSATION HISTORY ──
async function fetchHistory(userId) {
  const { data } = await supabase
    .from('chat_history').select('role, message')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY);
  if (!data?.length) return [];
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
    ? `\nRECENT CONVERSATION:\n${history.join('\n')}` : '';

  return `You are DrainZero, an expert Indian tax optimisation AI for FY 2025-26.
ONLY answer tax, finance, and investment related questions.
Always personalise answers using the user's exact numbers below.

USER PROFILE:
- Name: ${profile.name || profile.full_name || 'User'}
- Age: ${profile.age || 'Unknown'} | ${profile.marital_status || ''} | ${profile.state || ''}
- Employment: ${profile.employment_type || profile.profession_type || 'Unknown'} | ${profile.sector || ''}
- Gross Salary: ₹${(profile.gross_salary || 0).toLocaleString('en-IN')}
- 80C: ₹${(profile.section_80c || 0).toLocaleString('en-IN')} | 80D: ₹${(profile.section_80d || 0).toLocaleString('en-IN')} | NPS: ₹${(profile.nps_personal || 0).toLocaleString('en-IN')}
- HRA: ₹${(profile.hra_received || 0).toLocaleString('en-IN')} | Rent: ₹${(profile.rent_paid || 0).toLocaleString('en-IN')}
- Preferred Regime: ${profile.preferred_regime || 'Not set'}
- City: ${profile.city || ''} | Metro: ${profile.is_metro ? 'Yes' : 'No'}
${historyText}`;
}

// ── SMART TOOL PICKER (keyword-based — no Gemini call) ──
function pickTool(userMessage) {
  const msg = userMessage.toLowerCase();

  // Latest news / budget updates → web search
  if (msg.includes('latest') || msg.includes('budget 2026') || msg.includes('budget 2025') ||
      msg.includes('new rule') || msg.includes('recent change') || msg.includes('news') ||
      msg.includes('today') || msg.includes('current')) {
    return { tool: 'web_search', query: `${userMessage} India income tax FY 2025-26` };
  }

  // Tax calculation
  if (msg.includes('how much tax') || msg.includes('tax calculat') || msg.includes('old regime') ||
      msg.includes('new regime') || msg.includes('which regime') || msg.includes('compare regime') ||
      msg.includes('total tax') || msg.includes('my tax')) {
    return { tool: 'tax_calculator', query: userMessage };
  }

  // Loopholes
  if (msg.includes('loophole') || msg.includes('legal way') || msg.includes('save more tax') ||
      msg.includes('reduce tax') || msg.includes('trick') || msg.includes('strategy') ||
      msg.includes('huf') || msg.includes('rnor') || msg.includes('ltcg harvest')) {
    return { tool: 'loophole_matcher', query: userMessage };
  }

  // Benefits / schemes
  if (msg.includes('benefit') || msg.includes('scheme') || msg.includes('scholarship') ||
      msg.includes('government') || msg.includes('state benefit') || msg.includes('profession')) {
    return { tool: 'benefits_finder', query: userMessage };
  }

  // Default → knowledge base search
  return { tool: 'kb_search', query: userMessage };
}

// ── EXECUTE TOOL ──
async function executeTool(toolName, query, profile) {
  switch (toolName) {
    case 'kb_search': {
      const result = await searchKB(query, 4);
      if (!result.results?.length) {
        // Fallback to web search if KB has no results
        console.log('[Agent] KB empty, falling back to web search');
        const web = await webSearch(`${query} India income tax`, 3);
        const summary = web.results?.map(r => `${r.title}: ${r.snippet}`).join('\n') || 'No results';
        return { tool: 'web_search', data: web.results, summary: trimResult(summary), citations: [] };
      }
      const summary = result.results.map(r =>
        `[${r.section}] ${r.title}: ${r.content.substring(0, 150)}`).join('\n');
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
        const summary = `Old regime: ₹${result.oldRegime.totalTax.toLocaleString('en-IN')} | New regime: ₹${result.newRegime.totalTax.toLocaleString('en-IN')} | Recommended: ${result.recommendedRegime} | Annual saving: ₹${result.saving.toLocaleString('en-IN')} | Health score: ${result.healthScore}/100 | Leakage: ₹${result.totalLeakage.toLocaleString('en-IN')}`;
        return { tool: toolName, data: result, summary, citations: [] };
      } catch (e) {
        return { tool: toolName, data: null, summary: `Calculation error: ${e.message}`, citations: [] };
      }
    }

    case 'loophole_matcher': {
      try {
        const result  = matchLoopholes(profile);
        const summary = `${result.matchedCount} loopholes found: ${result.matched.map(l => `${l.title} (save ₹${(l.estimatedSaving||0).toLocaleString('en-IN')})`).join(', ')}`;
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

// ── RESPONDER (only Gemini call in the whole flow) ──
async function runResponder(systemContext, userMessage, toolResult) {
  const prompt = `${systemContext}

USER QUESTION: "${userMessage}"

TOOL: ${toolResult.tool}
FINDINGS: ${toolResult.summary}

Write a helpful, personalised Indian tax response.

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "message": "Response with \\n line breaks. Cite tax sections. Use ₹ amounts from user profile.",
  "savingsFound": [{"title": "...", "section": "80C etc", "amount": 0, "action": "exact step"}],
  "actionCards": [{"type": "calculate|remind|profile|learn", "label": "button text", "data": ""}],
  "recommendedRegime": "old|new|null",
  "totalSaving": 0
}`;

  try {
    const result = await askJSON(prompt);
    return { ...result, kbCitations: toolResult.citations || [] };
  } catch (e) {
    // Plain text fallback
    const text = await ask(
      `${systemContext}\n\nQ: "${userMessage}"\nFindings: ${toolResult.summary}\n\nGive a helpful, concise Indian tax answer in 3-4 sentences.`
    );
    return {
      message: text, savingsFound: [], actionCards: [],
      recommendedRegime: null, totalSaving: 0, kbCitations: toolResult.citations || []
    };
  }
}

// ── MAIN AGENT ──
async function runAgent(userId, userMessage, onStatus = null) {
  const startTime = Date.now();
  const status    = (msg) => { console.log(`[Agent] ${msg}`); if (onStatus) onStatus(msg); };

  try {
    // ── Guardrail check FIRST ──
    if (isOffTopic(userMessage)) {
      console.log('[Agent] Off-topic question blocked:', userMessage);
      await saveMessage(userId, 'user', userMessage);
      await saveMessage(userId, 'ai', OFF_TOPIC_RESPONSE.message, { iterationsRun: 0, toolsUsed: [] });
      return OFF_TOPIC_RESPONSE;
    }

    await saveMessage(userId, 'user', userMessage);

    status('Loading your profile...');
    const profile       = await fetchProfile(userId);
    const history       = await fetchHistory(userId);
    const systemContext = buildSystemContext(profile, history);

    // Pick tool (no Gemini call)
    const { tool, query } = pickTool(userMessage);
    status(`Searching ${tool.replace(/_/g, ' ')}...`);

    // Execute tool
    const toolResult = await executeTool(tool, query, profile);

    // Small delay to respect rate limits
    await sleep(300);

    // Generate response (1 Gemini call)
    status('Preparing your answer...');
    const response = await runResponder(systemContext, userMessage, toolResult);

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
