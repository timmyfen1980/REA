// src/utils/pdf/registry.js
// MASTER PDF REGISTRY — LONG NAMES ONLY (PER APP.JS)

const BASE = `${process.env.PUBLIC_URL}/form_pdfs`;

/**
 * EXACT long-form names from App.js
 * These MUST match App.js string-for-string.
 */
export const FORM_FILE = {
  "Form 100 – Agreement of Purchase and Sale (Residential)":
    "1_100 Agreement of Purchase and Sale - PropTx-OREA.pdf",

  "Form 101 – Condo Agreement of Purchase and Sale":
    "1_101 Agreement of Purchase and Sale - Condo.pdf",

  "Form 105 – POTL Agreement of Purchase and Sale":
    "1_105 Agreement of Purchase and Sale - POTL.pdf",

  "Form 105 – Mobile Home Agreement of Purchase and Sale":
    "1_105 Agreement of Purchase and Sale - Mobile.pdf",

  "Form 500 – Commercial Agreement of Purchase and Sale":
    "1_500 Commercial Agreement of Purchase and Sale.pdf"
};

/**
 * Alias map for field-level differences.
 * Leave empty objects unless a form needs mapping.
 */
export const FORM_ALIAS = {
  "Form 100 – Agreement of Purchase and Sale (Residential)": {},
  "Form 101 – Condo Agreement of Purchase and Sale": {},
  "Form 105 – POTL Agreement of Purchase and Sale": {},
  "Form 105 – Mobile Home Agreement of Purchase and Sale": {},
  "Form 500 – Commercial Agreement of Purchase and Sale": {}
};

/**
 * Resolve a long-form name → PDF filename
 */
export function resolveFormUrl(formName) {
  const file = FORM_FILE[formName];
  if (!file) {
    console.warn("FORM_FILE missing entry for:", formName);
    return "";
  }
  return `${BASE}/${file}`;
}

/**
 * Clean URL for PDF.js
 */
export function normalizePublicUrl(url) {
  if (!url) return "";
  return url.replace(/\/{2,}/g, "/");
}

const registry = {
  FORM_FILE,
  FORM_ALIAS,
  resolveFormUrl,
  normalizePublicUrl
};

export default registry;
