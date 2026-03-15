// ─────────────────────────────────────────────
//  agents/drainzeroAgent.js
//  DrainZero Full Agentic Loop
//  Plan → Execute → Evaluate → Respond
//  Max 6 iterations · 30s timeout · No tool repeats
// ─────────────────────────────────────────────

const { askJSON, ask }           = require('../utils/gemini');
const { searchKB }               = require('../tools/kbSearch');
const { webSearch }              = require('../tools/webSearch');
const { calculateTax }           = require('../tools/taxCalculator');
const { matchLoopholes }         = require('../tools/loopholeMatcher');
const { findBenefits }           = require('../tools/benefitsFinder');
const supabase                   = require('../utils/supabase');

// ── CONSTANTS ──
const MAX_ITERATIONS = 6;
const TIMEOUT_MS     = 30000;   // 30 seconds
const MAX_KB_CHARS   = 3000;    // trim KB results before sending to Gemini
const MAX_HISTORY    = 6;       // last 6 messages for context (3 turns)

// ── TRIM TOOL RESULTS ──
// Prevents token limit issues when passing results to Gemini
function trimResult(obj, maxChars = MAX_KB_CHARS) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  if (str.length <= maxChars) return str;
  return str.substring(0, maxChars) + '... [trimmed for brevity]';
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

  // Merge — income can be null for new users
  return { ...user, ...(income || {}) };
}

// ── FETCH CONVERSATION HISTORY ──
// Only last N messages to keep context manageable
async function fetchHistory(userId) {
  const { data } = await supabase
    .from('chat_history')
    .select('role, message')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY);

  if (!data || data.length === 0) return [];

  // Reverse so oldest is first
  return data.reverse().map(m => `${m.role.toUpperCase()}: ${m.message}`);
}

// ── SAVE MESSAGE TO DB ──
async function saveMessage(userId, role, message, meta = {}) {
  await supabase.from('chat_history').insert({
    user_id       : userId,
    role,
    message,
    iterations_run: meta.iterationsRun || 0,
    tools_used    : meta.toolsUsed || [],
    action_cards  : meta.actionCards || [],
    kb_citations  : meta.kbCitations || [],
    created_at    : new Date().toISOString()
  });
}

// ── BUILD SYSTEM CONTEXT ──
// Injects full user profile so Gemini knows everything about the user
function buildSystemContext(profile, history) {
  const historyText = history.length > 0
    ? `\nCONVERSATION HISTORY (last ${history.length} messages):\n${history.join('\n')}`
    : '\nCONVERSATION HISTORY: No previous messages.';

  return `You are DrainZero, an expert Indian tax optimisation AI assistant.
You have deep knowledge of Indian income tax law, FY 2025-26 rules, Budget 2026 changes,
legal tax loopholes, profession-specific benefits, and state-level schemes.

USER PROFILE:
- Name: ${profile.full_name || 'User'}
- Age: ${profile.age || 'Unknown'}
- State: ${profile.state || 'Unknown'}
- Profession: ${profile.profession_type || 'Unknown'} / ${profile.profession_subtype || ''}
- Residential Status: ${profile.residential_status || 'Resident'}
- Marital Status: ${profile.marital_status || 'Unknown'}
- Gross Salary: ₹${(profile.gross_salary || 0).toLocaleString('en-IN')}
- Basic + DA: ₹${(profile.basic_da || 0).toLocaleString('en-IN')}
- HRA Received: ₹${(profile.hra_received || 0).toLocaleString('en-IN')}
- Rent Paid: ₹${(profile.rent_paid || 0).toLocaleString('en-IN')}/month
- Section 80C: ₹${(profile.section_80c || 0).toLocaleString('en-IN')}
- Section 80D: ₹${(profile.section_80d || 0).toLocaleString('en-IN')}
- NPS Personal: ₹${(profile.nps_personal || 0).toLocaleString('en-IN')}
- Preferred Regime: ${profile.preferred_regime || 'Not set'}
- Assets: ${JSON.stringify(profile.assets || {})}
- Family: ${JSON.stringify(profile.family || {})}
${historyText}

RULES:
1. Always give specific ₹ amounts based on this user's actual numbers
2. Never give generic advice — personalise everything to this profile
3. Cite the exact tax section (80C, 44ADA, etc.) for every recommendation
4. If you're not sure about a rule, say so — don't hallucinate
5. Keep answers clear, actionable, and in Indian context`;
}

// ── STEP 2: PLANNER ──
// Gemini decides which tool to use next
async function runPlanner(systemContext, userMessage, findings, toolsUsed) {
  const availableTools = ['kb_search', 'web_search', 'tax_calculator', 'loophole_matcher', 'benefits_finder']
    .filter(t => !toolsUsed.includes(t));

  if (availableTools.length === 0) return null;

  const findingsSummary = findings.length > 0
    ? `Findings so far:\n${findings.map(f => `- ${f.tool}: ${f.summary}`).join('\n')}`
    : 'No findings yet.';

  const prompt = `${systemContext}

USER QUESTION: "${userMessage}"

${findingsSummary}

AVAILABLE TOOLS (pick ONE):
${availableTools.map(t => `- ${t}`).join('\n')}

Tool descriptions:
- kb_search: Search DrainZero's verified tax knowledge base (60+ entries)
- web_search: Search web for latest FY 2025-26 rules and Budget 2026 updates
- tax_calculator: Calculate exact old vs new regime tax for this user
- loophole_matcher: Find applicable legal tax loopholes for this user
- benefits_finder: Find profession + state + family specific benefits

Based on the user's question and findings so far, which tool should be used next?

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "tool": "tool_name_here",
  "query": "specific search query or instruction",
  "reason": "one sentence why this tool is needed"
}`;

  try {
    return await askJSON(prompt);
  } catch (e) {
    console.error('[Planner] Failed:', e.message);
    return null;
  }
}

// ── STEP 3: TOOL EXECUTOR ──
async function executeTool(toolName, query, profile) {
  switch (toolName) {
    case 'kb_search': {
      const result = await searchKB(query, 5);
      if (!result.results || result.results.length === 0) {
        return { tool: toolName, data: null, summary: 'No KB results found' };
      }
      const summary = result.results
        .map(r => `[${r.section}] ${r.title}: ${r.content.substring(0, 200)}`)
        .join('\n');
      return {
        tool   : toolName,
        data   : result.results,
        summary: trimResult(summary),
        citations: result.results.map(r => ({ section: r.section, title: r.title }))
      };
    }

    case 'web_search': {
      const result = await webSearch(query, 5);
      if (!result.results || result.results.length === 0) {
        return { tool: toolName, data: null, summary: 'No web results found' };
      }
      const summary = result.results
        .map(r => `${r.title}: ${r.snippet}`)
        .join('\n');
      return {
        tool   : toolName,
        data   : result.results,
        summary: trimResult(summary)
      };
    }

    case 'tax_calculator': {
      try {
        const result = calculateTax(profile);
        const summary = `Old regime: ₹${result.oldRegime.totalTax.toLocaleString('en-IN')} | New regime: ₹${result.newRegime.totalTax.toLocaleString('en-IN')} | Recommended: ${result.recommendedRegime} | Saving: ₹${result.saving.toLocaleString('en-IN')} | Health score: ${result.healthScore}/100 | Leakage: ₹${result.totalLeakage.toLocaleString('en-IN')}`;
        return {
          tool   : toolName,
          data   : result,
          summary: trimResult(summary)
        };
      } catch (e) {
        return { tool: toolName, data: null, summary: `Tax calculation error: ${e.message}` };
      }
    }

    case 'loophole_matcher': {
      try {
        const result = matchLoopholes(profile);
        const summary = `Found ${result.matchedCount} applicable loopholes: ${result.matched.map(l => l.title).join(', ')}`;
        return {
          tool   : toolName,
          data   : result.matched,
          summary: trimResult(summary)
        };
      } catch (e) {
        return { tool: toolName, data: null, summary: `Loophole matching error: ${e.message}` };
      }
    }

    case 'benefits_finder': {
      try {
        const result = findBenefits(profile);
        const summary = `Found ${result.matchedCount} benefits: ${result.matched.map(b => b.title).join(', ')}`;
        return {
          tool   : toolName,
          data   : result.matched,
          summary: trimResult(summary)
        };
      } catch (e) {
        return { tool: toolName, data: null, summary: `Benefits finder error: ${e.message}` };
      }
    }

    default:
      return { tool: toolName, data: null, summary: 'Unknown tool' };
  }
}

// ── STEP 4: EVALUATOR ──
// Gemini checks if the goal has been achieved
async function runEvaluator(systemContext, userMessage, findings) {
  const findingsSummary = findings
    .map(f => `Tool: ${f.tool}\nResult: ${f.summary}`)
    .join('\n\n');

  const prompt = `${systemContext}

USER QUESTION: "${userMessage}"

FINDINGS COLLECTED SO FAR:
${findingsSummary}

Evaluate if we have enough information to fully answer the user's question.

Consider:
1. Do we have specific ₹ amounts if numbers were asked?
2. Do we have the relevant tax sections/rules?
3. Do we have personalised recommendations for THIS user's profile?
4. Is there any critical missing information that would significantly change the answer?

Respond ONLY with valid JSON, no markdown:
{
  "achieved": true or false,
  "confidence": 0-100,
  "missing": "what is still missing (empty string if achieved=true)",
  "reason": "one sentence explanation"
}`;

  try {
    return await askJSON(prompt);
  } catch (e) {
    console.error('[Evaluator] Failed:', e.message);
    // If evaluator fails, assume goal is achieved to prevent infinite loop
    return { achieved: true, confidence: 60, missing: '', reason: 'Evaluator error — proceeding with available findings' };
  }
}

// ── STEP 5: RESPONDER ──
// Formats the final answer with action cards
async function runResponder(systemContext, userMessage, findings, profile) {
  const findingsSummary = findings
    .map(f => `Tool: ${f.tool}\nResult: ${f.summary}`)
    .join('\n\n');

  // Collect KB citations from findings
  const kbCitations = findings
    .filter(f => f.citations)
    .flatMap(f => f.citations);

  const prompt = `${systemContext}

USER QUESTION: "${userMessage}"

VERIFIED FINDINGS:
${findingsSummary}

Based on the above verified findings and the user's profile, write a complete, helpful response.

Format your response as JSON with this exact structure:
{
  "message": "Your main response text here. Use ₹ amounts. Be specific. Use line breaks (\\n) for readability.",
  "savingsFound": [
    {
      "title": "Short title",
      "section": "Tax section e.g. 80CCD(1B)",
      "amount": 15000,
      "action": "Exact step to take"
    }
  ],
  "actionCards": [
    {
      "type": "calculate | remind | profile | learn",
      "label": "Button label",
      "data": "relevant data or route"
    }
  ],
  "recommendedRegime": "old or new or null",
  "totalSaving": 0
}

Rules:
- savingsFound: list every specific saving opportunity found, with exact ₹ amounts
- actionCards: max 3 cards — most important actions user should take
- totalSaving: sum of all amounts in savingsFound
- message: conversational, warm, specific to this user — not generic
- If no savings found, still give helpful information in message`;

  try {
    const result = await askJSON(prompt);
    return { ...result, kbCitations };
  } catch (e) {
    console.error('[Responder] JSON parse failed, falling back to text');
    // Fallback — ask for plain text if JSON fails
    const textPrompt = `${systemContext}
    
USER QUESTION: "${userMessage}"

FINDINGS: ${findingsSummary}

Give a helpful, specific answer based on the findings. Be concise.`;

    const textResult = await ask(textPrompt);
    return {
      message          : textResult,
      savingsFound     : [],
      actionCards      : [],
      recommendedRegime: null,
      totalSaving      : 0,
      kbCitations      : []
    };
  }
}

// ── MAIN AGENT FUNCTION ──
async function runAgent(userId, userMessage, onStatus = null) {
  const startTime    = Date.now();
  const toolsUsed    = [];
  const findings     = [];
  let   iteration    = 0;
  let   goalAchieved = false;

  // Helper to send status updates to frontend
  const status = (msg) => {
    console.log(`[Agent] ${msg}`);
    if (onStatus) onStatus(msg);
  };

  try {
    // ── Save user message ──
    await saveMessage(userId, 'user', userMessage);

    // ── Step 1: Context Builder ──
    status('Building your profile context...');
    const profile       = await fetchProfile(userId);
    const history       = await fetchHistory(userId);
    const systemContext = buildSystemContext(profile, history);

    status('Analysing your question...');

    // ── Main Loop ──
    while (!goalAchieved && iteration < MAX_ITERATIONS) {

      // Check timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.warn('[Agent] Timeout reached at iteration', iteration);
        break;
      }

      iteration++;
      status(`Running analysis step ${iteration}...`);

      // ── Step 2: Planner ──
      const plan = await runPlanner(systemContext, userMessage, findings, toolsUsed);

      if (!plan || !plan.tool) {
        console.warn('[Agent] Planner returned no tool — stopping loop');
        break;
      }

      // ── Step 3: Tool Executor ──
      status(`Searching ${plan.tool.replace('_', ' ')}...`);
      const toolResult = await executeTool(plan.tool, plan.query, profile);
      toolsUsed.push(plan.tool);
      findings.push(toolResult);

      // ── Step 4: Evaluator ──
      status('Evaluating findings...');
      const evaluation = await runEvaluator(systemContext, userMessage, findings);
      goalAchieved = evaluation.achieved;

      if (!goalAchieved && evaluation.missing) {
        status(`Gathering more information...`);
      }
    }

    // ── Step 5: Responder ──
    status('Preparing your personalised answer...');
    const response = await runResponder(systemContext, userMessage, findings, profile);

    // ── Save AI response ──
    await saveMessage(userId, 'ai', response.message, {
      iterationsRun: iteration,
      toolsUsed,
      actionCards  : response.actionCards || [],
      kbCitations  : response.kbCitations || []
    });

    return {
      success        : true,
      message        : response.message,
      savingsFound   : response.savingsFound   || [],
      actionCards    : response.actionCards    || [],
      recommendedRegime: response.recommendedRegime || null,
      totalSaving    : response.totalSaving    || 0,
      kbCitations    : response.kbCitations    || [],
      meta: {
        iterationsRun : iteration,
        toolsUsed,
        goalAchieved,
        timeMs        : Date.now() - startTime,
        partial       : !goalAchieved && iteration >= MAX_ITERATIONS
      }
    };

  } catch (err) {
    console.error('[Agent] Fatal error:', err.message);

    // Save error message so chat history is not broken
    await saveMessage(userId, 'ai', 'I encountered an error processing your request. Please try again.', {
      iterationsRun: iteration,
      toolsUsed
    }).catch(() => {});

    return {
      success: false,
      message: 'I encountered an error. Please try again in a moment.',
      error  : err.message,
      meta   : { iterationsRun: iteration, toolsUsed, timeMs: Date.now() - startTime }
    };
  }
}

module.exports = { runAgent };
