// ─────────────────────────────────────────────
//  routes/documents.js
//  POST /api/documents
//  Gemini Vision extracts data from:
//  - Form 16 (salary certificate)
//  - AIS / 26AS (tax statement)
//  - ITR PDF
//  - Rent receipts, loan certificates
// ─────────────────────────────────────────────

const express    = require('express');
const router     = express.Router();
const supabase   = require('../utils/supabase');
const { askVisionJSON, askVision } = require('../utils/gemini');

// ── EXTRACTION PROMPTS per document type ──
const PROMPTS = {

  form16: `You are extracting data from an Indian Form 16 (salary certificate).
Extract ALL of the following fields. If a field is not present, use null.
Return ONLY valid JSON with no markdown or explanation:
{
  "employerName": "",
  "employerTAN": "",
  "employerPAN": "",
  "employeePAN": "",
  "assessmentYear": "",
  "grossSalary": 0,
  "basicSalary": 0,
  "hra": 0,
  "lta": 0,
  "otherAllowances": 0,
  "standardDeduction": 0,
  "professionalTax": 0,
  "netTaxableSalary": 0,
  "section80C": 0,
  "section80D": 0,
  "section80CCD1B": 0,
  "otherDeductions": 0,
  "totalDeductions": 0,
  "taxableIncome": 0,
  "taxOnIncome": 0,
  "educationCess": 0,
  "totalTaxPayable": 0,
  "tdsByEmployer": 0,
  "regime": "old or new or unknown"
}`,

  ais: `You are extracting data from an Indian Annual Information Statement (AIS) or Form 26AS.
Extract ALL income sources and TDS details. Return ONLY valid JSON:
{
  "assessmentYear": "",
  "pan": "",
  "salaryIncome": 0,
  "fdInterest": 0,
  "dividendIncome": 0,
  "rentalIncome": 0,
  "capitalGains": 0,
  "otherIncome": 0,
  "totalIncome": 0,
  "tdsByEmployer": 0,
  "tdsByBank": 0,
  "tdsByOthers": 0,
  "totalTDS": 0,
  "advanceTaxPaid": 0,
  "selfAssessmentTax": 0,
  "highValueTransactions": [],
  "mismatches": []
}`,

  itr: `You are extracting data from an Indian Income Tax Return (ITR) PDF.
Extract key figures. Return ONLY valid JSON:
{
  "assessmentYear": "",
  "itrType": "",
  "grossTotalIncome": 0,
  "totalDeductions": 0,
  "taxableIncome": 0,
  "taxPaid": 0,
  "refundDue": 0,
  "taxPayable": 0,
  "regime": "old or new or unknown",
  "verificationStatus": ""
}`,

  rent_receipt: `Extract rental details from this rent receipt. Return ONLY valid JSON:
{
  "landlordName": "",
  "landlordPAN": "",
  "tenantName": "",
  "address": "",
  "monthlyRent": 0,
  "period": "",
  "totalAmount": 0
}`,

  loan_certificate: `Extract home loan details from this certificate. Return ONLY valid JSON:
{
  "bankName": "",
  "loanAccountNumber": "",
  "borrowerName": "",
  "propertyAddress": "",
  "principalPaid": 0,
  "interestPaid": 0,
  "totalPaid": 0,
  "financialYear": "",
  "outstandingBalance": 0
}`,

  generic: `Extract all financial and tax-related information from this document.
Return a JSON object with all relevant fields you can identify.
Use clear field names. Return ONLY valid JSON.`
};

// ── DETECT MISMATCHES ──
// Compares AIS data with what user declared in their profile
function detectMismatches(profile, aisData) {
  const mismatches = [];

  // FD interest mismatch
  if (aisData.fdInterest > 0) {
    const declared = profile.fd_interest || 0;
    if (Math.abs(aisData.fdInterest - declared) > 1000) {
      mismatches.push({
        type       : 'fd_interest',
        aisAmount  : aisData.fdInterest,
        declared   : declared,
        difference : aisData.fdInterest - declared,
        message    : `AIS shows ₹${aisData.fdInterest.toLocaleString('en-IN')} FD interest. You declared ₹${declared.toLocaleString('en-IN')}. Please reconcile.`,
        severity   : 'high'
      });
    }
  }

  // Dividend income mismatch
  if (aisData.dividendIncome > 0) {
    const declared = profile.dividend_income || 0;
    if (Math.abs(aisData.dividendIncome - declared) > 500) {
      mismatches.push({
        type       : 'dividend',
        aisAmount  : aisData.dividendIncome,
        declared   : declared,
        difference : aisData.dividendIncome - declared,
        message    : `AIS shows ₹${aisData.dividendIncome.toLocaleString('en-IN')} dividend income not fully declared.`,
        severity   : 'medium'
      });
    }
  }

  // Rental income mismatch
  if (aisData.rentalIncome > 0) {
    const declared = (profile.assets && profile.assets.rental_income) || 0;
    if (Math.abs(aisData.rentalIncome - declared) > 1000) {
      mismatches.push({
        type       : 'rental',
        aisAmount  : aisData.rentalIncome,
        declared   : declared,
        difference : aisData.rentalIncome - declared,
        message    : `AIS shows ₹${aisData.rentalIncome.toLocaleString('en-IN')} rental income. You declared ₹${declared.toLocaleString('en-IN')}.`,
        severity   : 'high'
      });
    }
  }

  return mismatches;
}

// ── UPDATE PROFILE FROM EXTRACTED DATA ──
// Auto-fills user's income profile with extracted document data
async function updateProfileFromDoc(userId, docType, extractedData) {
  if (docType === 'form16') {
    const updates = {};
    if (extractedData.grossSalary)    updates.gross_salary  = extractedData.grossSalary;
    if (extractedData.basicSalary)    updates.basic_da      = extractedData.basicSalary;
    if (extractedData.hra)            updates.hra_received  = extractedData.hra;
    if (extractedData.section80C)     updates.section_80c   = extractedData.section80C;
    if (extractedData.section80D)     updates.section_80d   = extractedData.section80D;
    if (extractedData.section80CCD1B) updates.nps_personal  = extractedData.section80CCD1B;

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('income_profile')
        .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });
    }
  }
}

// ── MAIN ROUTE ──
router.post('/', async (req, res) => {
  try {
    const { userId, docType, fileBase64, mimeType, fileName } = req.body;

    // ── Validation ──
    if (!userId)     return res.status(400).json({ error: 'userId is required' });
    if (!fileBase64) return res.status(400).json({ error: 'fileBase64 is required' });
    if (!docType)    return res.status(400).json({ error: 'docType is required (form16, ais, itr, rent_receipt, loan_certificate, generic)' });

    const validTypes = ['form16', 'ais', 'itr', 'rent_receipt', 'loan_certificate', 'generic'];
    if (!validTypes.includes(docType)) {
      return res.status(400).json({ error: `Invalid docType. Use: ${validTypes.join(', ')}` });
    }

    const fileMimeType = mimeType || 'application/pdf';
    const prompt       = PROMPTS[docType] || PROMPTS.generic;

    // ── Extract with Gemini Vision ──
    console.log(`[/api/documents] Extracting ${docType} for user ${userId}`);
    let extractedData;

    try {
      extractedData = await askVisionJSON(prompt, fileBase64, fileMimeType);
    } catch (e) {
      // If JSON extraction fails, try plain text
      console.warn('[Documents] JSON extraction failed, trying plain text:', e.message);
      const rawText = await askVision(prompt, fileBase64, fileMimeType);
      extractedData = { rawText, parseError: 'Could not parse structured data' };
    }

    // ── Fetch user profile for mismatch detection ──
    const { data: user }   = await supabase.from('users').select('*').eq('id', userId).single();
    const { data: income } = await supabase.from('income_profile').select('*').eq('user_id', userId).single();
    const profile = { ...user, ...(income || {}) };

    // ── Detect mismatches (AIS only) ──
    let mismatches = [];
    if (docType === 'ais' && extractedData && !extractedData.parseError) {
      mismatches = detectMismatches(profile, extractedData);
    }

    // ── Store file path in Supabase Storage ──
    // Note: actual file upload to storage can be added here
    // For now we store the extracted data and metadata

    // ── Save document record ──
    const { data: docRecord, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id       : userId,
        doc_type      : docType,
        file_path     : fileName || `${docType}_${Date.now()}`,
        extracted_data: extractedData,
        ais_mismatches: mismatches,
        status        : 'processed',
        uploaded_at   : new Date().toISOString()
      })
      .select()
      .single();

    if (docError) {
      console.error('[Documents] DB save error:', docError.message);
      // Don't fail the request — return extraction result anyway
    }

    // ── Auto-update profile from Form 16 ──
    if (docType === 'form16' && extractedData && !extractedData.parseError) {
      await updateProfileFromDoc(userId, docType, extractedData);
    }

    // ── Response ──
    res.json({
      success      : true,
      docType,
      extractedData,
      mismatches,
      mismatchCount: mismatches.length,
      profileUpdated: docType === 'form16',
      message      : mismatches.length > 0
        ? `Document processed. Found ${mismatches.length} mismatch(es) with your declared income — please review.`
        : 'Document processed successfully.',
      docId        : docRecord?.id || null
    });

  } catch (err) {
    console.error('[/api/documents]', err.message);
    res.status(500).json({
      success: false,
      error  : err.message,
      message: 'Document processing failed. Please try again.'
    });
  }
});

// ── GET /api/documents ──
// Returns all documents uploaded by a user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { data, error } = await supabase
      .from('documents')
      .select('id, doc_type, file_path, status, ais_mismatches, uploaded_at')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, documents: data || [], count: (data || []).length });

  } catch (err) {
    console.error('[/api/documents GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
