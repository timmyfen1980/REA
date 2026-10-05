// =====================================================
// chatRouter.js — FINAL ROUTER FOR PT-A WORKFLOW
// Fully aligned with chatFlow.js + dealReducer.js
// =====================================================

import { chatFlow } from "./chatFlow";

function norm(v) {
  return String(v || "").trim().toLowerCase();
}

export function getNextStage(lastQID, userInput) {
  if (!lastQID) return null;
  const v = norm(userInput);

  // ---------------------------------------------------
  // GREETING → START OFFER
  // ---------------------------------------------------
  if (lastQID === "greeting") {
    if (v.includes("offer")) return "startOffer";
    return null;
  }

  // ---------------------------------------------------
  // START OFFER → REPRESENTING
  // ---------------------------------------------------
  if (lastQID === "startOffer") {
    if (v.includes("freehold")) return "representing";
    if (v.includes("condo")) return "representing";
    if (v.includes("potl")) return "representing";
    if (v.includes("mobile")) return "representing";
    if (v.includes("comm")) return "representing";
    return null;
  }

  // ---------------------------------------------------
  // REPRESENTING → PAPERWORK SIGNED
  // (Triggered by Buyer/Seller click; NOT auto-advance)
  // ---------------------------------------------------
  if (lastQID === "representing") {
    return "paperworkSigned";
  }

  // ---------------------------------------------------
  // PAPERWORK SIGNED → representationType OR MLS/MANUAL
  // ---------------------------------------------------
  if (lastQID === "paperworkSigned") {
    if (v.startsWith("y")) return "mlsOrManual";
    return "representationType";
  }

  // ---------------------------------------------------
  // representationType → MLS/MANUAL
  // ---------------------------------------------------
  if (lastQID === "representationType") {
    return "mlsOrManual";
  }

  // ---------------------------------------------------
  // MLS OR MANUAL
  // ---------------------------------------------------
  if (lastQID === "mlsOrManual") {
    if (v.includes("upload")) return "modal:showMlsUpload";
    return "addressEntry";
  }

  if (lastQID === "openMlsModal") {
    return "addressEntry";
  }

  // ---------------------------------------------------
  // ADDRESS ENTRY
  // ---------------------------------------------------
  if (lastQID === "addressEntry") {
    return "modal:showAddress";
  }

  if (lastQID === "openAddressModal") {
    return "legalDescriptionConfirm";
  }

  // ---------------------------------------------------
  // LEGAL DESCRIPTION → FRONTAGE
  // ---------------------------------------------------
  if (lastQID === "legalDescriptionConfirm") {
    return "frontage";
  }

  // ---------------------------------------------------
  // FRONTAGE → DEPTH
  // ---------------------------------------------------
  if (lastQID === "frontage") {
    return "depth";
  }

  // ---------------------------------------------------
  // DEPTH → OFFER PRICE
  // ---------------------------------------------------
  if (lastQID === "depth") {
    return "offerPrice";
  }

  // ---------------------------------------------------
  // OFFER PRICE → DEPOSIT
  // ---------------------------------------------------
  if (lastQID === "offerPrice") {
    return "deposit";
  }

  // ---------------------------------------------------
  // DEPOSIT → DEPOSIT TIMING
  // ---------------------------------------------------
  if (lastQID === "deposit") {
    return "depositTiming";
  }

  // ---------------------------------------------------
  // DEPOSIT TIMING → DEPOSIT HOLDER
  // ---------------------------------------------------
  if (lastQID === "depositTiming") {
    return "depositHolder";
  }

  // ---------------------------------------------------
  // DEPOSIT HOLDER → IRREV PARTY
  // ---------------------------------------------------
  if (lastQID === "depositHolder") {
    return "irrevocableParty";
  }

  // ---------------------------------------------------
  // IRREV PARTY → IRREV DATE
  // ---------------------------------------------------
  if (lastQID === "irrevocableParty") {
    return "modal:showIrrevDate";
  }

  if (lastQID === "openIrrevDateModal") {
    return "modal:showIrrevTime";
  }

  if (lastQID === "openIrrevTimeModal") {
    return "modal:showCompletionDate";
  }

  // ---------------------------------------------------
  // COMPLETION DATE → EMAILS
  // ---------------------------------------------------
  if (lastQID === "openCompletionDateModal") {
    return "emails";
  }

  // ---------------------------------------------------
  // EMAILS → INCLUSIONS
  // ---------------------------------------------------
  if (lastQID === "emails") {
    return "inclusions";
  }

  // ---------------------------------------------------
  // INCLUSIONS → EXCLUSIONS
  // ---------------------------------------------------
  if (lastQID === "inclusions") {
    return "exclusions";
  }

  // ---------------------------------------------------
  // EXCLUSIONS → RENTALS
  // ---------------------------------------------------
  if (lastQID === "exclusions") {
    return "rentals";
  }

  // ---------------------------------------------------
  // RENTALS → HST
  // ---------------------------------------------------
  if (lastQID === "rentals") {
    return "hst";
  }

  // ---------------------------------------------------
  // HST → TITLE SEARCH
  // ---------------------------------------------------
  if (lastQID === "hst") {
    return "modal:showTitleDate";
  }

  if (lastQID === "openTitleSearchModal") {
    return "lawyers";
  }

  // ---------------------------------------------------
  // LAWYERS → SCHEDULE PICKER
  // ---------------------------------------------------
  if (lastQID === "lawyers") {
    return "schedulePicker";
  }

  // ---------------------------------------------------
  // SCHEDULE → CLAUSE PICKER
  // ---------------------------------------------------
  if (lastQID === "schedulePicker") {
    return "clausePicker";
  }

  // ---------------------------------------------------
  // CLAUSE → FORMS PICKER
  // ---------------------------------------------------
  if (lastQID === "clausePicker") {
    return "formsPicker";
  }

  // ---------------------------------------------------
  // FORMS → FORMS MODAL
  // ---------------------------------------------------
  if (lastQID === "formsPicker") {
    return "modal:showFormsPicker";
  }

  if (lastQID === "openForms") {
    return "summary";
  }

  // ---------------------------------------------------
  // SUMMARY → START OVER OR DONE
  // ---------------------------------------------------
  if (lastQID === "summary") {
    if (v.startsWith("y")) return "startOffer";
    return "done";
  }

  // DONE → NOTHING
  if (lastQID === "done") {
    return null;
  }

  // ---------------------------------------------------
  // FALLBACK: use chatFlow.next if provided
  // ---------------------------------------------------
  if (chatFlow[lastQID]?.next) {
    const n = chatFlow[lastQID].next(v);
    return n || null;
  }

  return null;
}
