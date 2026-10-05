// ========================================================
// dealReducer.js — FINAL FULL VERSION
// Supports 27+ stage APS workflow
// EXACTLY matches Option-2 chatFlow + router + App.js
// ========================================================

export function dealReducer(deal, qid, value) {
  const d = { ...deal };
  const v = value ?? "";

  switch (qid) {
    // ---------------------------------------
    // PROPERTY TYPE (5 types)
    // ---------------------------------------
    case "propertyFreehold":
    case "propertyCondo":
    case "propertyPOTL":
    case "propertyMobile":
    case "propertyCommercial":
      d.propertyType = value;
      return d;

// PT-A: property type selected inside startOffer
case "startOffer":
  if (v.toLowerCase().includes("freehold")) d.propertyType = "Freehold";
  if (v.toLowerCase().includes("condo")) d.propertyType = "Condo";
  if (v.toLowerCase().includes("potl")) d.propertyType = "POTL";
  if (v.toLowerCase().includes("mobile")) d.propertyType = "Mobile";
  if (v.toLowerCase().includes("comm")) d.propertyType = "Commercial";
  return d;

case "representationType":
  d.representationType = v;
  return d;


    // ---------------------------------------
    // REPRESENTATION
    // ---------------------------------------
    case "representing":
      d.representing = value;
      return d;

    // ---------------------------------------
    // PAPERWORK SIGNED?
    // ---------------------------------------
    case "paperworkSigned":
      d.paperworkSigned = value;
      return d;

    // ---------------------------------------
    // MLS OR MANUAL
    // ---------------------------------------
    case "mlsOrManual":
      d.mlsChoice = value;
      return d;

    // ---------------------------------------
    // ADDRESS
    // ---------------------------------------
    case "addressEntry":
      d.address = d.address || {};
      d.address.raw = v;
      return d;

    case "legalDescriptionConfirm":
      d.legalConfirmed = v;
      return d;

    // ---------------------------------------
    // FRONTAGE / DEPTH / SIZES
    // ---------------------------------------
    case "frontage":
      d.sizes = d.sizes || {};
      d.sizes.frontage = v;
      return d;

    case "depth":
      d.sizes = d.sizes || {};
      d.sizes.depth = v;
      return d;

    // ---------------------------------------
    // OFFER MONEY
    // ---------------------------------------
    case "offerPrice":
      d.money = d.money || {};
      d.money.offerPrice = v;
      return d;

    case "deposit":
    case "depositAmount":
      d.money = d.money || {};
      d.money.deposit = v;
      return d;

    case "depositTiming":
      d.money = d.money || {};
      d.money.depositTiming = v;
      return d;

    case "depositHolder":
      d.money = d.money || {};
      d.money.depositHolder = v;
      return d;

    // ---------------------------------------
    // IRREVOCABLE
    // ---------------------------------------
    case "irrevocableParty":
    case "irrevParty":
      d.irrev = d.irrev || {};
      d.irrev.party = v;
      return d;

    case "irrevocableDate":
    case "irrevDate":
      d.irrev = d.irrev || {};
      d.irrev.date = v; // yyyy-mm-dd
      return d;

    case "irrevocableTime":
    case "irrevTime":
      d.irrev = d.irrev || {};
      d.irrev.time = v; // HH:mm
      return d;

    // ---------------------------------------
    // COMPLETION DATE
    // ---------------------------------------
    case "completionDate":
      d.completionDate = v;
      return d;

    // ---------------------------------------
    // TITLE SEARCH DATE
    // ---------------------------------------
    case "titleSearch":
      d.titleSearchDate = v;
      return d;

    // ---------------------------------------
    // EMAILS
    // ---------------------------------------
    case "emails":
      return d; // handled separately — no field to set here

    case "sellerAgentEmail":
      d.notices = d.notices || {};
      d.notices.sellerAgentEmail = v;
      return d;

    case "buyerAgentEmail":
      d.notices = d.notices || {};
      d.notices.buyerAgentEmail = v;
      return d;

    // ---------------------------------------
    // INCLUSIONS / EXCLUSIONS / RENTALS
    // ---------------------------------------
    case "inclusions":
      d.inclusions = v;
      return d;

    case "exclusions":
      d.exclusions = v;
      return d;

    case "rentals":
    case "rentalItems":
      d.rentalItems = v;
      return d;

    // ---------------------------------------
    // HST
    // ---------------------------------------
    case "hst":
    case "hstIncluded":
      d.hst = v;
      return d;

    // ---------------------------------------
    // LAWYERS
    // ---------------------------------------
    case "lawyers":
      d.lawyers = v;
      return d;

    // ---------------------------------------
    // SCHEDULE PICKER
    // ---------------------------------------
    case "schedulePicker":
      d.schedules = v;
      return d;

    // ---------------------------------------
    // CLAUSE PICKER
    // ---------------------------------------
    case "clausePicker":
      d.clauses = v;
      return d;

    // ---------------------------------------
    // FORMS PICKER
    // ---------------------------------------
    case "formsPicker":
      d.extraForms = v;
      return d;

    // ---------------------------------------
    // SUMMARY
    // ---------------------------------------
    case "summary":
      d.summaryConfirmed = v;
      return d;

    // ---------------------------------------
    // DONE
    // ---------------------------------------
    case "done":
      return d;

    // ---------------------------------------
    // UNKNOWN QID (safe fallback)
    // ---------------------------------------
    default:
      console.warn("Unhandled QID in dealReducer:", qid);
      return d;
  }
}
