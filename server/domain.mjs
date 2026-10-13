import { randomUUID } from 'node:crypto';

const RECORD_TYPES = new Set(['lab', 'prescription', 'discharge', 'diagnostic']);
const MODES = new Set(['live', 'local', 'demo']);
// Instruction-like text in a document is treated as source content only (never as control metadata).
// The qualifier group must not consume the following noun, or the canonical phrase
// "ignore all previous instructions" slips through: "all previous" matches the group and then
// "instructions" has nothing left to match.
const INSTRUCTION_TEXT = /ignore\s+(?:(?:all|any|the|these|those)\s+|(?:previous|prior|earlier|above|preceding)\s+)*(?:instructions|rules|prompts?)\b|system\s*prompt|\b\[INST\]|<\/?(?:script|system)>|reveal\s+(?:the\s+)?(?:secret|api\s*key)|disregard\s+(?:(?:all|any|the)\s+|(?:previous|prior|earlier|above)\s+)*(?:instructions|rules)\b/i;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clean = (value, limit = 500) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, limit) : '';
const comparable = value => clean(value, 100000).normalize('NFKC').replace(/\s+/g, ' ').toLowerCase();
const safeText = (value, limit) => INSTRUCTION_TEXT.test(clean(value, limit)) ? '' : clean(value, limit);

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1e12 ? value : null;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isFinite(number) && Math.abs(number) <= 1e12 ? number : null;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
}

function validTimestamp(value, fallback) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fallback;
}

function includesEvidence(source, snippet) {
  return Boolean(snippet) && comparable(source).includes(comparable(snippet));
}

/**
 * Read the reference range that this result's own snippet prints, if any.
 *
 * Returns `[low, high]` for a two-sided range, `null` when the snippet prints no range, and
 * `[null, null]` when it prints one we cannot use (incomplete or inverted) — which is different
 * from "no range printed", because a printed-but-unusable range must not be replaced by a
 * model-supplied one.
 */
function printedRange(snippet, name) {
  const text = comparable(snippet).replace(/[−–—]/g, '-');
  if (!text) return null;
  // Anchor after the analyte name when we can find it, so we do not read another row's range.
  const printedName = comparable(name);
  const index = text.indexOf(printedName);
  const window = index >= 0 ? text.slice(index) : text;

  const twoSided = /(-?\d+(?:\.\d*)?)\s*(?:-|to)\s*(-?\d+(?:\.\d*)?)/.exec(window);
  if (!twoSided) {
    // A printed bound with no two-sided range ("reference: < 200") is not a usable comparison.
    return /(?:reference|ref\.?|range|normal)\b/i.test(window) && /\d/.test(window) ? [null, null] : null;
  }

  // Guard against reading an unrelated pair (times, dates, doses) as a range: the pair must sit
  // under an explicit range keyword, or inside parentheses that directly follow the analyte name.
  const before = window.slice(0, twoSided.index);
  const keyword = /(?:reference(?:\s+range)?|ref\.?|range|normal)\s*[:(]?\s*$/i.test(before);
  const parenthesisedAfterName = index >= 0 && /^[^(\n]{0,40}\(?[^)]*$/.test(before) && before.includes('(');
  if (!keyword && !parenthesisedAfterName) return null;

  const low = Number(twoSided[1]);
  const high = Number(twoSided[2]);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return [null, null];
  return low < high ? [low, high] : [null, null];
}

/** A unit is accepted only when it is the unit printed for THIS result, not merely a substring of it. */
function matchesPrintedUnit(snippet, unit) {
  if (!unit) return false;
  const text = snippet.normalize('NFKC');
  const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The unit must sit immediately after the result number (optionally across spaces/punctuation)
  // and be bounded by a non-unit character, so "g/dL" cannot be accepted from inside "mg/dL".
  const anchored = new RegExp(`(?:\\d|\\s)\\s*${escaped}(?![\\p{L}\\d/^])`, 'iu').test(text);
  return anchored;
}

function hasNumber(source, number) {
  if (number === null) return false;
  const text = source.normalize('NFKC').replace(/[−–—]/g, '-');
  for (const match of text.matchAll(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/g)) {
    // In 70-99 the hyphen separates range endpoints; in "-99" it is a sign.
    const token = match[0].startsWith('-') && /\d/.test(text[(match.index ?? 0) - 1] ?? '') ? match[0].slice(1) : match[0];
    if (Number(token) === number) return true;
  }
  return false;
}

function hasResultNumber(source, name, value) {
  if (value === null) return false;
  const text = comparable(source);
  const printedName = comparable(name);
  const index = text.indexOf(printedName);
  if (index < 0) return false;
  let tail = text.slice(index + printedName.length).replace(/[−–—]/g, '-');

  // If tail begins with a parenthesized tag or range like (25-OH) or (70-99 mg/dL),
  // skip it if there is another number following it.
  const parenMatch = /^\s*\([^)]*\)\s*[:|]?\s*/.exec(tail);
  if (parenMatch) {
    const afterParen = tail.slice(parenMatch[0].length);
    if (/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(afterParen)) {
      tail = afterParen;
    }
  }

  // Iterate over candidate numbers in tail
  for (const match of tail.matchAll(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/g)) {
    const matchIndex = match.index ?? 0;
    const prefix = tail.slice(0, matchIndex);
    // Skip ordinal suffixes like 3rd, 2nd, 1st
    if (/^\d+(?:st|nd|rd|th)\b/i.test(tail.slice(matchIndex))) continue;
    // Qualified values must remain text evidence rather than becoming exact numbers.
    if (/[<>≤≥]|less than|greater than|below|above/i.test(prefix)) return false;
    // In 70-99 the hyphen separates range endpoints; in "-99" it is a sign.
    const token = match[0].startsWith('-') && /\d/.test(tail[matchIndex - 1] ?? '') ? match[0].slice(1) : match[0];
    const candidate = Number(token);
    // If we passed an explicit reference range indicator, we are beyond the result value
    if (/(?:reference(?:\s+range)?|ref\.?|normal\s+range)\s*[:(]?\s*$/i.test(prefix)) {
      return false;
    }
    return candidate === value;
  }
  return false;
}

function resolveMissingSourceSnippet(documentText, proposedSnippet, anchor) {
  if (proposedSnippet) return proposedSnippet;
  if (!anchor || !documentText) return '';
  const docComp = comparable(documentText);
  const anchorComp = comparable(anchor);
  const idx = docComp.indexOf(anchorComp);
  if (idx >= 0) {
    const rawIndex = documentText.toLowerCase().indexOf(anchor.toLowerCase());
    const searchIdx = rawIndex >= 0 ? rawIndex : idx;
    const start = Math.max(0, documentText.lastIndexOf('\n', searchIdx));
    let end = documentText.indexOf('\n', searchIdx + anchor.length);
    if (end < 0) end = documentText.length;
    const snippet = documentText.slice(start, end).trim();
    if (snippet) return snippet;
  }
  return '';
}

/** A flag describes only the two-sided range printed on this particular report. */
export function classifyObservation(observation = {}) {
  const { value, referenceLow: low, referenceHigh: high } = observation;
  if (![value, low, high].every(item => typeof item === 'number' && Number.isFinite(item)) || low > high) return 'unknown';
  // Equal bounds are a degenerate range, not a comparison: "within 6.1–6.1" would misstate the report.
  if (low === high) return 'unknown';
  return value < low ? 'low' : value > high ? 'high' : 'normal';
}

function biomarkerContext(name) {
  const n = String(name || '').toLowerCase();
  if (/hba1c|glycated/i.test(n)) return { en: ' HbA1c measures average blood sugar over the last 2–3 months.', hi: ' HbA1c पिछले 2–3 महीनों में औसत ब्लड शुगर स्तर को दर्शाता है।' };
  if (/fasting glucose|glucose|sugar/i.test(n)) return { en: ' Fasting glucose measures circulating blood sugar after an overnight fast.', hi: ' फास्टिंग ग्लूकोज़ रातभर खाली पेट रहने के बाद ब्लड शुगर स्तर को मापता है।' };
  if (/hemoglobin|haemoglobin|\bhb\b/i.test(n)) return { en: ' Hemoglobin is the protein in red blood cells that transports oxygen through your body.', hi: ' हीमोग्लोबिन लाल रक्त कोशिकाओं में मौजूद प्रोटीन है जो शरीर में ऑक्सीजन पहुंचाता है।' };
  if (/vitamin d|vit d|cholecalciferol/i.test(n)) return { en: ' Vitamin D is essential for calcium absorption, bone strength, and immune balance.', hi: ' विटामिन D हड्डियों की मजबूती, कैल्शियम अवशोषण और रोग प्रतिरोधक क्षमता के लिए आवश्यक है।' };
  if (/cholesterol|ldl|hdl|triglyceride/i.test(n)) return { en: ' Lipid markers assess circulating blood fats related to cardiovascular health.', hi: ' लिपिड मार्कर हृदय स्वास्थ्य से जुड़ी रक्त वसा की स्थिति का आकलन करते हैं।' };
  if (/creatinine|egfr|urea|bun\b/i.test(n)) return { en: ' Kidney biomarkers measure filtration efficiency and renal health.', hi: ' किडनी बायोमार्कर गुर्दे की कार्यक्षमता और फिल्टर करने की क्षमता का संकेत देते हैं।' };
  if (/tsh|thyroid/i.test(n)) return { en: ' TSH reflects thyroid gland activity and metabolic regulation.', hi: ' TSH थायरॉयड ग्रंथि की कार्यप्रणाली और मेटाबॉलिज्म नियंत्रण को दर्शाता है।' };
  return { en: '', hi: '' };
}

export function explainObservation(observation = {}) {
  const name = safeText(observation.name, 120) || 'Result';
  const value = finiteNumber(observation.value);
  const unit = safeText(observation.unit, 40);
  if (value === null) return { en: `${name}: a readable numeric value is not available. Check the source document.`, hi: `${name}: पढ़ने योग्य संख्यात्मक मान उपलब्ध नहीं है। मूल दस्तावेज़ देखें।` };
  const display = `${value}${unit ? ` ${unit}` : ''}`;
  const status = classifyObservation(observation);
  if (status === 'unknown') return { en: `${name} is reported as ${display}. A complete, usable reference range is not available; no range comparison was made.`, hi: `${name} का दर्ज मान ${display} है। पूरी और उपयोग योग्य संदर्भ सीमा उपलब्ध नहीं है; सीमा से तुलना नहीं की गई।` };
  const range = `${observation.referenceLow}–${observation.referenceHigh}${unit ? ` ${unit}` : ''}`;
  const position = status === 'normal' ? 'within' : status === 'high' ? 'above' : 'below';
  const hindi = status === 'normal' ? 'के भीतर' : status === 'high' ? 'से ऊपर' : 'से नीचे';
  const context = biomarkerContext(name);
  return {
    en: `${name} is ${display}, ${position} this report's reference range (${range}).${context.en} A result alone does not establish a diagnosis.`,
    hi: `${name} का मान ${display} है, जो इस रिपोर्ट की संदर्भ सीमा (${range}) ${hindi} है।${context.hi} केवल एक परिणाम से निदान नहीं होता।`,
  };
}

/** Model JSON is untrusted. Metadata comes only from the upload pipeline or reviewed API. */
export function normalizeExtraction(raw, metadata = {}) {
  if (!isObject(raw)) throw new TypeError('Extraction output must be a JSON object.');
  if (!isObject(metadata)) throw new TypeError('Extraction metadata must be an object.');
  const warnings = [];
  const warn = message => { if (warnings.length < 40 && !warnings.includes(message)) warnings.push(message); };
  const sourceText = clean(metadata.sourceText, 100000);
  if (!sourceText) warn('Source text is unavailable; extracted clinical fields need source review.');
  if (typeof metadata.sourceText === 'string' && metadata.sourceText.length > 100000) warn('Source text was limited to 100,000 characters.');
  if (INSTRUCTION_TEXT.test(sourceText)) warn('Instruction-like text in the document was treated as source content only.');
  const date = validDate(raw.date);
  if (!date) warn('Document date is missing or invalid; it has not been inferred from the upload date.');
  const bounded = (value, max, label) => {
    if (!Array.isArray(value)) return [];
    if (value.length > max) warn(`${label} exceeded the extraction limit and was truncated.`);
    return value.slice(0, max).filter(isObject);
  };
  const observations = bounded(raw.observations, 100, 'Observations').map((item, index) => {
    const name = safeText(item.name, 120) || `Unidentified result ${index + 1}`;
    let source = clean(item.sourceText, 1500);
    if (!source) {
      source = resolveMissingSourceSnippet(sourceText, source, name);
    }
    const supported = includesEvidence(sourceText, source) && includesEvidence(source, name) && !INSTRUCTION_TEXT.test(source);
    if (!supported) warn('One or more observation snippets could not be verified against the source text.');
    const numeric = (value, label) => {
      const result = finiteNumber(value);
      if (result === null) return null;
      if (supported && (label === 'observation value' ? hasResultNumber(source, name, result) : hasNumber(source, result))) return result;
      warn(`An unsupported ${label} was left blank for review.`);
      return null;
    };
    const result = numeric(item.value, 'observation value');
    // The report's OWN printed range is the authority for the range. If the snippet prints one, we
    // derive the limits from it and disregard the model's claim entirely — otherwise a forged limit
    // (e.g. the result value itself) could relabel a genuinely high result as "within range".
    const printed = printedRange(source, name);
    let referenceLow;
    let referenceHigh;
    if (printed) {
      [referenceLow, referenceHigh] = printed;
      if (finiteNumber(item.referenceLow) !== referenceLow || finiteNumber(item.referenceHigh) !== referenceHigh) {
        warn('A model-supplied reference range disagreed with the range printed in the document; the document range was used.');
      }
    } else {
      // No printed range: accept a limit only if it is evidenced in this snippet and is not the result.
      const limit = (value, label) => {
        const candidate = finiteNumber(value);
        if (candidate === null) return null;
        if (supported && hasNumber(source, candidate) && candidate !== result) return candidate;
        warn(`An unsupported ${label} was left blank for review.`);
        return null;
      };
      referenceLow = limit(item.referenceLow, 'reference limit');
      referenceHigh = limit(item.referenceHigh, 'reference limit');
    }
    if (referenceLow !== null && referenceHigh !== null && referenceLow >= referenceHigh) {
      referenceLow = null; referenceHigh = null;
      warn('An inverted or degenerate reference range was left blank for review.');
    }
    const candidateUnit = safeText(item.unit, 40);
    const unit = supported && matchesPrintedUnit(source, candidateUnit) ? candidateUnit : '';
    if (candidateUnit && !unit) warn('An unsupported observation unit was left blank for review.');
    const observation = {
      id: randomUUID(), name, value: result, unit,
      referenceLow, referenceHigh, sourceText: source, status: 'unknown', explanation: { en: '', hi: '' },
    };
    observation.status = classifyObservation(observation);
    observation.explanation = explainObservation(observation);
    return observation;
  });
  const medications = bounded(raw.medications, 30, 'Medications').flatMap(item => {
    const name = safeText(item.name, 120);
    let source = clean(item.sourceText, 1500);
    if (!source) {
      source = resolveMissingSourceSnippet(sourceText, source, name);
    }
    if (!name || !includesEvidence(sourceText, source) || !includesEvidence(source, name) || INSTRUCTION_TEXT.test(source)) {
      warn('A medication without verifiable source evidence was omitted.'); return [];
    }
    const supportedField = field => {
      const text = safeText(item[field], 350);
      if (!text) return '';
      if (includesEvidence(source, text) || includesEvidence(sourceText, text)) return text;
      const compSource = comparable(source);
      const compText = comparable(text);
      if (compSource.includes(compText)) return text;
      const words = compText.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !['take', 'with', 'after', 'before', 'once', 'twice', 'daily', 'days', 'tablet', 'tab', 'capsule', 'cap'].includes(w));
      if (words.length > 0 && words.every(w => compSource.includes(w))) return text;
      warn('An unsupported medication instruction was left blank for review.'); return '';
    };
    return [{ id: randomUUID(), name, dosage: supportedField('dosage'), frequency: supportedField('frequency'), duration: supportedField('duration'), instructions: supportedField('instructions'), sourceText: source }];
  });
  const diagnoses = bounded(raw.diagnoses, 20, 'Diagnoses').flatMap(item => {
    const name = safeText(item.name, 120);
    let source = clean(item.sourceText, 1500);
    if (!source) {
      source = resolveMissingSourceSnippet(sourceText, source, name);
    }
    if (!name || !includesEvidence(sourceText, source) || !includesEvidence(source, name) || INSTRUCTION_TEXT.test(source)) {
      warn('A diagnosis without verifiable source evidence was omitted; results were not converted into diagnoses.'); return [];
    }
    return [{ name, sourceText: source }];
  });
  const outside = observations.filter(observation => ['high', 'low'].includes(observation.status)).length;
  const summary = observations.length ? {
    en: `${observations.length} reported result${observations.length === 1 ? '' : 's'} extracted. ${outside} ${outside === 1 ? 'is' : 'are'} outside this report's reference ranges. Review the source and discuss questions with your clinician; these results do not establish a diagnosis.`,
    hi: `${observations.length} दर्ज परिणाम निकाले गए। ${outside} परिणाम इस रिपोर्ट की संदर्भ सीमाओं से बाहर हैं। मूल दस्तावेज़ की जाँच करें और प्रश्न अपने चिकित्सक से पूछें; इन परिणामों से निदान नहीं होता।`,
  } : medications.length ? {
    en: `${medications.length} source-prescribed medication${medications.length === 1 ? '' : 's'} transcribed. Confirm unclear instructions with the prescriber; this record does not confirm current use.`,
    hi: `मूल प्रिस्क्रिप्शन की ${medications.length} दवाओं का विवरण दर्ज है। अस्पष्ट निर्देश लिखने वाले चिकित्सक से स्पष्ट करें; यह रिकॉर्ड वर्तमान उपयोग की पुष्टि नहीं करता।`,
  } : {
    en: 'Document saved for review. Read the source text for clinical findings and instructions; no diagnosis has been inferred.',
    hi: 'दस्तावेज़ समीक्षा के लिए सहेजा गया है। चिकित्सकीय निष्कर्षों और निर्देशों के लिए मूल पाठ पढ़ें; कोई निदान अनुमानित नहीं किया गया है।',
  };
  const now = new Date().toISOString();
  const trustedProvenance = isObject(metadata.provenance) ? metadata.provenance : metadata;
  for (const warning of Array.isArray(trustedProvenance.warnings) ? trustedProvenance.warnings.slice(0, 30) : []) {
    const text = clean(warning, 500); if (text) warn(text);
  }
  const provenance = {
    mode: MODES.has(trustedProvenance.mode) ? trustedProvenance.mode : 'local',
    extractionModel: clean(trustedProvenance.extractionModel, 200) || 'unspecified',
    processedAt: validTimestamp(trustedProvenance.processedAt, now), warnings,
  };
  if (clean(trustedProvenance.visionModel, 200)) provenance.visionModel = clean(trustedProvenance.visionModel, 200);
  return {
    id: clean(metadata.id, 120) || randomUUID(), title: safeText(raw.title, 200) || 'Uploaded health record',
    type: RECORD_TYPES.has(raw.type) ? raw.type : 'lab', date, provider: safeText(raw.provider, 200) || 'Provider not recorded',
    fileName: clean(metadata.fileName, 200) || 'uploaded-document', summary,
    keyPoints: observations.slice(0, 6).map(observation => observation.explanation), observations, medications, diagnoses, sourceText,
    reviewStatus: metadata.reviewStatus === 'reviewed' ? 'reviewed' : 'pending', isDemo: metadata.isDemo === true,
    createdAt: validTimestamp(metadata.createdAt, now), provenance,
  };
}
