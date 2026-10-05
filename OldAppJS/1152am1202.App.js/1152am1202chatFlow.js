// ===============================================
// chatFlow.js — FINAL PRODUCTION WORKFLOW (PT-A)
// Fully aligned with App.js + dealReducer.js
// All QIDs correct. No unintended auto-advance.
// ===============================================

export const chatFlow = {

  // -------------------------------------------------
  // GREETING
  // -------------------------------------------------
  greeting: {
    qid: "greeting",
    text: "Hi! I am REA your AI real estate assistant. How can I help you today?",
    buttons: ["Start an offer", "Help build my pipeline", "Scheduling assistant"],
    next: (v) => {
      v = String(v || "").toLowerCase();
      if (v.includes("offer")) return "startOffer";
      return null;
    }
  },

  // -------------------------------------------------
  // 1. START OFFER
  // -------------------------------------------------
  startOffer: {
    qid: "startOffer",
    text: "Great — let's begin. What type of property is this?",
    buttons: ["Freehold", "Condo", "POTL", "Mobile", "Commercial"],
    next: (v) => {
      v = String(v || "").toLowerCase();
      if (v.includes("freehold")) return "representing";
      if (v.includes("condo")) return "representing";
      if (v.includes("potl")) return "representing";
      if (v.includes("mobile")) return "representing";
      if (v.includes("comm")) return "representing";
      return null;
    }
  },

  // -------------------------------------------------
  // 2. REPRESENTING (must NOT auto-advance)
  // -------------------------------------------------
  representing: {
    qid: "representing",
    text: "Who are you representing?",
    buttons: ["Buyer", "Seller"],
    next: () => "paperworkSigned"   // router controls this; safe to keep
  },

  // -------------------------------------------------
  // 3. PAPERWORK SIGNED?
  // -------------------------------------------------
  paperworkSigned: {
    qid: "paperworkSigned",
    text: "Has the representation paperwork already been signed?",
    buttons: ["Yes", "No"],
    next: (v) => {
      v = String(v || "").toLowerCase();
      if (v.startsWith("y")) return "mlsOrManual";
      return "representationType";
    }
  },

  // -------------------------------------------------
  // 4. representationType → 300 vs 371
  // -------------------------------------------------
  representationType: {
    qid: "representationType",
    text: "Is this Client Representation or Designated Representation?",
    buttons: ["Client", "Designated"],
    next: () => "mlsOrManual"
  },

  // -------------------------------------------------
  // 5. MLS OR MANUAL
  // -------------------------------------------------
  mlsOrManual: {
    qid: "mlsOrManual",
    text: "Do you want to upload the MLS PDF or enter the address manually?",
    buttons: ["Upload MLS", "Enter address manually"],
    next: (v) => {
      const x = String(v).toLowerCase();
      if (x.includes("upload")) return "openMlsModal";
      return "addressEntry";
    }
  },

  openMlsModal: {
    openModal: "showMlsUpload",
    nextQid: "addressEntry"
  },

  // -------------------------------------------------
  // 6. ADDRESS ENTRY
  // -------------------------------------------------
  addressEntry: {
    qid: "addressPrompt",
    text: "What is the property address?",
    buttons: ["Open address modal"],
    next: () => "openAddressModal"
  },

  openAddressModal: {
    openModal: "showAddress",
    nextQid: "legalDescriptionConfirm"
  },

  // -------------------------------------------------
  // 7. LEGAL DESCRIPTION
  // -------------------------------------------------
  legalDescriptionConfirm: {
    qid: "legalDescriptionConfirm",
    text: "Is the legal description correct?",
    buttons: ["Yes", "No"],
    next: () => "frontage"
  },

  // -------------------------------------------------
  // 8. FRONTAGE
  // -------------------------------------------------
  frontage: {
    qid: "frontage",
    text: "What is the frontage of the property?",
    buttons: null,
    next: () => "depth"
  },

  // -------------------------------------------------
  // 9. DEPTH
  // -------------------------------------------------
  depth: {
    qid: "depth",
    text: "What is the depth of the property?",
    buttons: null,
    next: () => "offerPrice"
  },

  // -------------------------------------------------
  // 10. OFFER PRICE
  // -------------------------------------------------
  offerPrice: {
    qid: "offerPrice",
    text: "What is the offer price?",
    buttons: null,
    next: () => "deposit"
  },

  // -------------------------------------------------
  // 11. DEPOSIT
  // -------------------------------------------------
  deposit: {
    qid: "deposit",
    text: "What is the deposit amount?",
    buttons: null,
    next: () => "depositTiming"
  },

  // -------------------------------------------------
  // 12. DEPOSIT TIMING
  // -------------------------------------------------
  depositTiming: {
    qid: "depositTiming",
    text: "When will the deposit be delivered?",
    buttons: ["With offer", "Upon acceptance", "Other"],
    next: () => "depositHolder"
  },

  // -------------------------------------------------
  // 13. DEPOSIT HOLDER
  // -------------------------------------------------
  depositHolder: {
    qid: "depositHolder",
    text: "Who will hold the deposit?",
    buttons: null,
    next: () => "irrevocableParty"
  },

  // -------------------------------------------------
  // 14. IRREVOCABLE PARTY
  // -------------------------------------------------
  irrevocableParty: {
    qid: "irrevParty",
    text: "Who is the offer irrevocable by?",
    buttons: ["Buyer", "Seller"],
    next: () => "openIrrevDateModal"
  },

  openIrrevDateModal: {
    openModal: "showIrrevDate",
    nextQid: "openIrrevTimeModal"
  },

  openIrrevTimeModal: {
    openModal: "showIrrevTime",
    nextQid: "openCompletionDateModal"
  },

  // -------------------------------------------------
  // 15. COMPLETION DATE
  // -------------------------------------------------
  openCompletionDateModal: {
    openModal: "showCompletionDate",
    nextQid: "emails"
  },

  // -------------------------------------------------
  // 16. EMAILS
  // -------------------------------------------------
  emails: {
    qid: "emails",
    text: "Please confirm the seller and buyer agent emails.",
    buttons: null,
    next: () => "inclusions"
  },

  // -------------------------------------------------
  // 17. INCLUSIONS
  // -------------------------------------------------
  inclusions: {
    qid: "inclusions",
    text: "List any inclusions:",
    buttons: null,
    next: () => "exclusions"
  },

  // -------------------------------------------------
  // 18. EXCLUSIONS
  // -------------------------------------------------
  exclusions: {
    qid: "exclusions",
    text: "List any exclusions:",
    buttons: null,
    next: () => "rentals"
  },

  // -------------------------------------------------
  // 19. RENTALS
  // -------------------------------------------------
  rentals: {
    qid: "rentals",
    text: "List any rental items:",
    buttons: null,
    next: () => "hst"
  },

  // -------------------------------------------------
  // 20. HST
  // -------------------------------------------------
  hst: {
    qid: "hst",
    text: "Is HST included in the purchase price?",
    buttons: ["Yes", "No", "Included but not applicable"],
    next: () => "openTitleSearchModal"
  },

  openTitleSearchModal: {
    openModal: "showTitleDate",
    nextQid: "lawyers"
  },

  // -------------------------------------------------
  // 21. LAWYERS
  // -------------------------------------------------
  lawyers: {
    qid: "lawyers",
    text: "Please provide the buyer and seller lawyer details.",
    buttons: null,
    next: () => "schedulePicker"
  },

  // -------------------------------------------------
  // 22. SCHEDULE PICKER
  // -------------------------------------------------
  schedulePicker: {
    qid: "schedulePicker",
    text: "Which schedules would you like to include?",
    buttons: ["Schedule B", "Schedule C", "Schedule D", "None"],
    next: () => "clausePicker"
  },

  // -------------------------------------------------
  // 23. CLAUSE PICKER
  // -------------------------------------------------
  clausePicker: {
    qid: "clausePicker",
    text: "Would you like to add any standard clauses?",
    buttons: ["Yes", "No"],
    next: () => "formsPicker"
  },

  // -------------------------------------------------
  // 24. FORMS PICKER
  // -------------------------------------------------
  formsPicker: {
    qid: "formsPicker",
    text: "Would you like to add any additional forms?",
    buttons: ["Open forms picker"],
    next: () => "openForms"
  },

  openForms: {
    openModal: "showFormsPicker",
    nextQid: "summary"
  },

  // -------------------------------------------------
  // 25. SUMMARY
  // -------------------------------------------------
  summary: {
    qid: "summary",
    text: "Here is the summary of your offer. Would you like to make any changes?",
    buttons: ["Yes", "No"],
    next: (v) =>
      String(v).toLowerCase().startsWith("y") ? "startOffer" : "done"
  },

  // -------------------------------------------------
  // 26. DONE
  // -------------------------------------------------
  done: {
    qid: "done",
    text: "Your offer is complete!",
    buttons: null,
    next: () => null
  }
};
