/* eslint-disable no-console */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as PDFLib from 'pdf-lib'; // only for "Download PDF" generation
import { renderPdfJsPreview } from './pdfjsPreview';
import {
  getAgentProfile,
  saveAgentProfile,
  hasAgentProfile,
  clearAgentProfile,
} from './profileStore';
// eslint-disable-next-line no-unused-vars
import Tesseract from 'tesseract.js';

// NEW: tiles landing + voice
import HomeTiles from './features/home/HomeTiles';
import VoiceControls from './features/voice/VoiceControls';

function normalizePublicUrl(p) {
  let s = String(p || '');
  if (!s.startsWith('/')) s = '/' + s.replace(/^\.?\//, '');
  for (let i = 0; i < 3; i += 1) {
    try {
      const dec = decodeURI(s);
      if (dec === s) break;
      s = dec;
    } catch {
      break;
    }
  }
  s = encodeURI(s);
  return new URL(s, window.location.origin).toString();
}

function resolveFormUrl(selectedFormLabel) {
  if (!selectedFormLabel || typeof selectedFormLabel !== 'string') return '';
  const exact = FORM_FILE[selectedFormLabel];
  if (exact) return exact;

  if (selectedFormLabel.startsWith('Custom: ')) {
    const raw = selectedFormLabel.replace('Custom: ', '');
    return raw || '';
  }

  const canon = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\u2013|\u2014/g, '-')
      .trim();

  const wanted = canon(selectedFormLabel);
  const key = Object.keys(FORM_FILE).find((k) => canon(k) === wanted);
  if (key) return FORM_FILE[key];

  const starts = Object.keys(FORM_FILE).find((k) => canon(k).startsWith(wanted));
  if (starts) return FORM_FILE[starts];

  return '';
}

const { PDFDocument, StandardFonts, PDFName, PDFBool } = PDFLib;
if (typeof window !== 'undefined' && !window.PDFLib) window.PDFLib = PDFLib;

/**
 * === FILES ON DISK (public/form_pdfs) ===
 */
const FORM_FILE = {
  'Form 100 – Agreement of Purchase and Sale – Residential': '/form_pdfs/100.pdf',
  'Form 101 – Agreement of Purchase and Sale – Condominium': '/form_pdfs/101.pdf',
  'Form 105 – Amendment to Agreement of Purchase and Sale': '/form_pdfs/105.pdf',
  'Form 300 – Buyer Representation Agreement (Client)': '/form_pdfs/300.pdf',
  'Form 371 – Buyer Designated Representation Agreement': '/form_pdfs/371.pdf',
  'Form 801 – Offer Summary Document': '/form_pdfs/801.pdf',
  'Form 630 – Confirmation of Cooperation and Representation': '/form_pdfs/630.pdf',
  'Form 203 – Listing Agreement': '/form_pdfs/203.pdf',
};

const SUGGESTED_FORMS_ORDER = [
  'Form 801 – Offer Summary Document',
  'Form 371 – Buyer Designated Representation Agreement',
  'Form 100 – Agreement of Purchase and Sale – Residential',
  'Form 101 – Agreement of Purchase and Sale – Condominium',
  
];

const TYPE_TO_DEFAULT_FORM = {
  Freehold: 'Form 100 – Agreement of Purchase and Sale – Residential',
  Condo: 'Form 101 – Agreement of Purchase and Sale – Condominium',
};

/**
 * STRICT per-form alias whitelist
 */
const FORM_ALIAS = {
  // 🔒 DO NOT EDIT THIS MAPPING WITHOUT EXPLICIT APPROVAL
  'Form 100 – Agreement of Purchase and Sale – Residential': Object.freeze({
    // Parties
    agreementDay: ['txtp_OfferDate_d'],
    agreementMonthWord: ['txtp_OfferDate_mmmm'],
    agreementYear: ['txtp_OfferDate_yy'],

    // agreementYearLast2: ['txtAgreementYearLast2'], // <-- only if your PDF uses a 2-digit year field after a printed "20"

    buyer1FullName: ['txtbuyer1', 'txtbuyersig1'],
    buyer2FullName: ['txtbuyer2', 'txtbuyersig2'],
    seller1FullName: ['txtseller1', 'txtsellersig1'],
    seller2FullName: ['txtseller2', 'txtsellersig2'],

    // Address (primary + REQUIRED mirrors)
    streetNumber: ['txtp_streetnum'],
    streetName: ['txtp_street', 'txtsideOf'],
    unitNumber: ['txtp_unitNumber'],
    CityName: ['txtp_city', 'txtInThe'],
    province: ['txtp_state'],
    postalCode: ['txtp_zipcode'],

    // “in the ____” qualifier (City of / Town of / …)
    cityQualifier: ['hidInThe1'],

    // Fronting / Depth (OREA wording)
    frontingOn: ['txtp_Subdivision'],
    frontageNumber: ['txtp_SchoolDistrict'],
    frontageUnit: ['hidSize1'],
    depthNumber: ['txtp_ZoningClass'],
    depthUnit: ['hidSize2'],

    // Legal description
    legalDescription: ['txtp_legaldesc'],

    // Price & Deposit
    purchasePrice: ['txtp_price'],
    purchasePriceWords: ['txtp_pricewords'],
    depositAmount: ['txtp_deposit'],
    depositAmountWords: ['txtp_depositwords'],
    depositTiming: ['hidhereupon'],
    depositHolder: ['txtDepositHolder'],

    // Schedules
    attachedSchedules: ['txtAttachedSchedule'],

    // Irrevocable (modal)
    irrevBy: ['hidirrev_v_p'],
    irrevTime: ['txtp_irrev_t'],
    irrevDay: ['txtp_OfferExpireDate_d'],
    irrevMonthWord: ['txtp_OfferExpireDate_mmmm'],
    irrevYear: ['txtp_OfferExpireDate_yy'],


    // Completion (modal)
    completionDay: ['txtp_closedate_d'],
    completionMonthWord: ['txtp_closedate_mmmm'],
    completionYear: ['txtp_closedate_yy'],

    // Notices
    sellerNoticeEmail: ['txtl_brkagentemail'],
    buyerNoticeEmail: ['txts_brkagentemail'],

    // Chattels / Exclusions / Rentals
    chattelsIncluded: ['txtp_propincludes'],
    fixturesExcluded: ['txtp_propexcludes'],
    leasedItems: ['txtp_LeasedItems'],

    // HST (two buttons: Not Included / Included In)
    hstChoice: ['hidinc_add'],

    // Title Search (Requisition) date
    requisitionDay: ['txtp_fundingDate_d'],
    requisitionMonthWord: ['txtp_fundingDate_mmmm'],

    // Present Use
    presentUse: ['txtp_otherliensdesc'],

    // Spousal consent (label text under signature line)
    spousalConsentName: ['txtsp_sig1'],

    // Brokerages (Page 5—subset you wanted)
    listingBrokerageName: ['txtl_broker'],
    listingBrokeragePhone: ['txtl_brkphone'],
    listingSalesperson: ['txtl_brkagent'],
    listingBrokerOfRecord: ['txtl_brkname'],

    buyerBrokerageName: ['txts_broker'],
    buyerBrokeragePhone: ['txts_brkphone'],
    buyerSalesperson: ['txts_brkagent'],
    buyerBrokerOfRecord: ['txts_brkname'],

    // Schedule A header & body
    scheduleAHeader: ['txtAddSchedule'],
    scheduleABody: ['hidDynamicPage'],
  }),

  'Form 801 – Offer Summary Document': {
    buyer1FullName: ['txtbuyer1'],
    buyer2FullName: ['txtbuyer2'],
    seller1FullName: ['txtseller1'],
    seller2FullName: ['txtseller2'],
    streetNumber: ['txtp_streetnum'],
    streetName: ['txtp_street'],
    unitNumber: ['txtp_UnitNumber'],
    CityName: ['txtp_city'],
    province: ['txtp_state'],
    postalCode: ['txtp_zipcode'],
  },

  'Form 371 – Buyer Designated Representation Agreement': {
    buyer1FullName: ['txtbuyer1'],
    buyer2FullName: ['txtbuyer2'],
    // 371 uses buyer mailing address (location lines), not subject property
    buyerMailingAddressLine1: ['txtp_location'],
    buyerMailingAddressLine2: ['txtp_location2'],
  },
};

// Dev-only field map guard (supports CRA/Webpack & Vite)
(() => {
  try {
    if (
      typeof process !== 'undefined' &&
      process.env &&
      process.env.NODE_ENV === 'production'
    )
      return;

    const mustHaveKeys = [
      'streetName',
      'CityName',
      'cityQualifier',
      'frontingOn',
      'frontageNumber',
      'frontageUnit',
      'depthNumber',
      'depthUnit',
      'legalDescription',
      'purchasePrice',
      'depositAmount',
      'depositTiming',
      'depositHolder',
      'attachedSchedules',
      'irrevBy',
      'irrevTime',
      'irrevDay',
      'irrevMonthWord',
      'completionDay',
      'completionMonthWord',
      'completionYear',
      'sellerNoticeEmail',
      'buyerNoticeEmail',
      'chattelsIncluded',
      'fixturesExcluded',
      'leasedItems',
      'hstChoice',
      'requisitionDay',
      'requisitionMonthWord',
      'presentUse',
      'spousalConsentName',
      'listingBrokerageName',
      'listingBrokeragePhone',
      'listingSalesperson',
      'listingBrokerOfRecord',
      'buyerBrokerageName',
      'buyerBrokeragePhone',
      'buyerSalesperson',
      'buyerBrokerOfRecord',
      'scheduleAHeader',
      'scheduleABody',
    ];
    const alias =
      FORM_ALIAS[
        'Form 100 – Agreement of Purchase and Sale – Residential'
      ] || {};
    const missing = mustHaveKeys.filter((k) => !(k in alias));
    if (missing.length) {
      console.error('[FIELD MAP GUARD] Missing keys in Form 100 map:', missing);
    }
  } catch (_err) {
    // swallow
  }
})();

// ---------------- DEFAULT DEAL ----------------
const INITIAL_DEAL = {
  projectName: '',
  mlsId: '',
  intent: '',
  party: '',
  representationType: '',
  propertyType: '',
  mlsParsed: false,
  mlsAsked: false,


  buyers: [],
  sellers: [],

  address: {
    streetNumber: '',
    streetName: '',
    unitNumber: '',
    city: '',
    province: '',
    postalCode: '',
    frontingOn: '',
    cityQualifier: '',
    sideOf: '',
  },

  money: {
    offerPrice: '',
    offerPriceWords: '',
    deposit: '',
    depositWords: '',
    depositTiming: '',
    depositHolder: '',
  },

  irrev: {
    party: '',
    until: '',
    onISO: '',
  },

  agreementDate: '',
  completionDate: '',
  titleSearchDate: '',

  legalDescription: '',
  inclusions: '',
  exclusions: '',
  rentalItems: '',
  taxes: '',
  possession: '',

  hstMode: '',
  hstChoice: '',

  presentUse: '',

  notices: {
    sellerAgentEmail: '',
    buyerAgentEmail: '',
  },

  brokerages: {
    listing: {
      name: '',
      phone: '',
      agent: '',
    },
    buyer: {
      name: '',
      phone: '',
      agent: '',
    },
  },

  lawyers: {
    seller: { name: '', addr: '', email: '', phone: '', fax: '' },
    buyer: { name: '', addr: '', email: '', phone: '', fax: '' },
  },

  service: {
    buyerAddress: '',
    buyerPhone: '',
  },

  attachments: { schedules: [] },

  sizes: {
    frontage: '',
    depth: '',
    sizeUnit: '',
  },
};

function monthToWord(mm) {
  const i = parseInt(String(mm || '').trim(), 10);
  const names = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return Number.isFinite(i) && i >= 1 && i <= 12 ? names[i] : '';
}

// --- date helpers ---
function getDateParts(isoDateStr) {
  const [y, m, d] = String(isoDateStr || '')
    .split('-')
    .map((x) => parseInt(x, 10));
  if (!y || !m || !d) return { day: '', monthWord: '', year: '' };
  const monthNames = [
    '',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return {
    day: String(d),
    monthWord: monthNames[m] || '',
    year: String(y),
  };
}

// --- tiny date helpers used by irrev + demo ---
function toISODateTime(yyyy_mm_dd, hh_mm /* '07:00' */) {
  const s = String(yyyy_mm_dd || '').trim();
  const t = String(hh_mm || '00:00').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [h, m] = (t.split(':').map((n) => parseInt(n, 10)) || [0, 0]);
  const d = new Date(`${s}T00:00:00`);
  if (Number.isFinite(h)) d.setHours(h);
  if (Number.isFinite(m)) d.setMinutes(m);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
function to12h(hh_mm) {
  const [h, m] = (String(hh_mm || '00:00').split(':').map((n) => parseInt(n, 10)) || [0, 0]);
  let hr = ((h % 12) || 12);
  const ampm = h < 12 ? 'AM' : 'PM';
  const pad = (x) => String(x).padStart(2, '0');
  return `${hr}:${pad(m)} ${ampm}`;
}


// ---------------- HELPERS ----------------

// Infer "City of"/"Town of"/"Village of"/"Municipality of"/"Township of" from Legal Description text
function inferCityQualifierFromLegal(legalText) {
  const s = String(legalText || '').toUpperCase();
  if (/\bCITY OF\b/.test(s)) return 'City of';
  if (/\bTOWN OF\b/.test(s)) return 'Town of';
  if (/\bVILLAGE OF\b/.test(s)) return 'Village of';
  if (/\bMUNICIPALITY OF\b/.test(s)) return 'Municipality of';
  if (/\bTOWNSHIP OF\b/.test(s)) return 'Township of';
  return '';
}

// ===== Legal description skip helper (Nov 10 2025) =====
function hasLegalDescription(d) {
  const val = String(d?.legalDescription || d?.LegalDescription || '').trim();
  return !!val;
}



// ===== Field checks & direction normalizer (Nov 10, 2025) =====
function hasFrontingDirection(d) {
  const a = d?.address || {};
  const s = String(a.sideOf || a.frontingOn || '').trim();
  return !!s;
}
function normalizeDirection(val) {
  const t = String(val || '').trim().toLowerCase();
  if (/^n(orth)?$/.test(t)) return 'North';
  if (/^s(outh)?$/.test(t)) return 'South';
  if (/^e(ast)?$/.test(t)) return 'East';
  if (/^w(est)?$/.test(t)) return 'West';
  return '';
}

// ===== Advance after parties → ask what's missing (Address → Fronting → Legal → Frontage → Depth → PresentUse → Price → Deposit → Irrevocable → DepositTiming → DepositHolder → Completion → Schedules) =====


function advanceAfterAddressOrMLS(addMsgFn, setStageFn, setChatLogRef, setDealFn, dealLike) {
  const d = dealLike || {};

  // ----- helpers -----
  const num = (x) => {
    const n = Number(String(x ?? '').replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  };
  const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const isHHmm = (s) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
  const hasText = (s) => !!String(s || '').trim();

  // ----- address / lot -----
  const hasAddress =
    (typeof hasAddressFilled === 'function' ? hasAddressFilled(d) : false) ||
    !!(d.property && (d.property.street || d.property.city)) ||
    !!(d.address && (d.address.street || d.address.city));

  const hasFronting =
    !!(d.fronting || d.frontingOn || d.frontingDir || (d.address && d.address.frontingOn));

  const hasCityQualifier = !!(d.address && d.address.cityQualifier);

  const hasLegal = hasText(d.legalDescription);

  const sizes = d.sizes || {};
  const hasFrontage = hasText(sizes.frontage);
  const hasFrontageUnit = /^(feet|ft|metres?|meters|m)$/i.test(
    String(sizes.frontageUnit || sizes.sizeUnit || '')
  );
  const hasDepth = hasText(sizes.depth);
  const hasDepthUnit = /^(feet|ft|metres?|meters|m)$/i.test(
    String(sizes.depthUnit || sizes.sizeUnit || '')
  );

  // ----- economics / timing -----
  const priceN = num(d?.money?.offerPrice);
  const hasPrice = Number.isFinite(priceN) && priceN >= 1000;

  const depositN = num(d?.money?.deposit);
  const hasDeposit = Number.isFinite(depositN) && depositN > 0;

  // Irrevocable (accept new or legacy shapes)
  const irrevParty =
    (d.irrevocability && d.irrevocability.party) ||
    (d.irrev && d.irrev.party) ||
    '';
  const hasIrrevParty = /^(Buyer|Seller)$/i.test(String(irrevParty));

  const irrevDate = (d.irrevocability && d.irrevocability.date) || '';
  const hasIrrevDate = isISODate(irrevDate);

  const irrevTime = (d.irrevocability && d.irrevocability.time) || '';
  const hasIrrevTime = isHHmm(irrevTime);

   const hasCompletionDate = isISODate(d.completionDate);

  // ----- post-completion questions per your spec -----
  const hasBuyerEmail = hasText(d?.notices?.buyerEmail);
  const hasSellerEmail = hasText(d?.notices?.sellerEmail);
  const hasChattels = hasText(d.chattelsIncludedText);
  const hasExclusions = typeof d.fixturesExcludedText === 'string'; // may be empty string if "No"
  const hasRentals = typeof d.rentalItemsText === 'string'; // may be empty string if "No"
  const hasHst = hasText(d.hstChoice);

  // Present Use intentionally AFTER the above per your order
  const hasPresentUse = hasText(d.presentUse);

  const hasSchedules =
    (Array.isArray(d.schedules) && d.schedules.length > 0) ||
    hasText(d.schedulesText);
    // ----- ordered flow -----
  // 1) Address
  if (!hasAddress) {
    addMsgFn(setChatLogRef, 'tima', 'What is the property address?', ['Enter address']);
    setStageFn('addressPrompt');
    return;
  }

  // 2) Fronting direction
  if (!hasFronting) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'What direction does the property front on?',
      ['North', 'South', 'East', 'West']
    );
    setStageFn('fronting');
    return;
  }

  // 3) City/Town/Village/Municipality qualifier (hidInThe1)
  if (!hasCityQualifier) {
    const inferred =
      typeof inferCityQualifierFromLegal === 'function'
        ? inferCityQualifierFromLegal(d.legalDescription || '')
        : '';
    if (inferred) {
      setDealFn((prev) => ({
        ...(prev || {}),
        address: { ...(prev?.address || {}), cityQualifier: inferred },
      }));
    } else {
      addMsgFn(
        setChatLogRef,
        'tima',
        'Is the city name a City, Town, Village, Municipality, or Other?',
        ['City', 'Town', 'Village', 'Municipality', 'Other']
      );
      setStageFn('cityQualifier');
      return;
    }
  }

  // 4) Frontage number
  if (!hasFrontage) {
    addMsgFn(setChatLogRef, 'tima', 'What is the lot frontage?');
    setStageFn('frontage');
    return;
  }

  // 5) Frontage unit
  if (!hasFrontageUnit) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'Is the frontage in feet or metres?',
      ['Feet', 'Metres']
    );
    setStageFn('frontageUnit');
    return;
  }

  // 6) Depth number
  if (!hasDepth) {
    addMsgFn(setChatLogRef, 'tima', 'What is the lot depth?');
    setStageFn('depth');
    return;
  }

  // 7) Legal description
  if (!hasLegal) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'What is the legal description of the property?'
    );
    setStageFn('legalDesc');
    return;
  }

  // 8) Offer Price
  if (!hasPrice) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'What is the offer price? (numbers only, e.g., 800000)'
    );
    setStageFn('offerPrice');
    return;
  }
    // Deposit fields (added)
  const hasDepositTiming = hasText(d?.money?.depositTiming);
  const hasDepositHolder = hasText(d?.money?.depositHolder);


  // 9) Deposit Timing
  if (!hasDepositTiming) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'How is the deposit being submitted?',
      ['Herewith', 'Upon Acceptance', 'As otherwise described in this Agreement']
    );
    setStageFn('depositTiming');
    return;
  }

  // 10) Deposit Amount
if (!hasDeposit) {
  addMsgFn(
    setChatLogRef,
    'tima',
    'Deposit amount? (numbers only, e.g., 20000)'
  );
  setStageFn('deposit');
  return;
}


  // 11) Deposit Holder
  if (!hasDepositHolder) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'Who is holding the deposit in Trust?',
      ['Listing Brokerage', 'Other']
    );
    setStageFn('depositHolder');
    return;
  }
  // 12) Schedules (typed)
  if (!hasSchedules) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'Which schedules will be attached? (Type letters separated by commas, e.g., B,C,D )'
    );
    setStageFn('schedulesTyped');
    return;
  }

  // 13) Irrevocable Party
  if (!hasIrrevParty) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'This offer shall be irrevocable by:',
      ['Buyer', 'Seller']
    );
    setStageFn('irrevParty');
    return;
  }

  // 14) Irrevocable Date
  if (!hasIrrevDate) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'What is the irrevocable date?',
      ['Today', 'Choose date']
    );
    setStageFn('irrevDatePicking');
    return;
  }

  // 15) Irrevocable Time (modal)
  if (!hasIrrevTime) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'Pick the Irrevocable Time (time picker will open).'
    );
    setStageFn('irrevTimePicking');
    return;
  }

    // 16) Completion Date (typed with button)
  if (!hasCompletionDate) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'What is the completion / closing date?',
      ['Choose Date']
    );
    setStageFn('completionDateWait');
    return;
  }

     // 18) Seller Agent Email (Notices)
  if (!hasSellerEmail) {
    addMsgFn(setChatLogRef, 'tima', 'Seller agent notices email?');
    setStageFn('sellerNoticesEmail');
    return;
  }

  // 19) Chattels Included
  if (!hasChattels) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'What chattels are included?',
      ['Open Chattels Picker']
    );
    setStageFn('chattelsIncluded');
    return;
  }

  // 20) Fixtures Excluded
  if (!hasExclusions) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'Are there any fixtures excluded?',
      ['Yes', 'No']
    );
    setStageFn('fixturesExcluded');
    return;
  }

  // 21) Rental Items
  if (!hasRentals) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'Are there any rental/leased items?',
      ['Yes', 'No']
    );
    setStageFn('rentalItems');
    return;
  }

  // 22) HST
  if (!hasHst) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'HST?',
      ['Not Included', 'Included In']
    );
    setStageFn('hstChoice');
    return;
  }

  // 23) Present Use (moved late per spec)
  if (!hasPresentUse) {
    addMsgFn(
      setChatLogRef,
      'tima',
      'What is the present use of the property?',
      [
        'Single Family Residential',
        'Condo',
        'Duplex',
        'Residential with Apartment',
        'Other',
      ]
    );
    setStageFn('presentUse');
    return;
  }

  // Done with this sequence
}






// ===== MLS skip helpers (Nov 10, 2025) =====
function hasAddressFilled(d) {
  const a = d?.address || {};
  const sn = String(a.streetName || '').trim();
  const num = String(a.streetNumber || '').trim();
  const city = String(a.CityName || a.city || '').trim();
  return !!(sn && (num || city));
}
function hasSellersFilled(d) {
  const arr = d?.sellers || [];
  return Array.isArray(arr) && arr.filter(Boolean).length > 0;
}


// ===== After Agreement Date → ALWAYS ask Buyers first (Nov 10, 2025 · v5) =====
function goToNamesAfterAgreement(dealLike, addMsgFn, setStageFn, setChatLogRef, setDealFn) {
  // Mark that we must ask sellers after buyers are done
  if (typeof setDealFn === 'function') {
    setDealFn((d) => ({ ...(d || {}), __askSellersAfterBuyers: true }));
  }
  // Start with Buyers count every time
  addMsgFn(setChatLogRef, 'tima', 'How many buyers?', ['1', '2']);
  setStageFn('buyerCount');
}




// ===== Agreement Date → next stage (Nov 10, 2025) =====
function nextAfterAgreement(dealLike) {
  const r = String((dealLike?.representing || dealLike?.party || '')).toLowerCase();
  return (r === 'buyer' || r === 'tenant') ? 'buyerCount' : 'sellerCount';
}


// ===== Skip + stage helpers (Nov 10, 2025) =====
const SKIP_WORDS = ['skip', 'skip.', 'skip!', 'next', 'n/a', 'na', 'later', 'pass'];

function isSkip(raw) {
  const v = String(raw || '').trim().toLowerCase();
  return SKIP_WORDS.includes(v);
}

// Linear stage flow used only for "skip" advancement.
// If your app branches (e.g., buyer vs seller count), we still advance to the
// next *question* stage safely; undefined entries are ignored.
const NEXT_STAGE = {
  ptype: 'representing',
  representing: 'partyCount',       // your logic will branch to buyerCount/sellerCount as needed
  buyerCount: 'mlsUpload',
  sellerCount: 'mlsUpload',
  mlsUpload: 'agreementDate',
  agreementDate: 'forms',
  forms: 'clauses',
  clauses: 'summary',
};

// Prevent re-handling the same stage with the same "skip" input (re-entrancy guard)
let _lastSkipStageHandled = null;

function advanceStageFrom(currentStage, setStage, addMsg) {
  const next = NEXT_STAGE[currentStage];
  if (!next || next === currentStage) return;
  // Optional: announce advance in the chat UI (kept short)
  if (typeof addMsg === 'function') addMsg(null, 'tima', 'Okay, skipping.');
  setStage(next);
}

function addMsg(setter, sender, text, buttons = null, options = {}) {
  setter((prev) => {
    // When replaceLast is true, update the last message instead of pushing a new one.
    if (options && options.replaceLast && prev.length > 0) {
      const next = [...prev];
      next[next.length - 1] = { sender, text, buttons };
      return next;
    }

    // Default behavior: append the new message.
    return [...prev, { sender, text, buttons }];
  });
}

function numberToWords(n) {
  const num = Math.floor(
    Math.max(0, Number(String(n).replace(/[^\d]/g, '')) || 0)
  );
  if (num === 0) return 'Zero Dollars';
  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const b = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];
  const chunk = (x) => {
    if (x === 0) return '';
    if (x < 20) return a[x];
    if (x < 100)
      return `${b[Math.floor(x / 10)]}${
        x % 10 ? ' ' + a[x % 10] : ''
      }`;
    return `${a[Math.floor(x / 100)]} Hundred${
      x % 100 ? ' ' + chunk(x % 100) : ''
    }`;
  };
  const scale = ['', 'Thousand', 'Million', 'Billion'];
  const parts = [];
  let i = 0;
  let val = num;
  while (val > 0) {
    const c = val % 1000;
    if (c)
      parts.unshift(
        `${chunk(c)}${scale[i] ? ' ' + scale[i] : ''}`.trim()
      );
    val = Math.floor(val / 1000);
    i += 1;
  }
  return parts.join(' ') + ' Dollars';
}

function normalizePostal(pc) {
  if (!pc) return '';
  const raw = pc.toUpperCase().replace(/\s+/g, '');
  if (
    !/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(
      raw
    )
  )
    return pc.toUpperCase();
  return `${raw.slice(0, 3)} ${raw.slice(3)}`;
}

function parseCanadianAddress(line) {
  const out = {
    streetNumber: '',
    streetName: '',
    unitNumber: '',
    city: '',
    province: '',
    postalCode: '',
  };
  if (!line) return out;
  const original = String(line).replace(/\s+/g, ' ').trim();
  let s = original;

  // POSTAL
  const pcRE =
    /[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d/gi;
  const pcMatches = [...s.matchAll(pcRE)];
  if (pcMatches.length) {
    const pc = pcMatches[pcMatches.length - 1][0];
    out.postalCode = normalizePostal(pc);
    s = s.replace(pc, '').trim();
  }

  // PROVINCE
  const provRE =
    /\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/gi;
  const sBeforeProv = s;
  const provMatches = [...s.matchAll(provRE)];
  if (provMatches.length) {
    const provText = provMatches[provMatches.length - 1][0];
    const prov = provText.toUpperCase();
    out.province = prov;
    s = s
      .replace(new RegExp(`\\b${prov}\\b`, 'i'), '')
      .trim();

    if (!out.city) {
      const idx =
        sBeforeProv.toUpperCase().lastIndexOf(prov);
      if (idx > 0) {
        const beforeProv = sBeforeProv
          .slice(0, idx)
          .trim();
        const tokens = beforeProv
          .split(/\s+/)
          .filter(Boolean);

        const BAD_SUFFIX = new Set([
          'ST',
          'STREET',
          'RD',
          'ROAD',
          'AVE',
          'AVENUE',
          'DR',
          'DRIVE',
          'HWY',
          'HIGHWAY',
          'CRT',
          'COURT',
          'CRES',
          'CRESCENT',
          'BLVD',
          'TRL',
          'TRAIL',
          'LN',
          'LINE',
          'LANE',
          'PKWY',
          'PARKWAY',
          'PL',
          'PLACE',
          'TER',
          'TERRACE',
        ]);
        for (let i = tokens.length - 1; i >= 0; i -= 1) {
          const t = tokens[i].replace(/[.,]/g, '');
          if (/\d/.test(t)) continue;
          const upper = t.toUpperCase();
          if (BAD_SUFFIX.has(upper)) continue;
          out.city = t;
          break;
        }
      }
    }
  }

  // Split on commas
  let parts = s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) parts = [s];
  if (!out.city && parts.length >= 2) {
    out.city = parts[parts.length - 1];
    parts = parts.slice(0, -1);
  }

  // Street segment
  const streetSeg = parts.join(' ').trim();

  // Unit
  const unitMatch = streetSeg.match(
    /\b(?:unit|suite|ste|apt|apartment|#)\s*([A-Z0-9-]+)\b/i
  );
  if (unitMatch)
    out.unitNumber = unitMatch[1].toUpperCase();
  const prefixMatch = streetSeg.match(
    /^\s*([A-Z0-9]+)\s*-\s*(\d+)\b/
  );
  if (!out.unitNumber && prefixMatch)
    out.unitNumber = prefixMatch[1].toUpperCase();

  // Street number
  const numMatch = streetSeg.match(/\b(\d{1,6})\b/);
  if (numMatch) out.streetNumber = numMatch[1];

  // Street name
  let afterNum = streetSeg;
  if (numMatch) {
    const idx = streetSeg.indexOf(numMatch[0]);
    afterNum = streetSeg
      .slice(idx + numMatch[0].length)
      .trim();
  }
  afterNum = afterNum
    .replace(/^[A-Z0-9]+\s*-\s*/, '')
    .replace(
      /\b(?:unit|suite|ste|apt|apartment|#)\s*[A-Z0-9-]+\b/i,
      ''
    )
    .trim();
  if (out.city) {
    const cityTail = new RegExp(
      `\\b${out.city}\\b\\s*$`,
      'i'
    );
    afterNum = afterNum
      .replace(cityTail, '')
      .trim();
  }
  out.streetName = afterNum
    .replace(/\s*,\s*$/g, '')
    .trim();

  return out;
}

// --- Google Places loader (lazy) ---
let _placesLoader;
async function loadGooglePlaces() {
  if (_placesLoader) return _placesLoader;
  _placesLoader = new Promise((resolve, reject) => {
    const key =
      (typeof process !== 'undefined' &&
        process.env &&
        process.env.REACT_APP_GOOGLE_MAPS_API_KEY) ||
      (typeof window !== 'undefined' &&
        window.GOOGLE_MAPS_API_KEY);

    if (!key) {
      reject(
        new Error(
          'Missing Google Maps API key. Put it in .env as REACT_APP_GOOGLE_MAPS_API_KEY or in public/index.html as window.GOOGLE_MAPS_API_KEY.'
        )
      );
      return;
    }

    if (window.google?.maps?.places) {
      resolve(window.google);
      return;
    }

    const s = document.createElement('script');
    s.src =
      `https://maps.googleapis.com/maps/api/js?` +
      `key=${encodeURIComponent(key)}` +
      `&libraries=places&language=en&region=CA`;
    s.async = true;
    s.defer = true;
    s.onload = () =>
      (window.google?.maps
        ? resolve(window.google)
        : reject(
            new Error('Google Maps failed to load')
          ));
    s.onerror = () =>
      reject(
        new Error('Failed to load Google Maps script')
      );
    document.head.appendChild(s);
  });
  return _placesLoader;
}

function parsePlaceAddress(place) {
  const comps = {};
  (place?.address_components || []).forEach((c) => {
    c.types.forEach((t) => {
      comps[t] = c;
    });
  });
  const streetNumber =
    comps.street_number?.short_name || '';
  const route =
    comps.route?.short_name ||
    comps.route?.long_name ||
    '';
  const unit = comps.subpremise?.short_name || '';
  const city =
    comps.locality?.short_name ||
    comps.sublocality?.short_name ||
    comps.postal_town?.short_name ||
    '';
  const province =
    comps.administrative_area_level_1?.short_name || '';
  const postalRaw =
    comps.postal_code?.long_name || '';
  const postalCode = normalizePostal(postalRaw);

  return {
    streetNumber,
    streetName: route,
    unitNumber: unit,
    city,
    province,
    postalCode,
  };
}

// --- MLS helpers (names / phone / lists) ---
function splitPartyNames(text) {
  if (!text) return [];
  // split by & and and and commas, keep order, trim empties
  return String(text)
    .split(/\s*(?:&|and|,)\s*/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizePhone(s) {
  if (!s) return '';
  const digits = String(s).replace(/[^\d]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  return s.toString().trim();
}

function normalizeListText(s) {
  if (!s) return '';
  // collapse whitespace and trim trailing punctuation
  return String(s).replace(/\s+/g, ' ').replace(/\s*;?\s*$/,'').trim();
}


/* Build the logical→Acro payload (STRICT). */
function buildAcroFromDeal(currentDeal, prof) {
  const acro = {};

  /// Agreement date (store raw; prefer nested dates.agreementDate if present)
const _agree = (currentDeal?.dates?.agreementDate || currentDeal?.agreementDate || '');
acro.agreementDate = _agree;

// Split Agreement date into day / month (word) / year for "this ___ day of ________ 20____"
(function () {
  const s = _agree;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    acro.agreementDay = '';
    acro.agreementMonthWord = '';
    acro.agreementYear = '';
    return;
  }
  const [_, yyyy, mm, dd] = m;
  acro.agreementDay = String(parseInt(dd, 10));
  acro.agreementMonthWord = monthToWord(mm);
  acro.agreementYear = yyyy;
})();


  // --- Lot sizes → OREA 100 mappings ---
  acro.frontageNumber = (currentDeal.sizes && currentDeal.sizes.frontage) || '';
  acro.depthNumber    = (currentDeal.sizes && currentDeal.sizes.depth)    || '';
  {
    const unit = (currentDeal.sizes && currentDeal.sizes.sizeUnit) || '';
    acro.frontageUnit = unit;
    acro.depthUnit    = unit;
  }
  // === Lot size → AcroFields (frontage/depth + unit) ===
  {
    const frontageNum = String(currentDeal?.sizes?.frontage ?? '')
      .replace(/[^\d.]/g, '')
      .trim();
    const depthNum = String(currentDeal?.sizes?.depth ?? '')
      .replace(/[^\d.]/g, '')
      .trim();

    // Normalize to exactly 'feet' or 'metres' ONLY if a unit is actually set
    const rawUnit = String(
      currentDeal?.sizes?.frontageUnit ??
      currentDeal?.sizes?.depthUnit ??
      currentDeal?.sizes?.sizeUnit ??
      ''
    ).toLowerCase();

    const unitWord = rawUnit
      ? (rawUnit.startsWith('m') ? 'metres' : 'feet')
      : '';

    // Map to requested AcroFields
    acro.txtp_SchoolDistrict = frontageNum; // “What is the frontage…?” number only
    acro.txtp_ZoningClass = depthNum;       // “by a depth of …” number only

    // Only set hidden unit fields when we actually have a unit
    acro.hidSize1 = frontageNum && unitWord ? unitWord : '';
    acro.hidSize2 = depthNum && unitWord ? unitWord : '';
  }

  // parties …



  // Parties
  acro.buyer1FullName = currentDeal.buyers[0] || '';
  acro.buyer2FullName = currentDeal.buyers[1] || '';
  acro.seller1FullName = currentDeal.sellers[0] || '';
  acro.seller2FullName = currentDeal.sellers[1] || '';

  // Subject Property Address
  acro.streetNumber = currentDeal.address.streetNumber || '';
  acro.streetName = currentDeal.address.streetName || '';
  acro.unitNumber = currentDeal.address.unitNumber || '';
  acro.CityName = currentDeal.address.city || '';
  acro.province = currentDeal.address.province || '';
  acro.postalCode = currentDeal.address.postalCode || '';
  acro.frontingOn = currentDeal.address.frontingOn || '';
  acro.cityQualifier = currentDeal.address.cityQualifier || '';
  acro.sideOf = currentDeal.address.sideOf || '';

  // Buyer mailing (371)
  acro.buyerMailingAddressLine1 = (prof?.buyerMailingAddressLine1 || '').trim();
  acro.buyerMailingAddressLine2 = (prof?.buyerMailingAddressLine2 || '').trim();

  // Money
  if (currentDeal.money.offerPrice) {
    acro.offerPrice = String(currentDeal.money.offerPrice);
    acro.offerPriceWords =
      currentDeal.money.offerPriceWords ||
      numberToWords(currentDeal.money.offerPrice);
  }
    // Mirror to common PDF alias keys
  acro.purchasePrice = acro.offerPrice || '';
  acro.purchasePriceWords = acro.offerPriceWords || '';

  if (currentDeal.money.deposit) {
    acro.deposit = String(currentDeal.money.deposit);
    acro.depositWords =
      currentDeal.money.depositWords ||
      numberToWords(currentDeal.money.deposit);
  }
    // Mirror to common PDF alias keys
  acro.depositAmount = acro.deposit || '';
  acro.depositAmountWords = acro.depositWords || '';

  acro.depositTiming = currentDeal.money.depositTiming || '';
  acro.depositHolder = currentDeal.money.depositHolder || '';

  // Irrev
if (currentDeal.irrev.party) acro.irrevParty = currentDeal.irrev.party;
if (currentDeal.irrev.until) acro.irrevUntil = currentDeal.irrev.until;

if (currentDeal.irrev.onISO) {
  // Extract yyyy-mm-dd from the ISO datetime
  const irrevDateParts = getDateParts(
    currentDeal.irrev.onISO.slice(0, 10)
  );

  // Day + Month (same as before)
  acro.irrevDay = irrevDateParts.day;
  acro.irrevMonthWord = irrevDateParts.monthWord;

  // Year (FIX) — slice last two digits, e.g. "2025" → "25"
  acro.irrevYear = String(irrevDateParts.year).slice(-2);

  // Time + Party (same as before)
  acro.irrevTime = currentDeal.irrev.until;
  acro.irrevBy = currentDeal.irrev.party;
}


  // Agreement / completion / title search
  if (currentDeal.completionDate) {
    const c = getDateParts(currentDeal.completionDate);
    acro.completionDay = c.day;
    acro.completionMonthWord = c.monthWord;
    acro.completionYear = String(c.year).slice(-2);
  }
  if (currentDeal.titleSearchDate) {
    const t = getDateParts(currentDeal.titleSearchDate);
    acro.requisitionDay = t.day;
    acro.requisitionMonthWord = t.monthWord;
  }
  // --- Lot sizes → OREA 100 mappings ---
  // The PDF expects separate frontage/depth numbers and their units.
  acro.frontageNumber = (currentDeal.sizes && currentDeal.sizes.frontage) || '';
  acro.depthNumber    = (currentDeal.sizes && currentDeal.sizes.depth)    || '';
  const unit = (currentDeal.sizes && currentDeal.sizes.sizeUnit) || '';
  acro.frontageUnit = unit;
  acro.depthUnit    = unit;

  // Legal / present use
  acro.legalDescription = currentDeal.legalDescription || '';
  acro.presentUse = currentDeal.presentUse || '';

  // Inclusions / exclusions / rentals / HST
  acro.chattelsIncluded = currentDeal.inclusions || '';
  acro.fixturesExcluded = currentDeal.exclusions || '';
  acro.leasedItems = currentDeal.rentalItems || '';
  acro.hstChoice = currentDeal.hstChoice || '';

  // Notices
  acro.sellerNoticeEmail =
    currentDeal.notices.sellerAgentEmail || '';
  acro.buyerNoticeEmail =
    currentDeal.notices.buyerAgentEmail || '';

  // Brokerages
  acro.listingBrokerageName =
    currentDeal.brokerages.listing.name || '';
  acro.listingBrokeragePhone =
    currentDeal.brokerages.listing.phone || '';
  acro.listingSalesperson =
    currentDeal.brokerages.listing.agent || '';
  acro.listingBrokerOfRecord = ''; // not captured yet

  acro.buyerBrokerageName =
    currentDeal.brokerages.buyer.name ||
    prof?.brokerageName ||
    '';
  acro.buyerBrokeragePhone =
    currentDeal.brokerages.buyer.phone ||
    prof?.brokeragePhone ||
    '';
  acro.buyerSalesperson =
    currentDeal.brokerages.buyer.agent ||
    prof?.agentFullName ||
    '';
  acro.buyerBrokerOfRecord = ''; // not captured yet

  // Schedule A (header/body draft)
  // Leaving them blank for now unless you had logic to build scheduleAHeader/body.
  acro.scheduleAHeader = 'Schedule A';
  acro.scheduleABody = ''; // would be composed clauses
    // Line for Attached Schedules (e.g., "Schedules B, C attached hereto.")
  acro.attachedSchedules = currentDeal.schedulesText || '';



  return acro;
}

// Only used for "Download PDF"
async function fillPdfAndGetBlobURL(srcUrl, acro, aliasMap) {
  let fetchUrl = srcUrl;
  if (!/^(blob:|data:|https?:)/i.test(srcUrl)) {
    try {
      fetchUrl = normalizePublicUrl(srcUrl);
    } catch {
      fetchUrl = normalizePublicUrl(String(srcUrl || ''));
    }
  }

  const resp = await fetch(fetchUrl, { cache: 'no-store' });
  const ct = resp.headers.get('content-type') || '';
  if (!resp.ok || !ct.includes('pdf')) {
    const head = (await resp.text()).slice(0, 180);
    throw new Error(
      `Not a PDF at ${fetchUrl} (status: ${resp.status}, content-type: ${ct}) — first chars: ${head}`
    );
  }
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const pdfDoc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const form = pdfDoc.getForm();

  const fields = form.getFields();
  const names = fields
    .map((f) => {
      try {
        return f.getName();
      } catch (e) {
        console.debug(
          '[PDF] name read failed',
          e?.message || ''
        );
        return '';
      }
    })
    .filter(Boolean);

  const setAnyField = (name, value) => {
    try {
      const f = form.getField(name);
      if (!f) return false;
      if (f.setText) {
        f.setText(String(value));
        return true;
      }
      if (f.select) {
        try {
          f.select(String(value));
        } catch (e) {
          console.debug(
            '[PDF] select failed for field',
            name
          );
        }
        return true;
      }
      return false;
    } catch (e) {
      console.debug(
        '[PDF] setAnyField failed for',
        name,
        e?.message || ''
      );
      return false;
    }
  };

  const pickByAliases = (aliases) => {
    for (let i = 0; i < aliases.length; i += 1) {
      const nm = aliases[i];
      if (names.includes(nm)) return nm;
    }
    return null;
  };

  Object.entries(acro).forEach(([logicalKey, value]) => {
    const v = String(value || '').trim();
    if (!v) return;
    const aliases =
      (aliasMap && aliasMap[logicalKey]) || null;
    if (!aliases) return;
    const target = pickByAliases(aliases);
    if (target) setAnyField(target, v);
  });

  try {
    const helv = await pdfDoc.embedFont(
      StandardFonts.Helvetica
    );
    form.updateFieldAppearances(helv);
  } catch (e) {
    console.debug(
      '[PDF] embed Helvetica failed, trying NeedAppearances:',
      e?.message || ''
    );
    try {
      const acroFormDict =
        pdfDoc.catalog.getOrCreateAcroForm();
      acroFormDict.set(
        PDFName.of('NeedAppearances'),
        PDFBool.True
      );
    } catch (e2) {
      console.warn(
        '[PDF] Could not set NeedAppearances fallback:',
        e2?.message || ''
      );
    }
  }

  try {
    const out = await pdfDoc.save();
    return URL.createObjectURL(
      new Blob([out], { type: 'application/pdf' })
    );
  } catch (e) {
    console.warn(
      '[PDF] Save failed; returning original PDF for download:',
      e
    );
    return srcUrl;
  }
}

/** ===== Backend enrichment call ===== */
async function enrichAgentProfileFromWeb(query) {
  if (!query || typeof query !== 'string') return null;
  try {
    const resp = await fetch(
      `/api/agent-enrich?query=${encodeURIComponent(
        query
      )}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data && data.profile ? data.profile : null;
  } catch (e) {
    console.warn(
      'enrichAgentProfileFromWeb error:',
      e
    );
    return null;
  }
}

/** ===== MLS lookup (backend) ===== */
async function lookupMlsAndPrefill(mlsId) {
  if (!mlsId) return null;
  try {
    const resp = await fetch(
      `/api/mls-lookup?mlsId=${encodeURIComponent(
        mlsId
      )}`
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data && data.listing ? data.listing : null;
  } catch (e) {
    console.debug(
      'lookupMlsAndPrefill failed',
      e?.message || ''
    );
    return null;
  }
}

/** ===== Rich extraction for MLS text ===== */
function extractListingFromText(text) {
  if (!text) return {};
  return {};
}

// === Upload MLS PDF → parse in-memory (REALM/PropTx robust) ===
async function recognizeListingFromPdf(file) {
    let mlsId = '';
  // Read file into ArrayBuffer
  const buf = await file.arrayBuffer();

  // Lazy import pdfjs-dist so initial bundle stays small
  const pdfjsLib = await import('pdfjs-dist');
  const workerEntry = await import('pdfjs-dist/build/pdf.worker.entry');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerEntry;

  // Open document
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;

  // Read text from first 3 pages (typical for MLS printouts)
  let raw = '';
  const maxPages = Math.min(doc.numPages || 1, 3);
  for (let i = 1; i <= maxPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (item && item.str) raw += item.str + '\n';
    }
  }

  // Normalize once (keep line breaks)
  const text = raw
    .replace(/\r/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  // Split into lines once; used below
  const linesAll = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  // Small helpers
  const between = (src, start, stop) => {
    const s = src.indexOf(start);
    if (s < 0) return '';
    const e = src.indexOf(stop, s + start.length);
    return src.substring(s + start.length, e > -1 ? e : src.length).trim();
  };
  const pickFirst = (arr) => (Array.isArray(arr) ? arr.find(Boolean) : '') || '';

  // Strip header/footer/office lines so brokerage office addresses never become the subject address
  const lines = linesAll.filter((ln) => {
    if (/^Prepared By:/i.test(ln)) return false;
    if (/^PropTx Innovations Inc\./i.test(ln)) return false;
    if (/^Printed On:/i.test(ln)) return false;
    if (/^Phone:/i.test(ln)) return false;
    if (/^\d+\s+Brock St/i.test(ln)) return false; // your sample office address
    return true;
  });



  // --- MLS ID ---
      {
    // Accept common REALM/PropTx patterns:
    //  - E/W-prefixed 8–9 digits (e.g., E12345678)
    //  - Optional leading letter + 5–9 digits (legacy)
    //  - X + 7–10 digits (temporary exports)
    const m =
      (text.match(/\b([EW]\d{8,9})\b/)) ||
      (text.match(/\b([A-Z]?\d{5,9})\b/)) ||
      (text.match(/\b(X\d{7,10})\b/));
    mlsId = (m && m[1]) ? m[1].toUpperCase() : '';
  }


  // --- Sellers (robust) ---
let sellersText = '';
{
  // Header spellings with optional colon or (S)
  const idx = lines.findIndex((ln) =>
    /^SELLER(?:\/LANDLORD)?(?:\(S\))?\s*:?\s*$/i.test(ln)
  );
  if (idx >= 0 && lines[idx + 1]) {
    sellersText = lines[idx + 1].replace(/\s+/g, ' ').trim();
  }

  // Inline pattern (e.g., "Seller(s): John & Jane Doe")
  if (!sellersText) {
    const m = text.match(/Seller(?:\(s\))?\s*:\s*([^\n]+)\n/i);
    if (m) sellersText = m[1].replace(/\s+/g, ' ').trim();
  }

  // Page-2 heuristic (kept last)
  if (!sellersText) {
    const p2Idx = text.indexOf('--- PAGE 2 ---');
    if (p2Idx >= 0) {
      const after = text.slice(p2Idx, p2Idx + 2000);
      const p2Lines = after.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const stop = /^(Flexible|Immediate|Owner|Tenant|Vacant)\b/i;
      const collected = [];
      for (const ln of p2Lines) {
        if (ln === '--- PAGE 2 ---') continue;
        if (stop.test(ln)) break;
        if (/[A-Za-z],?\s+[A-Za-z]/.test(ln) || /\b[A-Z][a-z]+ [A-Z][a-z]+/.test(ln)) {
          collected.push(ln.replace(/\s+/g, ' ').trim());
          if (collected.length === 2) break;
        }
      }
      if (collected.length) sellersText = collected.join(', ');
    }
  }
}




 // --- Legal Description ---
let legalDescription = '';
{
  // Prefer bounded slice between clear markers
  const blk =
    between(text, 'LEGAL DESCRIPTION', 'STATUS') ||
    between(text, 'LEGAL DESC', 'STATUS') ||
    between(text, '\nLEGAL DESCRIPTION\n', '\nSTATUS\n');

  if (blk) {
    legalDescription = blk
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !/^LEGAL (?:DESCRIPTION|DESC)$/i.test(s))
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // Fallback regex (no STATUS marker required)
  if (!legalDescription) {
    const m = text.match(
      /LEGAL\s+(?:DESCRIPTION|DESC)\s*[:\-]?\s*([\s\S]{10,600}?)(?:\n[A-Z][A-Z\s/()#&.\-]{3,}|\nSTATUS|\nLOT SIZE|\nZONING|\n$)/i
    );
    if (m) legalDescription = m[1].replace(/\s+/g, ' ').trim();
  }

  // Guard against broken fragments like "RIPTION"
  if (!legalDescription || legalDescription.length < 12 || /[A-Z]{3,}$/.test(legalDescription)) {
    legalDescription = '';
  }
}


  // --- Subject Address (banner preferred; fallback: ADDRESS & MUNICIPALITY row) ---
  let addressLine = '';
  let city = '';
  let postalCode = '';

  // Banner like: "6 Windover Dr, Toronto ... M1G 1P1"
  {
    const m =
      text.match(/^\s*([\d\-]+\s+[^\n,]+),\s*([A-Za-z .]+).*?\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b.*$/m) ||
      text.match(/^\s*([\d\-]+\s+[^\n,]+),\s*([A-Za-z .]+)\s*$/m);
    if (m) {
      addressLine = (m[1] || '').trim();
      city = (m[2] || '').replace(/Toronto E\d+\s*,?\s*/i, 'Toronto').trim();
      postalCode = (m[3] || '').toUpperCase().replace(/\s+/g, ' ');
    }
  }

  if (!addressLine) {
    const table = between(text, 'ADDRESS &', 'AVERAGES');
    if (table) {
      const tbl = table.split('\n').map((s) => s.trim()).filter(Boolean);
      const row = tbl.find((s) => /^\d+/.test(s) && /[A-Za-z]/.test(s));
      if (row) {
        const m = row.match(/\b(\d+\s+NEW\s+)?(.+?)$/i);
        addressLine = (m ? m[2] : row).trim();
        const baseIdx = tbl.indexOf(row);
        const muni = (tbl[baseIdx + 1] || '').replace(/Toronto E\d+\s*,?\s*/i, 'Toronto');
        city = pickFirst(/Toronto/i.test(muni) ? 'Toronto' : (muni.split(/[ ,]/)[0] || '').trim(), city);
      }
    }
  }

  // Guard against office header lines
  if (/BROCK ST/i.test(addressLine) || /BROKERAGE/i.test(addressLine)) addressLine = '';

  const streetNumber = (addressLine.match(/^\d+[\-]?\d*/) || [''])[0];
  const streetName = addressLine.replace(/^\d+[\-]?\d*\s*/, '').trim();

// --- LISTING brokerage/phone/agents from "LISTING CONTRACTED WITH" block ---
let brokerageName = '';
let brokeragePhone = '';
let agentName = '';
{
  const blk = between(text, 'LISTING CONTRACTED WITH', 'Prepared By:') ||
              between(text, 'LISTING CONTRACTED WITH', 'ADDRESS &') ||
              between(text, '\nLISTING CONTRACTED WITH\n', '\n');
  const ls = (blk || '').split('\n').map((s) => s.trim()).filter(Boolean);

  // Pick brokerage as the LAST line that looks like a brokerage (avoid agent lines that mention RE/MAX, etc.)
  const isBrokerLine = (s) => /\b(BROKERAGE|REALTY|RE\/MAX|ROYAL LEPAGE|SUTTON|CENTURY\s*21|KELLER\s*WILLIAMS)\b/i.test(s);
  const brokerLines = ls.filter(isBrokerLine);
  if (brokerLines.length) {
    brokerageName = brokerLines[brokerLines.length - 1];
  }

  // Phone
  const phoneLine = ls.find((s) => /\bPHONE\b/i.test(s));
  if (phoneLine) {
    const pm = phoneLine.match(/PHONE\s*[:]\s*([()\d\-.\s]+)/i);
    if (pm) {
      const digits = pm[1].replace(/[^\d]/g, '');
      brokeragePhone = digits.length === 10
        ? digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
        : pm[1].replace(/\s+/g, ' ').trim();
    }
  }

  // Agent (primary)
  const agentLines = ls.filter((s) => /\b(Salesperson|Broker)\b/i.test(s));
  const cleaned = agentLines
    .map((s) => s.replace(/\s+\d[\d ()\-\.]+$/, '').trim())
    .map((s) => s.replace(/\s*,\s*(Broker|Salesperson).*/i, '').trim())
    .filter(Boolean);
  agentName = cleaned[0] || '';
}


  // --- Agent email (fallback from BROKERAGE REMARKS) ---
  let agentEmail = '';
  {
    const brBlk = between(text, 'BROKERAGE REMARKS', '$');
    const em = brBlk.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (em) agentEmail = em[0].toLowerCase();
  }

 // LOT SIZE and FRONTING ON (REALM) — capture numbers, units, and direction separately
var frontage = '';
var depth = '';
var lotSize = '';
var lotUnit = ''; // 'Feet' | 'Metres' | ''
var depthUnit = ''; // mirror of lotUnit when available
var frontingOn = ''; // e.g., North / South / East / West / N / S / E / W

{
  // Normalize a unit token we can print into the PDF (“Feet” vs “Metres”)
  const normalizeUnit = (u) => {
    if (!u) return '';
    if (/^m(etre|eter)/i.test(u)) return 'Metres';
    if (/^m\b$/i.test(u)) return 'Metres';
    return 'Feet';
  };

  // Pattern like: LOT SIZE 40.01 x 174.91 Feet   OR   LOT SIZE 12.2 x 30.1 m
  // We capture both numbers and an optional unit found after them.
  const m = text.match(
    /LOT\s+SIZE\s+([0-9.,]+)\s*[x×]\s*([0-9.,]+)\s*(feet|ft|m|metres?|meters)?/i
  );
  if (m) {
    const n1 = (m[1] || '').replace(/,/g, '');
    const n2 = (m[2] || '').replace(/,/g, '');
    const unitRaw = (m[3] || '').trim();
    const unitNorm = normalizeUnit(unitRaw);

    frontage = n1;
    depth = n2;
    lotUnit = unitNorm;     // for txtp_SchoolDistrict / hidSize1
    depthUnit = unitNorm;   // for txtp_ZoningClass / hidSize2
    lotSize = `${n1} x ${n2} ${unitNorm || 'Feet'}`;
  } else {
    // Fallback: keep whatever “LOT SIZE …” free text exists (rare formats)
    const m2 = text.match(
      /LOT\s+SIZE\s+(.+?)(?:\s+(?:LOT SHAPE|ZONING|TAXES|LISTING BROKERAGE|WATERFRONT|LISTING CONTRACTED WITH))/i
    );
    if (m2) lotSize = m2[1].trim();
  }

  // Fronting On: “Fronting On: North/East/…” or “Fronting On North”
  const mSide =
    text.match(/\bFronting\s+On\b\s*[:\-]?\s*([A-Za-z]+)/i) ||
    text.match(/\bFRONTING\s+ON\b\s*[:\-]?\s*([A-Za-z]+)/i);
  if (mSide) {
    const d = (mSide[1] || '').trim();
    // Normalize N/S/E/W to words so the PDF looks consistent
    frontingOn =
      /^n$/i.test(d) ? 'North' :
      /^s$/i.test(d) ? 'South' :
      /^e$/i.test(d) ? 'East'  :
      /^w$/i.test(d) ? 'West'  : d;
  }
}

// --- Inclusions / Exclusions / Rentals (first non-empty line after each header) ---

  const takeAfter = (label) => {
    const sect = between(text, ` ${label} `, ' WATERFRONT') || between(text, `\n${label}\n`, '\nWATERFRONT');
    if (!sect) return '';
    const first = sect.split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
    return first.replace(/^N\/A$/i, '').trim();
  };
  const inclusions = takeAfter('INCLUSIONS');
  const exclusions = takeAfter('EXCLUSIONS');
  const rentals = takeAfter('RENTAL ITEMS') || takeAfter('LEASE TO OWN ITEMS');

  // Build structured result (only return address if we actually captured it)
    const address =
    streetNumber || streetName || city
      ? {
          streetNumber: streetNumber || '',
          streetName:  streetName  || '',
          unitNumber:  '',
          CityName:    city || '',
          city:        city || '',
          province:    'ON',
          postalCode:  (postalCode || '').toUpperCase().replace(/\s+/g, ' ').trim(),
        }
      : null;

  

    /* === REALM post-processing (fills blanks only) === */
    /* Recompute sellers to avoid “NAME” header and COMMISSION bleed */
const fixedSellersText = (() => {
  const m = text.match(
    /SELLER\/LANDLORD[^\n]*\n([\s\S]*?)(?:\n\s*COMMISSION\b|^\s*[A-Z][A-Z \/-]{6,}\s*$)/mi
  );
  const raw = m ? m[1] : (sellersText || '');
  if (!raw) return '';
  const lines = raw
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s =>
      !/^NAME$/i.test(s) &&                // drop the "NAME" header line
      !/^COMMISSION\b/i.test(s) &&         // drop commission headers
      !/^\(?\d{3}\)?[ -.]?\d{3}[ -.]?\d{4}\b/.test(s) // drop phone-only lines
    );

  let best = lines.find(s => /,| and /i.test(s));
  if (!best) best = lines.find(s => /[a-z]/.test(s)) || '';

  return best
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
})();

/* Recompute address from banner/table (ignore office footer entirely) */
const fixedAddress = (() => {
  // Try a banner like: "6 Windover Cres, Toronto M1G 1P1"
  // (optional postal; ‘Toronto E09’ → ‘Toronto’ normalization handled)
  let streetNumber2 = '';
  let streetName2 = '';
  let city2 = '';
  let postal2 = '';

  const banner =
    text.match(/^\s*([\d\-]+\s+[^\n,]+),\s*([A-Za-z .'-]+)(?:\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d))?/m);

  if (banner) {
    const streetFull = (banner[1] || '').trim();
    const sn = streetFull.match(/^(\d+[\-]?\d*)\s+(.*)$/);
    if (sn) {
      streetNumber2 = sn[1];
      streetName2 = sn[2].trim();
    } else {
      streetName2 = streetFull;
    }
    city2 = (banner[2] || '').trim().replace(/\s+ON\b/i, '').trim();
    postal2 = (banner[3] || '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  // Fallback: ADDRESS & MUNICIPALITY table
  if (!streetName2) {
    const sect = between(text, 'ADDRESS &', 'AVERAGES');
    if (sect) {
      const tbl = sect.split('\n').map((s) => s.trim()).filter(Boolean);
      const row = tbl.find((s) => /^\d+/.test(s) && /[A-Za-z]/.test(s));
      if (row) {
        const m = row.match(/^(\d+[\-]?\d*)\s+(.*)$/);
        if (m) {
          streetNumber2 = m[1];
          streetName2 = m[2].trim();
        } else {
          streetName2 = row.trim();
        }
        const baseIdx = tbl.indexOf(row);
        const muni = (tbl[baseIdx + 1] || '').replace(/Toronto E\d+\s*,?\s*/i, 'Toronto');
        city2 = /Toronto/i.test(muni) ? 'Toronto' : (muni.split(/[ ,]/)[0] || '').trim();
      }
    }
  }

  // If the PDF mentions Toronto anywhere but your city looks like Whitby (office footer), prefer Toronto
  if (/Toronto/i.test(text) && /Whitby/i.test(city2)) {
    city2 = 'Toronto';
  }

  // Build, falling back to whatever the earlier 'address' object had (but never letting footer bleed in)
  if (streetName2 || city2) {
    return {
      streetNumber: streetNumber2 || address?.streetNumber || '',
      streetName: streetName2 || address?.streetName || '',
      unitNumber: '',
      CityName: city2 || address?.CityName || address?.city || '',
      city: city2 || address?.city || address?.CityName || '',
      province: 'ON',
      postalCode: (postal2 || address?.postalCode || '').toUpperCase().replace(/\s+/g, ' ').trim(),
      // mirror street to sideOf so your PDF side field gets a sensible default
      sideOf: (streetName2 || address?.sideOf || address?.streetName || '').trim(),
    };
  }

  return address || null;
})();

/* Final normalized object */
let out = {
  mlsId: mlsId || '',
  address: fixedAddress || null,
  sellersText: fixedSellersText || '',
  legalDescription: (legalDescription || '').trim(),
  lotSize: (lotSize || '').trim(),
  frontage: (frontage || '').trim(),
  depth: (depth || '').trim(),
  inclusions: (inclusions || '').trim(),
  exclusions: (exclusions || '').trim(),
  rentals: (rentals || '').trim(),
  brokerageName: (brokerageName || '').trim(),
  brokeragePhone: (brokeragePhone || '').trim(),
  agentName: (agentName || '').trim(),
  agentEmail: (agentEmail || '').trim(),
  lotUnit: (lotUnit || '').trim(),
};

   
  // Normalize address keys (CityName ↔ city) and mirror 'sideOf'
  if (out.address) {
    out.address.CityName = out.address.CityName || out.address.city || '';
    out.address.city = out.address.city || out.address.CityName || '';
    out.address.sideOf = out.address.sideOf || out.address.streetName || '';
  }
  // Fronting On (direction) → sideOf
  if (out.address) {
    const mSide = text.match(/\bFronting\s+On\b\s*[:\-]?\s*([A-Za-z]+)/i);
    if (mSide) out.address.sideOf = mSide[1];
  }

  // ---------- Legal Description (LEGAL DESCRIPTION → STATUS or blank line) ----------
  if (!out.legalDescription) {
    const mLD = text.match(/LEGAL DESCRIPTION\s+([\s\S]*?)(?:\n\s*STATUS\b|\n{2,})/i);
    if (mLD) {
      out.legalDescription = mLD[1]
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ');
    } else {
      // Fallback: PLAN/PARCEL block (e.g., "PARCEL ... TORONTO")
      const mLD2 = text.match(/PARCEL[\s\S]*?TORONTO/i);
      if (mLD2) {
        out.legalDescription = mLD2[0]
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
          .join(' ');
      }
    }
    if (out.legalDescription && out.legalDescription.length < 12) out.legalDescription = '';
  }
   // ---------- Listing Brokerage / Phone / Agent (LISTING CONTRACTED WITH …) ----------
  if (!out.brokerageName || !out.brokeragePhone || !out.agentName) {
    const blk =
      between(text, 'LISTING CONTRACTED WITH', 'Prepared By:') ||
      between(text, 'LISTING CONTRACTED WITH', 'ADDRESS &') ||
      between(text, 'LISTING CONTRACTED WITH', 'AVERAGES') ||
      between(text, 'LISTING CONTRACTED WITH', 'CO-OPERATING BROKERAGE') ||
      between(text, 'LISTING CONTRACTED WITH', 'COOPERATING BROKERAGE');

    if (blk) {
      const ls = blk.split('\n').map(s => s.trim()).filter(Boolean);

      // Brokerage line: prefer immediately before PHONE, else any line with major brokerage tokens
      const pIdx = ls.findIndex(s => /\bPHONE\b/i.test(s));
      const search = pIdx > 0 ? ls.slice(0, pIdx) : ls;
      const brokerLine = search.find(s => /\b(BROKERAGE|REALTY|RE\/MAX|ROYAL\s+LEPAGE|SUTTON|CENTURY\s*21|KELLER\s*WILLIAMS)\b/i.test(s));
      if (!out.brokerageName && brokerLine) {
        out.brokerageName = brokerLine.replace(/\s{2,}/g, ' ').trim();
      }

      // Phone: "PHONE 905-668-3800"
      if (!out.brokeragePhone) {
        const pLine = ls.find(s => /\bPHONE\b/i.test(s));
        if (pLine) {
          const pm = pLine.match(/PHONE\s*([()\d\-.\s]+)/i);
          if (pm) {
            const digits = pm[1].replace(/[^\d]/g, '');
            out.brokeragePhone = digits.length === 10
              ? digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
              : pm[1].replace(/\s+/g, ' ').trim();
          }
        }
      }

      // Agent: first line with ", Broker" or ", Salesperson" or line containing your agent's email
      if (!out.agentName) {
        const aLine =
          ls.find(s => /,\s*(Broker|Salesperson)\b/i.test(s)) ||
          ls.find(s => /@/.test(s)); // fallback: line with email (often the agent line)
        if (aLine) out.agentName = aLine.replace(/\s*,\s*(Broker|Salesperson).*/i, '').replace(/\s*\(.*$/, '').trim();
      }
    }
  }



  // ---------- Lot size → frontage/depth ----------
  if (!out.frontage || !out.depth) {
    const mLot = text.match(/LOT\s+SIZE\s+([0-9.,]+)\s*[x×]\s*([0-9.,]+)\s*(?:feet|ft|m|metres?|meters)?/i);
    if (mLot) {
      out.frontage ||= mLot[1].replace(/,/g, '');
      out.depth ||= mLot[2].replace(/,/g, '');
      out.lotSize ||= `${mLot[1].replace(/,/g, '')} x ${mLot[2].replace(/,/g, '')} Feet`;
    }
  }

  // ---------- Inclusions / Exclusions / Rentals (multi-line to next label) ----------
  if (!out.inclusions) {
    const mInc = text.match(/INCLUSIONS\s+([\s\S]*?)(?:\n\s*EXCLUSIONS\b|\n\s*RENTAL ITEMS\b|\n{2,})/i);
    if (mInc) out.inclusions = mInc[1].replace(/\s+/g, ' ').trim();
  }
  if (!out.exclusions) {
    const mExc = text.match(/EXCLUSIONS\s+([\s\S]*?)(?:\n\s*RENTAL ITEMS\b|\n{2,})/i);
    if (mExc) out.exclusions = mExc[1].replace(/\s+/g, ' ').trim();
  }
  if (!out.rentals) {
    const mRen = text.match(/RENTAL ITEMS\s+([\s\S]*?)(?:\n{2,}|WATERFRONTYN|SHOWING REQUIREMENTS)/i);
    if (mRen) out.rentals = mRen[1].replace(/\s+/g, ' ').trim();
  }

  return out;

}



/* ===========================
   MAIN APP COMPONENT
=========================== */
function App() {
  // ---- core state ----
  const [mode, setMode] = useState('home'); // 'home' (tiles) or 'forms'
  const [chatLog, setChatLog] = useState([]);
  const tmpSchedulesRef = useRef(new Set()); // holds currently toggled letters during picker
  const [stage, setStage] = useState('boot');
  const [input, setInput] = useState('');
  const [activeForms, setActiveForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState('');
  const [mobilePane, setMobilePane] = useState('chat'); // 'chat' | 'pdf' on small screens
  const [showFormsPicker, setShowFormsPicker] = useState(false);
  const [formsPickerSet, setFormsPickerSet] = useState(() => new Set());
  const [preferredFormHint, setPreferredFormHint] = useState(''); // 'freehold' | 'potl' | 'condo' | 'co-op' | 'mobile' | 'leasehold'
 
  const [deal, setDeal] = useState(
    
    INITIAL_DEAL
  );

  const [agentProfile, setAgentProfile] = useState(
    getAgentProfile() || {
      agentFullName: '',
      agentRegNo: '',
      agentEmail: '',
      agentPhone: '',
      agentTeam: '',
      brokerageName: '',
      brokerageAddr1: '',
      brokerageAddr2: '',
      brokerageCity: '',
      brokerageProvince: '',
      brokeragePostal: '',
      brokeragePhone: '',
      brokerageEmail: '',
    }
  );
  const [showOnboarding, setShowOnboarding] = useState(
    !hasAgentProfile()
  );

  // ---- modal states & temps ----
  const [showIrrevDateModal, setShowIrrevDateModal] =
    useState(false);
  const [tmpIrrevDate, setTmpIrrevDate] =
    useState('');
  const [showIrrevTimeModal, setShowIrrevTimeModal] =
    useState(false);
  const [tmpIrrevTime, setTmpIrrevTime] =
    useState('');

  const [
    showCompletionDateModal,
    setShowCompletionDateModal,
  ] = useState(false);
  const [tmpCompletionDate, setTmpCompletionDate] =
    useState('');

  const [showTitleDateModal, setShowTitleDateModal] =
    useState(false);
  const [tmpTitleDate, setTmpTitleDate] =
    useState('');
      // Agreement Date modal
  const [showAgreementDateModal, setShowAgreementDateModal] = useState(false);
  const [tmpAgreementDate, setTmpAgreementDate] = useState('');
    // MLS PDF upload modal
  const [showMlsUploadModal, setShowMlsUploadModal] = useState(false);
  const [mlsPdfFile, setMlsPdfFile] = useState(null);


  // ---- multi-select temps ----
  const [pendingSchedules, setPendingSchedules] =
    useState([]);
  const [pendingRentals, setPendingRentals] = useState(
    []
  );
  const [
    pendingAddressParts,
    setPendingAddressParts,
  ] = useState(null);

  // ---- refs ----
  const pdfjsContainerRef = useRef(null);
  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);
  const viewerCtxRef = useRef(null);

  // Address modal state/refs
  const [showAddressModal, setShowAddressModal] =
    useState(false);
  const [addressSearchVal, setAddressSearchVal] =
    useState('');
  const addressInputRef = useRef(null);
  const placesAutocompleteRef = useRef(null);

  // ---- dev overlay flag ----
  const [showPdfFieldOverlay, setShowPdfFieldOverlay] =
    useState(false);

  // ---- basic sanity test of parseCanadianAddress ----
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const isProd =
        typeof process !== 'undefined' &&
        process.env &&
        process.env.NODE_ENV === 'production';
      if (isProd) return;

      const ex = parseCanadianAddress(
        '23 Chopin Court Whitby ON L1N 6J9'
      );
      console.assert(
        ex.streetNumber === '23',
        'streetNumber should be 23',
        ex
      );
      console.assert(
        ex.streetName === 'Chopin Court',
        'streetName should be "Chopin Court"',
        ex
      );
      console.assert(
        ex.city === 'Whitby',
        'city should be Whitby',
        ex
      );
      console.assert(
        ex.province === 'ON',
        'province should be ON',
        ex
      );
      console.assert(
        ex.postalCode === 'L1N 6J9',
        'postalCode should be L1N 6J9',
        ex
      );
    } catch (e) {
      console.debug(
        'address parser test failed:',
        e?.message || ''
      );
    }
  }, []);

  // ---- seed chat on mount ----
useEffect(() => {
  // ensure right pane starts empty
  setActiveForms([]);
  setSelectedForm('');

  setChatLog([]);
  addMsg(
    setChatLog,
    'tima',
    'Hi! I am REA your AI based real estate assistant. How can I help you today?!',
    ['Start an offer', 'Help build my pipeline', 'Scheduling assistant']
  );
  setStage('intent');

  // keep greeting visible if layout paints late
  setTimeout(() => {
    try {
      if (chatScrollRef.current) chatScrollRef.current.scrollTop = 0;
    } catch (_e) {
      /* no-op */
    }
  }, 0);
}, []);
// ---- auto-scroll chat to bottom on new messages ----
useEffect(() => {
  try {
    if (chatScrollRef?.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  } catch (_e) {
    /* no-op */
  }
}, [chatLog]);



  // ---- auto scroll + focus ----
  useEffect(() => {
    try {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop =
          chatScrollRef.current.scrollHeight;
      }
      if (chatInputRef.current) {
        chatInputRef.current.focus();
      }
    } catch (e) {
      // ignore
    }
  }, [chatLog]);

  // ---- load Google Places once ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGooglePlaces();
        if (cancelled) return;
      } catch (e) {
        console.debug(
          'Google Places load skipped/failed:',
          e?.message || e
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

// attach Places Autocomplete when Address modal opens
useEffect(() => {
  let cleanup = () => {};
  (async () => {
    if (!showAddressModal) return;
    try {
      const g = await loadGooglePlaces();
      if (!addressInputRef.current) return;

      // Focus so Google shows suggestions immediately
      try {
        addressInputRef.current.focus();
        // Put caret at end
        const el = addressInputRef.current;
        const v = el.value || '';
        el.setSelectionRange(v.length, v.length);
        } catch (e) { /* noop: caret placement can fail in some browsers */ }


      // Create Places Autocomplete
      const ac = new g.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'ca' },
      });
            // keep a ref so it doesn't get GC'd during controlled re-renders
      placesAutocompleteRef.current = ac;


      const listener = ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place || !place.address_components) return;

        // Extract common parts
        const parts = {};
        for (const c of place.address_components) {
          if (c.types.includes('street_number')) parts.streetNumber = c.long_name;
          if (c.types.includes('route')) parts.streetName = c.long_name;
          if (c.types.includes('locality')) parts.CityName = c.long_name;
          if (c.types.includes('administrative_area_level_1')) parts.province = c.short_name;
          if (c.types.includes('postal_code')) {
            parts.postalCode = c.long_name;
          }
          if (c.types.includes('postal_code_suffix') && parts.postalCode) {
            parts.postalCode = `${parts.postalCode}-${c.long_name}`;
          }
          if (c.types.includes('subpremise')) parts.unitNumber = c.long_name;
        }

        // Update deal, mirror streetName into sideOf as before
setDeal((d) => ({
  ...d,
  address: {
    ...(d.address || {}),
    streetNumber: parts.streetNumber || (d.address && d.address.streetNumber) || '',
    streetName: parts.streetName || (d.address && d.address.streetName) || '',
    unitNumber: parts.unitNumber || (d.address && d.address.unitNumber) || '',
    CityName: parts.CityName || (d.address && d.address.CityName) || '',
    city: parts.CityName || (d.address && d.address.city) || '', // <-- keep lowercase city in sync
    province: parts.province || (d.address && d.address.province) || '',
    postalCode: parts.postalCode || (d.address && d.address.postalCode) || '',
    sideOf: parts.streetName || (d.address && d.address.sideOf) || '',
  },
}));


        // Close modal and advance
        setShowAddressModal(false);
        addMsg(setChatLog, 'tima', 'Got it. On which side does the property front?', ['North', 'South', 'East', 'West']);
        setStage('fronting');
      });

      // Ensure cleanup
            cleanup = () => {
        if (listener && listener.remove) listener.remove();
        try { g.maps.event.clearInstanceListeners(ac); } catch (e) { /* ignore cleanup errors */ }
        placesAutocompleteRef.current = null;
      };

    } catch (e) {
      // optional: console.error(e);
    }
  })();
  return () => cleanup();
}, [showAddressModal]);


  // showPdfFieldOverlay effect (draw outlines over PDF fields)
  useEffect(() => {
    if (!showPdfFieldOverlay) return;
    const container = pdfjsContainerRef.current;
    if (!container) return;

    const labelInputs = () => {
      try {
        const layers =
          container.querySelectorAll(
            '.annotationLayer'
          );
        layers.forEach((layer) => {
          const nodes = layer.querySelectorAll(
            'input,textarea,select,[contenteditable="true"]'
          );
          nodes.forEach((el) => {
            if (el.__pdfdbg) return;
            el.__pdfdbg = true;
            el.style.outline =
              '2px dashed rgba(10, 102, 194, 0.8)';
            el.style.outlineOffset = '2px';

            const id =
              el.dataset?.annotationId ||
              el.getAttribute(
                'data-annotation-id'
              ) ||
              '';
            const nm =
              el.getAttribute('name') || '';
            el.title = `name="${nm}"  id=${id}`;
          });
        });
      } catch (_err) {
        // swallow overlay labelling errors
      }
    };

    labelInputs();
    const iv = setInterval(labelInputs, 500);
    return () => clearInterval(iv);
  }, [showPdfFieldOverlay]);

  // compute acro
  const acroRafRef = useRef(0);
  const acro = useMemo(
    () => buildAcroFromDeal(deal, agentProfile),
    [deal, agentProfile]
  );

  // Render preview when form changes
  useEffect(() => {
    const container = pdfjsContainerRef.current;
    if (!container) {
      console.debug('[preview:skip] no container');
      return;
    }
    if (!container.isConnected) {
      console.debug(
        '[preview:skip] container not attached'
      );
      return;
    }
    if (!selectedForm || typeof selectedForm !== 'string') {
      console.debug(
        '[preview:skip] no selectedForm'
      );
      return;
    }

    const srcUrl = resolveFormUrl(selectedForm);
    if (!srcUrl) {
      console.warn(
        '[preview:skip] resolveFormUrl returned empty for',
        selectedForm
      );
      return;
    }
    const normalized = /^(blob:|data:|https?:)/i.test(
      srcUrl
    )
      ? srcUrl
      : normalizePublicUrl(srcUrl);
    if (!normalized || normalized === '/') {
      console.warn(
        '[preview:skip] normalized URL empty for',
        selectedForm,
        'srcUrl=',
        srcUrl
      );
      return;
    }

    const aliasMap = FORM_ALIAS[selectedForm] || {};
    let cancelled = false;

    (async () => {
      try {
        if (viewerCtxRef.current?.destroy) {
          await viewerCtxRef.current.destroy();
        }
        viewerCtxRef.current = null;
        container.innerHTML = '';
        console.log('[preview:call]', {
          selectedForm,
          mapped: FORM_FILE[selectedForm],
          containerExists: !!container,
          containerConnected: !!container?.isConnected,
          srcUrl,
          normalized,
        });

        const ctx = await renderPdfJsPreview({
          container,
          url: normalized,
          acro,
          aliasMap,
        });

        if (!cancelled) {
          viewerCtxRef.current = ctx;
        }
      } catch (e) {
        console.error(
          'PDF preview init error:',
          e
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedForm]);

  // Patch values in-place when acro changes (throttled to next frame)
  useEffect(() => {
    const ctx = viewerCtxRef.current;
    if (!ctx || !ctx.updateValues) return;

    if (acroRafRef.current) cancelAnimationFrame(acroRafRef.current);
    acroRafRef.current = requestAnimationFrame(() => {
      try { ctx.updateValues(acro); } catch (e) { /* ignore */ }
    });

    return () => {
      if (acroRafRef.current) cancelAnimationFrame(acroRafRef.current);
      acroRafRef.current = 0;
    };
  }, [acro]);

  // ===== DEV utils kept (not rendered in UI) =====
  async function dumpPdfFields() {
    try {
      const ctx = viewerCtxRef.current;
      if (!ctx?.pdfDocument) {
        window.alert(
          'Open a form first, then try again.'
        );
        return;
      }
      const fieldObjects =
        await ctx.pdfDocument.getFieldObjects();
      const flat = [];
      Object.entries(fieldObjects || {}).forEach(
        ([name, widgets]) => {
          (widgets || []).forEach((w) => {
            flat.push({
              fieldName: name,
              widgetId: w?.id,
              page: w?.page || '',
              type: w?.type || '',
            });
          });
        }
      );

      console.groupCollapsed(
        '[PDF] Field objects'
      );
      console.table(flat);
      console.groupEnd();

      const blob = new Blob(
        [
          JSON.stringify(
            {
              selectedForm,
              fields: fieldObjects,
            },
            null,
            2
          ),
        ],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(
        selectedForm || 'form'
      )
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9_]/g, '')}_fields.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.alert(
        'Field list downloaded and also logged to console.\nOpen the JSON and update FORM_ALIAS accordingly.'
      );
    } catch (e) {
      console.error(
        'dumpPdfFields failed:',
        e
      );
      window.alert(
        'Could not dump fields. See console.'
      );
    }
  }

  async function debugScanCurrentPdf() {
    try {
      const ctx = viewerCtxRef.current;
      if (!ctx?.pdfDocument) {
        window.alert(
          'Open a form first, then try again.'
        );
        return;
      }
      if (!selectedForm) {
        window.alert('Pick a form first.');
        return;
      }

      const aliasMap = FORM_ALIAS[selectedForm] || {};
      if (!Object.keys(aliasMap).length) {
        window.alert(
          `No FORM_ALIAS mapping found for:\n${selectedForm}`
        );
        return;
      }

      const fieldObjects =
        await ctx.pdfDocument.getFieldObjects();
      const presentFieldNames = new Set(
        Object.keys(fieldObjects || {})
      );

      const rows = [];
      let okCount = 0;
      let missingFieldCount = 0;
      let missingValueCount = 0;

      Object.entries(aliasMap).forEach(
        ([logicalKey, aliases]) => {
          const value = acro[logicalKey]
            ? String(acro[logicalKey])
            : '';
          const target =
            (aliases || []).find((a) =>
              presentFieldNames.has(a)
            ) || null;

          if (!target) {
            rows.push({
              logicalKey,
              status: 'NO FIELD',
              aliases: (aliases || []).join(', '),
              chosenField: '',
              currentValue: value,
            });
            missingFieldCount += 1;
            return;
          }

          const currentPdfVal =
            '(field exists)';

          if (!value) {
            rows.push({
              logicalKey,
              status: 'NO VALUE',
              aliases: (aliases || []).join(', '),
              chosenField: target,
              currentValue: '(empty)',
              currentPdfVal,
            });
            missingValueCount += 1;
            return;
          }

          rows.push({
            logicalKey,
            status: 'OK',
            aliases: (aliases || []).join(', '),
            chosenField: target,
            currentValue: value,
            currentPdfVal,
          });
          okCount += 1;
        }
      );

      console.groupCollapsed(
        '[Debug] Mapping scan:',
        selectedForm
      );
      console.table(rows);
      console.log('Summary:', {
        okCount,
        missingFieldCount,
        missingValueCount,
      });
      console.groupEnd();

      window.alert(
        `${selectedForm}\n\n` +
          `OK: ${okCount}\n` +
          `Missing PDF field: ${missingFieldCount}\n` +
          `Missing value: ${missingValueCount}\n\n` +
          `Details logged to the console (table).`
      );
    } catch (e) {
      console.error(
        'debugScanCurrentPdf failed:',
        e
      );
      window.alert(
        'Could not scan fields. See console for details.'
      );
    }
  }

  function loadDemoData() {
    setDeal((d) => ({
      ...d,
      intent: 'Offer',
      party: 'Buyer',
      representationType: 'Designated',
      propertyType: 'Freehold',
      buyers: ['Alexandra Buyer', 'Jordan Co-Buyer'],
      sellers: ['Pat Seller', 'Sam Co-Seller'],
      address: {
        ...d.address,
        streetNumber: '123',
        streetName: 'Maple Avenue',
        unitNumber: '5B',
        city: 'Whitby',
        province: 'ON',
        postalCode: 'L1N 6J9',
        frontingOn: 'North',
      },
      money: {
        ...d.money,
        offerPrice: '899000',
        offerPriceWords: numberToWords('899000'),
        deposit: '25000',
        depositWords: numberToWords('25000'),
        depositTiming: 'Herewith',
        depositHolder:
          'ABC Realty, Brokerage',
      },
      irrev: {
        ...d.irrev,
        party: 'Buyer',
        until: '7:00 PM',
        onISO: toISODateTime(
          '2025-11-30',
          '19:00'
        ),
      },
      agreementDate: '2025-11-25',
      completionDate: '2026-01-15',
      titleSearchDate: '2025-12-20',
      legalDescription:
        'LT 42 PL 123; S/T EASEMENT WHATEVER; PIN 12345-6789',
      inclusions:
        'Fridge, stove, dishwasher, washer, dryer, light fixtures, window coverings.',
      exclusions:
        'Dining room chandelier.',
      rentalItems: 'Hot water tank',
      hstMode: 'inc',
      presentUse:
        'Single Family Residential',
      notices: {
        ...(d.notices || {}),
        sellerAgentEmail:
          'listing@brokerage.com',
        buyerAgentEmail:
          d?.notices?.buyerAgentEmail ||
          'you@yourbrokerage.com',
      },
      brokerages: {
        ...(d.brokerages || {}),
        listing: {
          name: 'ListingCo Realty Inc., Brokerage',
          phone: '(416) 555-1212',
          agent: 'Taylor Listing',
        },
        buyer: {
          name:
            d?.brokerages?.buyer?.name ||
            'Your Brokerage Inc.',
          phone:
            d?.brokerages?.buyer?.phone ||
            '(905) 555-3434',
          agent:
            d?.brokerages?.buyer?.agent ||
            'You, Salesperson',
        },
      },
      lawyers: {
        seller: {
          name: 'Seller Law LLP',
          addr: '10 King St W, Toronto ON',
          email: 's@law.com',
          phone:
            '(416) 555-0001',
          fax: '(416) 555-0002',
        },
        buyer: {
          name: 'Buyer Law LLP',
          addr: '22 Queen St E, Toronto ON',
          email: 'b@law.com',
          phone:
            '(416) 555-0003',
          fax: '(416) 555-0004',
        },
      },
      service: {
        buyerAddress:
          '5 Elm St, Whitby ON L1N 6J9',
        buyerPhone:
          '(905) 555-9000',
      },
      attachments: {
        schedules: ['A', 'C'],
      },
      sizes: {
        frontage: '40',
        depth: '100',
        sizeUnit: 'feet',
      },
    }));

    ensureFormInList(
      'Form 801 – Offer Summary Document'
    );
    ensureFormInList(
      'Form 371 – Buyer Designated Representation Agreement'
    );
    ensureFormInList(
      'Form 100 – Agreement of Purchase and Sale – Residential'
    );
    if (!selectedForm) {
      setSelectedForm(
        'Form 801 – Offer Summary Document'
      );
    }
    addMsg(
      setChatLog,
      'tima',
      'Loaded demo data. Switch forms above to see them filled.'
    );
  }

  function previewFilledValues() {
    try {
      const aliasMap =
        FORM_ALIAS[selectedForm] || {};
      const rows = Object.entries(
        aliasMap
      ).map(
        ([
          logicalKey,
          aliases,
        ]) => ({
          logicalKey,
          value: acro[logicalKey]
            ? String(
                acro[
                  logicalKey
                ]
              )
            : '',
          aliases: (aliases || []).join(
            ', '
          ),
        })
      );
      console.groupCollapsed(
        '[Filled Values] →',
        selectedForm
      );
      console.table(rows);
      console.groupEnd();
      window.alert(
        'Opened a console table with all logical keys, their values, and alias candidates.\n(DevTools → Console)'
      );
    } catch (e) {
      console.error(
        'previewFilledValues failed:',
        e
      );
      window.alert(
        'Could not display values. See console.'
      );
    }
  }

  const ensureFormInList = (name) => {
    setActiveForms((prev) =>
      prev.includes(name)
        ? prev
        : [...prev, name]
    );
  };

  // =======================
  // User input handler (chat)
  // =======================
  const handleUserInput = (raw) => {
    const v = String(raw || '').trim();
    if (!v) return;
    setInput('');

    const lower = v.toLowerCase();
    // ===== Skip + stage helpers (Nov 10, 2025 · v2) =====
const SKIP_WORDS = ['skip', 'skip.', 'skip!', 'next', 'n/a', 'na', 'later', 'pass'];

function isSkip(raw) {
  // accept buttons like "Skip »", any case, trim punctuation
  const v = String(raw || '').trim().toLowerCase();
  if (SKIP_WORDS.includes(v)) return true;
  // tolerate common variants
  const cleaned = v.replace(/[>»!.\-_:]+$/g, '').trim();
  return cleaned === 'skip' || cleaned === 'next';
}

const ORDERED_STAGES = [
  'intent',
  'ptype',
  'repWho',
  'repSigned',
  'repMode',
  'need801',
  'mlsIdPreParty',
  'agreementDate',

  // Parties
  'buyerCount', 'buyer1', 'buyer2',
  'sellerCount', 'seller1', 'seller2',

  // Address / site / legal
  'addressPrompt',
  'fronting',
  'legalDesc',
  'frontage',
  'depth',

  // Economics & timing
  'offerPrice',
  'deposit',
  'irrevParty',
  'irrevDatePicking',
  'depositTiming',
  'depositHolder',
  'completionDate',

  // Notices & inclusions/exclusions/rentals/HST (after Completion)
  'buyerAgentEmailWithDefault',
  'buyerAgentEmail',
  'sellerAgentEmail',
  'inclusions',
  'exclusions',
  'rentals',
  'hstChoice',

  // Present use moved late
  'presentUse',

  // Then schedules & summary
  'schedules',
  'summary',
];


// Direct overrides where we want to jump further than the simple +1
const NEXT_STAGE = {
  intent: 'ptype',
  ptype: 'repWho',
  repWho: 'repSigned',
  repSigned: 'need801',
  repMode: 'need801',
  need801: 'mlsIdPreParty',
  mlsIdPreParty: 'agreementDate',
  agreementDate: 'addressPrompt',
  buyerCount: 'addressPrompt',
  sellerCount: 'addressPrompt',
  buyer1: 'addressPrompt',
  buyer2: 'addressPrompt',
  seller1: 'addressPrompt',
  seller2: 'addressPrompt',
};

let _lastSkipStageHandled = null;

function nextStageFor(current) {
  // 1) explicit override
  if (current in NEXT_STAGE) return NEXT_STAGE[current];

  // 2) fall back to the ordered list
  const idx = ORDERED_STAGES.indexOf(current);
  if (idx >= 0 && idx < ORDERED_STAGES.length - 1) {
    return ORDERED_STAGES[idx + 1];
  }
  return null;
}

function advanceStageFrom(currentStage, setStage, addMsg, setChatLog) {
  const next = nextStageFor(currentStage);
  if (!next || next === currentStage) return;
  // Add a tiny system note in the chat, using your addMsg signature
  if (typeof addMsg === 'function' && typeof setChatLog !== 'undefined') {
    addMsg(setChatLog, 'tima', 'Okay, skipping.');
  }
  setStage(next);
}


// ===== Intent (Property Type first) =====
if (stage === 'intent') {
  if (lower.includes('offer') || /^start an offer$/i.test(v)) {
    // Keep right pane empty until we know the type
    setMode('forms');
    setSelectedForm('');
    setActiveForms([]);

    setDeal((d) => ({ ...d, intent: 'Offer' }));

    // Ask property type FIRST
    addMsg(
      setChatLog,
      'tima',
      'What type of property?',
      ['Freehold', 'Condo', 'Co-op', 'Mobile', 'Leasehold', 'POTL']
    );
    setStage('ptype');
    return;
  }

  addMsg(
    setChatLog,
    'tima',
    'Got it. For now I’m optimized for Offers. Type "Start an offer" to continue.'
  );
  return;
}



    // ===== Party =====
    if (stage === 'party') {
      let party = '';
      if (
        /buyer|seller|tenant|landlord/i.test(
          v
        )
      ) {
        if (/buyer/i.test(v)) party = 'Buyer';
        else if (/seller/i.test(v))
          party = 'Seller';
        else if (/tenant/i.test(v))
          party = 'Tenant';
        else if (/landlord/i.test(v))
          party = 'Landlord';
      }
      if (!party) {
        addMsg(
          setChatLog,
          'tima',
          'Please choose one:',
          [
            'Buyer',
            'Seller',
            'Tenant',
            'Landlord',
          ]
        );
        return;
      }
      setDeal((d) => ({
        ...d,
        party,
      }));
      addMsg(
        setChatLog,
        'tima',
        'Is it Designated or Client representation?',
        ['Designated', 'Client']
      );
      setStage('rep');
      return;
    }

    // ===== Representation =====
    if (stage === 'rep') {
      let rep = '';
      if (/designated/i.test(v))
        rep = 'Designated';
      if (/client/i.test(v))
        rep = 'Client';

      if (!rep) {
        addMsg(
          setChatLog,
          'tima',
          'Please choose one:',
          [
            'Designated',
            'Client',
          ]
        );
        return;
      }

      setDeal((d) => ({
        ...d,
        representationType: rep,
      }));

            addMsg(
        setChatLog,
        'tima',
        'What type of property?',
        [
          'Freehold',
          'Condo',
          'Co-op',
          'Mobile',
          'Leasehold',
          'POTL',
        ]
      );
      setStage('ptype');
      return;
    }

 // ===== Property type =====
if (stage === 'ptype') {
  let p = '';
  if (/freehold|condo|co-?op|mobile|leasehold|potl/i.test(v)) {
    if (/freehold/i.test(v))      { p = 'Freehold';  setPreferredFormHint('freehold'); }
    else if (/condo/i.test(v))    { p = 'Condo';     setPreferredFormHint('condo'); }
    else if (/co-?op/i.test(v))   { p = 'Co-op';     setPreferredFormHint('co-op'); }
    else if (/mobile/i.test(v))   { p = 'Mobile';    setPreferredFormHint('mobile'); }
    else if (/leasehold/i.test(v)){ p = 'Leasehold'; setPreferredFormHint('leasehold'); }
    else if (/potl/i.test(v))     { p = 'POTL';      setPreferredFormHint('potl'); }
  }

  if (!p) {
    addMsg(setChatLog, 'tima', 'What type of property is this?', [
      'Freehold',
      'Condo',
      'Co-op',
      'Mobile',
      'Leasehold',
      'POTL',
    ]);
    return;
  }

  // store property type immediately
  setDeal((d) => ({ ...d, propertyType: p }));

  // Remove any existing APS (100..103) then add ONLY the preferred one
  removeFormByRegex(/\b10(0|1|2|3)\b/i);

  let apsRegex = null;
  if (p === 'Freehold' || p === 'POTL') apsRegex = /(form\s*100\b|freehold|potl)/i;
  else if (p === 'Condo')               apsRegex = /(form\s*101\b|condo|condominium)/i;
  else if (p === 'Co-op')               apsRegex = /(form\s*102\b|co-?op)/i;
  else if (p === 'Mobile')              apsRegex = /(form\s*103\b|mobile)/i;
  else if (p === 'Leasehold')           apsRegex = /(leasehold|form\s*10\d\b)/i;

  const picked = apsRegex ? ensureFormByRegex(apsRegex) : '';
  if (picked) preferAndSelect(picked);

  // Continue: Who are you representing?
  addMsg(setChatLog, 'tima', 'Who are you representing?', ['Buyer', 'Seller']);
  setStage('repWho');
  return;
}

// ===== Representation — who are you representing? =====
if (stage === 'repWho') {
  const choice = String(v || '').trim().toLowerCase();
  if (!/(buyer|seller)/.test(choice)) {
    addMsg(setChatLog, 'tima', 'Who are you representing?', ['Buyer', 'Seller']);
    return;
  }
  const rep = /buyer/.test(choice) ? 'Buyer' : 'Seller';
  setDeal((d) => ({ ...d, representing: rep }));

  // Next: do you already have representation paperwork signed?
  addMsg(setChatLog, 'tima', 'Do you already have the representation paperwork signed?', ['Yes', 'No']);
  setStage('repSigned');
  return;
}

// ===== Representation — paperwork signed? =====
if (stage === 'repSigned') {
  const ans = String(v || '').trim().toLowerCase();
  if (!/^(yes|no)$/i.test(ans)) {
    addMsg(setChatLog, 'tima', 'Do you already have the representation paperwork signed?', ['Yes', 'No']);
    return;
  }

  if (/yes/i.test(ans)) {
    // Skip designated/client step entirely
    // Next: 801 needed?
    addMsg(setChatLog, 'tima', 'Do you need a Form 801 (Offer Summary Document)?', ['Yes', 'No']);
    setStage('need801');
    return;
  }

  // No → ask rep mode (Designated vs Client)
  addMsg(setChatLog, 'tima', 'Is it Designated or Client representation?', ['Designated', 'Client']);
  setStage('repMode');
  return;
}

// ===== Representation — mode (Designated vs Client) =====
if (stage === 'repMode') {
  const choice = String(v || '').trim().toLowerCase();
  if (!/(designated|client)/.test(choice)) {
    addMsg(setChatLog, 'tima', 'Is it Designated or Client representation?', ['Designated', 'Client']);
    return;
  }

  // Remove any prior 371/300 to avoid duplicates
  removeFormByRegex(/\b371\b/);
  removeFormByRegex(/\b300\b/);

  if (/designated/.test(choice)) {
    // Prefer any label that contains "371"
    const f371 = ensureFormByRegex(/\b371\b/);
    preferAndSelect(f371);
    setDeal((d) => ({ ...d, representationMode: 'Designated', representationType: 'Designated' }));
  } else {
    // Prefer any label that contains "300"
    const f300 = ensureFormByRegex(/\b300\b/);
    preferAndSelect(f300);
    setDeal((d) => ({ ...d, representationMode: 'Client', representationType: 'Client' }));
  }

  // Next: do we need 801?
  addMsg(setChatLog, 'tima', 'Do you need a Form 801 (Offer Summary Document)?', ['Yes', 'No']);
  setStage('need801');
  return;
}

// ===== 801 needed? =====
if (stage === 'need801') {
  const ans = String(v || '').trim().toLowerCase();
  if (!/^(yes|no)$/i.test(ans)) {
    addMsg(setChatLog, 'tima', 'Do you need a Form 801 (Offer Summary Document)?', ['Yes', 'No']);
    return;
  }

  // Add/remove 801 by regex (label-agnostic)
  removeFormByRegex(/\b801\b/);
  if (/yes/i.test(ans)) {
    const f801 = ensureFormByRegex(/\b801\b/);
    preferAndSelect(f801);
  }

  // Ask for MLS once (upload, paste, or skip), then we’ll continue
addMsg(
  setChatLog,
  'tima',
  'Do you have an MLS ID for this property? (Paste it, tap "Upload MLS PDF", or type "skip")',
  ['Upload MLS PDF', 'skip']
);
setStage('mlsIdPreParty');
return;

}

        // ===== MLS ID (pre-party counts) =====
    if (stage === 'mlsIdPreParty') {
      const ans = String(v || '').trim();

      if (/^upload mls pdf$/i.test(ans)) {
        setMlsPdfFile(null);
        setShowMlsUploadModal(true);
        return;
      }

      // Skip → go to Agreement Date (ask first)
if (/^skip$/i.test(ans)) {
  setDeal((d) => ({ ...d, mlsId: '', mlsAsked: true }));
  addMsg(setChatLog, 'tima', 'What is the Agreement Date?', ['Today', 'Choose date']);
  setStage('agreementDateAsk');
  return;
}



      // Pasted ID path
      if (/^[A-Z]?\d{5,9}$/i.test(ans) || /^X\d{7,10}$/i.test(ans)) {
        const id = ans.toUpperCase();
        setDeal((d) => ({ ...d, mlsId: id }));

        // If you have lookupMlsAndPrefill, keep as-is; else just confirm and move on
        if (typeof lookupMlsAndPrefill === 'function') {
          lookupMlsAndPrefill(id)
            .then((listing) => {
              if (listing) {
                // Reuse your uploader merge pattern for consistency
                setDeal((d) => {
                  const prevAddr = d.address || {};
                  const parsedAddr = listing.address || null;
                  const mergedAddress = parsedAddr
                    ? {
                        ...prevAddr,
                        streetNumber: parsedAddr.streetNumber || prevAddr.streetNumber || '',
                        streetName:  parsedAddr.streetName  || prevAddr.streetName  || '',
                        unitNumber:  parsedAddr.unitNumber  || prevAddr.unitNumber  || '',
                        CityName:    parsedAddr.CityName    || prevAddr.CityName    || '',
                        province:    parsedAddr.province    || prevAddr.province    || '',
                        postalCode:  parsedAddr.postalCode  || prevAddr.postalCode  || '',
                        sideOf:      (parsedAddr.streetName || prevAddr.sideOf || ''),
                      }
                    : prevAddr;
                  const prevMoney = d.money || {};
                  const priceNum  = listing.listPrice != null ? String(listing.listPrice) : (prevMoney.offerPrice || '');
                  return {
                    ...d,
                    mlsId: id,
                    address: mergedAddress,
                    money: {
                      ...prevMoney,
                      offerPrice: priceNum,
                      offerPriceWords:
                        listing.listPrice != null
                          ? (typeof numberToWords === 'function' ? numberToWords(listing.listPrice) : (prevMoney.offerPriceWords || ''))
                          : (prevMoney.offerPriceWords || ''),
                    },
                  };
                });
              }
            })
            .finally(() => {
              const currentParty = deal.representing || deal.party || '';
              if (currentParty === 'Buyer' || currentParty === 'Tenant') {
                addMsg(setChatLog, 'tima', 'How many buyers?', ['1', '2']);
                setStage('buyerCount');
              } else {
                addMsg(setChatLog, 'tima', 'How many sellers?', ['1', '2']);
                setStage('sellerCount');
              }
            });
          return;
        }

     // No lookup function: go to Agreement Date
addMsg(setChatLog, 'tima', 'What is the Agreement Date?', ['Today', 'Choose date']);
setStage('agreementDateAsk');
return;

      }

      // Default prompt to keep the user on this stage
      addMsg(
        setChatLog,
        'tima',
        'Paste the MLS ID, tap "Upload MLS PDF", or type "skip".',
        ['Upload MLS PDF', 'skip']
      );
      return;
    }
// ===== Agreement Date — ask first (Today vs Choose) =====
if (stage === 'agreementDateAsk') {
  // "Today"
  if (/^today\b/i.test(v)) {
    const iso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
let nextDeal;
setDeal((d) => {
  nextDeal = {
    ...(d || {}),
    agreementDate: iso, // legacy flat field (kept for older mappings)
    dates: { ...(d?.dates || {}), agreementDate: iso },
  };
  return nextDeal;
});

addMsg(setChatLog, 'tima', `Agreement Date set to ${iso}.`);
goToNamesAfterAgreement(nextDeal, addMsg, setStage, setChatLog, setDeal);

return;


  }

  // "Choose date" → open modal
  if (/^choose\b/i.test(v)) {
    setShowAgreementDateModal(true);
    // park chat in a neutral stage while the modal is open
    setStage('agreementDateModal');
    return;
  }

  // Re-prompt on anything else
  addMsg(setChatLog, 'tima', 'What is the Agreement Date?', ['Today', 'Choose date']);
  return;
}

// ===== Agreement Date — text prompts variant (kept for safety) =====
// If you ever reach 'agreementDate' by typing instead of buttons, keep it simple:
if (stage === 'agreementDate') {
  if (/^today$/i.test(v)) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    setDeal((prev) => ({ ...prev, agreementDate: iso }));
    addMsg(setChatLog, 'tima', `Agreement date set to ${iso}.`);

    const role = (deal?.representing || deal?.party || '').toLowerCase();
    if (role === 'buyer' || role === 'tenant') {
      addMsg(setChatLog, 'tima', 'How many buyers?', ['1', '2']);
      setStage('buyerCount');
    } else {
      addMsg(setChatLog, 'tima', 'How many sellers?', ['1', '2']);
      setStage('sellerCount');
    }
    return;
  }

  if (/^(enter|choose)\s*date$/i.test(v)) {
    setTmpAgreementDate('');
    setShowAgreementDateModal(true);
    return;
  }

  addMsg(setChatLog, 'tima', 'Choose one:', ['Today', 'Enter date']);
  return;
}

    // ===== MLS ID =====
    if (stage === 'mlsId') {
            if (/^upload mls pdf$/i.test(v)) {
        setMlsPdfFile(null);
        setShowMlsUploadModal(true);
        return;
      }

            if (/^skip$/i.test(v)) {
        setDeal((d) => ({ ...d, mlsId: '' }));
        // Continue directly to Address
        addMsg(
          setChatLog,
          'tima',
          'What is the property address?',
          ['Enter address']
        );
        setStage('addressPrompt');
        return;
      }


      const candidate = v.trim();
      const looksLikeMlsId =
        /^[A-Za-z]?\d{6,9}$/i.test(
          candidate
        );

      if (!looksLikeMlsId) {
        addMsg(
          setChatLog,
          'tima',
          'That doesn’t look like an MLS ID. Paste a valid ID, tap "Upload MLS PDF", or type "skip".',
          ['Upload MLS PDF', 'skip']
        );
        return;
      }

      setDeal((d) => ({
        ...d,
        mlsId: candidate,
      }));
            lookupMlsAndPrefill(candidate)
        .then((listing) => {
          if (!listing) return;

          setDeal((d) => {
            const prev = d || {};
            const prevAddr = prev.address || {};
            const la = listing.address || {};

            // Merge address; keep lowercase city synced
            const mergedAddress = listing.address
              ? {
                  ...prevAddr,
                  streetNumber: la.streetNumber || prevAddr.streetNumber || '',
                  streetName:   la.streetName   || prevAddr.streetName   || '',
                  unitNumber:   la.unitNumber   || prevAddr.unitNumber   || '',
                  CityName:     la.CityName     || prevAddr.CityName     || '',
                  city:         la.CityName     || prevAddr.city         || '',
                  province:     la.province     || prevAddr.province     || '',
                  postalCode:   la.postalCode   || prevAddr.postalCode   || '',
                  sideOf:       (la.streetName  || prevAddr.sideOf || '')
                }
              : prevAddr;

            // Sellers (from sellersText) — fill only missing slots
            let mergedSellers = Array.isArray(prev.sellers) ? [...prev.sellers] : [];
            if (listing.sellersText) {
              const parts = String(listing.sellersText)
                .split(/\s*(?:&|and|,)\s*/i)
                .map((s) => s.trim())
                .filter(Boolean);
              if (parts.length) {
                if (!mergedSellers[0] && parts[0]) mergedSellers[0] = parts[0];
                if (!mergedSellers[1] && parts[1]) mergedSellers[1] = parts[1];
                mergedSellers = mergedSellers.filter(Boolean).slice(0, 2);
              }
            }

            // Local helpers
            const normalizePhone = (s) => {
              if (!s) return '';
              const digits = String(s).replace(/[^\d]/g, '');
              if (digits.length === 11 && digits.startsWith('1')) {
                return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
              }
              if (digits.length === 10) {
                return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
              }
              return String(s).trim();
            };
            const normalizeListText = (s) =>
              s ? String(s).replace(/\s+/g, ' ').replace(/\s*;?\s*$/, '').trim() : '';

            // Brokerage & agent (also hydrate brokerages.listing.* used by PDFs)
            const prevListingBr = prev.listingBrokerage || {};
            const prevAgent = prev.listingAgent || {};
            const mergedListingBr = {
              ...prevListingBr,
              name:  listing.brokerageName || prevListingBr.name || '',
              phone: normalizePhone(listing.brokeragePhone || prevListingBr.phone || ''),
              email: prevListingBr.email || ''
            };
            const mergedAgent = {
              ...prevAgent,
              name:  listing.agentName  || prevAgent.name  || '',
              phone: prevAgent.phone || '',
              email: listing.agentEmail || prevAgent.email || ''
            };

            const safeListingName  = (prev.brokerages?.listing?.name  || listing.brokerageName  || '');
            const safeListingPhone = (prev.brokerages?.listing?.phone || normalizePhone(listing.brokeragePhone || prevListingBr.phone || ''));
            const safeListingAgent = (prev.brokerages?.listing?.agent || listing.agentName || '');

            // Legal / inclusions / exclusions / rentals
            const mergedLegal   = listing.legalDescription ? listing.legalDescription : prev.legalDescription;
            const mergedIncl    = listing.inclusions ? normalizeListText(listing.inclusions) : prev.inclusions;
            const mergedExcl    = listing.exclusions ? normalizeListText(listing.exclusions) : prev.exclusions;
            const mergedRentals = listing.rentals ? normalizeListText(listing.rentals) : (prev.leasedItems || prev.rentalItems);

            // *** Do NOT set price from list price ***
            const prevMoney = prev.money || {};
            const mergedMoney = {
              ...prevMoney,
              offerPrice: prevMoney.offerPrice || '',
              offerPriceWords: prevMoney.offerPrice
                ? (prevMoney.offerPriceWords || numberToWords(prevMoney.offerPrice))
                : ''
            };

            return {
              ...prev,
              mlsId: listing.mlsId || prev.mlsId || '',
              address: mergedAddress,
              sellers: mergedSellers,

              // keep your legacy copies if you want them
              listingBrokerage: mergedListingBr,
              listingAgent: mergedAgent,

              // structure the PDFs actually read:
              brokerages: {
                ...(prev.brokerages || {}),
                listing: {
                  ...(prev.brokerages?.listing || {}),
                  name:  safeListingName,
                  phone: safeListingPhone,
                  agent: safeListingAgent,
                },
                buyer: { ...(prev.brokerages?.buyer || {}) },
              },

              legalDescription: mergedLegal || '',
              inclusions: mergedIncl || prev.inclusions || '',
              exclusions: mergedExcl || prev.exclusions || '',
              leasedItems: mergedRentals || prev.leasedItems || '',
              money: mergedMoney
            };
          });

          addMsg(
            setChatLog,
            'tima',
            `Found MLS ${listing.mlsId || ''}. Address and brokerage details added.`
          );
        })
        .catch((e) => {
          console.debug('mls lookup error', (e && e.message) || '');
        });


         {
        // Next → Address (consistent with Upload/Skip branches)
        addMsg(
          setChatLog,
          'tima',
          'What is the property address?',
          ['Enter address']
        );
        setStage('addressPrompt');
      }
      return;
    }

    // ===== Buyers =====
    if (stage === 'buyerCount') {
  const ans = String(v).trim();
  if (ans === '1' || ans === '2') {
    setDeal((d) => ({ ...(d || {}), buyerCount: Number(ans) }));
    addMsg(setChatLog, 'tima', 'Enter Buyer 1 full legal name:');
    setStage('buyer1');
    return;
  }
  // Re-prompt
  addMsg(setChatLog, 'tima', 'How many buyers?', ['1', '2']);
  return;
}


   if (stage === 'buyer1') {
  // Save Buyer 1 full legal name
  setDeal((d) => {
    const arr = [...(d?.buyers || [''])];
    arr[0] = v;
    return { ...(d || {}), buyers: arr };
  });

  // Determine intended buyer count (supports multiple keys; falls back to 1)
  const buyerCount =
    Number(
      String(deal?.buyerCount ?? deal?.buyersCount ?? '1').trim()
    ) || 1;

  if (buyerCount >= 2) {
    // Need Buyer 2 next
    addMsg(setChatLog, 'tima', 'Enter Buyer 2 full legal name:');
    setStage('buyer2');
  } else {
    // Done with buyers; always ask sellers next
    addMsg(setChatLog, 'tima', 'How many sellers?', ['1', '2']);
    setStage('sellerCount');
  }
  return;
}

if (stage === 'buyer2') {
  // Save Buyer 2 full legal name
  setDeal((d) => {
    const arr = [...(d?.buyers || [''])];
    arr[1] = v;
    return { ...(d || {}), buyers: arr };
  });

  // After Buyer 2, always ask sellers
  addMsg(setChatLog, 'tima', 'How many sellers?', ['1', '2']);
  setStage('sellerCount');
  return;
}


    // ===== Sellers =====
    if (stage === 'sellerCount') {
  // If MLS already provided seller names, skip asking count and jump to address
  if (hasSellersFilled(deal)) {
    addMsg(setChatLog, 'tima', 'Sellers already populated from MLS — skipping.');
    setStage('addressPrompt');
    return;
  }

  const ans = String(v).trim();
  if (ans === '1' || ans === '2') {
    setDeal((d) => ({ ...(d || {}), sellerCount: Number(ans) }));
    addMsg(setChatLog, 'tima', 'Enter Seller 1 full legal name:');
    setStage('seller1');
    return;
  }

  // Re-prompt
  addMsg(setChatLog, 'tima', 'How many sellers?', ['1', '2']);
  return;
}

if (stage === 'seller1') {
  // Save Seller 1 full legal name
  setDeal((d) => {
    const arr = [...(d?.sellers || [''])];
    arr[0] = v;
    return { ...(d || {}), sellers: arr };
  });

  // Determine intended seller count (supports multiple keys; falls back to 1)
  const sellerCount =
    Number(String(deal?.sellerCount ?? deal?.sellersCount ?? '1').trim()) || 1;

  if (sellerCount >= 2) {
    // Need Seller 2 next
    addMsg(setChatLog, 'tima', 'Enter Seller 2 full legal name:');
    setStage('seller2');
    return;
  }

  /// Done with sellers — advance to the next missing item (Address → Fronting → Legal → Price → Deposit…)
advanceAfterAddressOrMLS(addMsg, setStage, setChatLog, setDeal, deal);
return;
}

if (stage === 'seller2') {
  // Save Seller 2 full legal name
  setDeal((d) => {
    const arr = [...(d?.sellers || [''])];
    arr[1] = v;
    return { ...(d || {}), sellers: arr };
  });

 // After Seller 2, route to what’s still missing (address → fronting → legal …)
advanceAfterAddressOrMLS(addMsg, setStage, setChatLog, setDeal, deal);
return;

}


    // ===== Address =====
    // Ask for address using the Google Places modal; after save, continue router
if (stage === 'addressPrompt') {
  // If MLS already provided a usable address, skip asking here and continue
  if (hasAddressFilled(deal)) {
    advanceAfterAddressOrMLS(addMsg, setStage, setChatLog, setDeal, deal);
    return;
  }

  // Open the Places modal (restores your old UX)
  setShowAddressModal(true);
  setStage('addressModal'); // park here until user saves/cancels
  return;
}



    if (stage === 'addressLine') {
      const seed =
        v && !/^skip$/i.test(v) ? v : '';
      setAddressSearchVal(seed);
      setShowAddressModal(true);
      return;
    }

    if (stage === 'addressMissing') {
      const bits = v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const prev =
        pendingAddressParts || {};
      const merged = { ...prev };
      if (!prev.streetNumber && bits[0])
        merged.streetNumber = bits[0];
      if (!prev.streetName && bits[1])
        merged.streetName = bits[1];
      if (!prev.city && bits[2])
        merged.city = bits[2];
      if (!prev.province && bits[3])
        merged.province = bits[3].toUpperCase();
      if (!prev.postalCode && bits[4])
        merged.postalCode = normalizePostal(
          bits[4]
        );

      setPendingAddressParts(null);
      setDeal((d) => ({
        ...d,
        address: {
          ...d.address,
          streetNumber:
            merged.streetNumber ||
            d.address.streetNumber,
          streetName:
            merged.streetName ||
            d.address.streetName,
          city:
            merged.city ||
            d.address.city,
          province:
            merged.province ||
            d.address.province,
          postalCode:
            merged.postalCode ||
            d.address.postalCode,
          sideOf:
            merged.streetName ||
            d.address.sideOf,
        },
      }));

      addMsg(
        setChatLog,
        'tima',
        'Is the city name a City, Town, Village, Municipality, or Other?',
        [
          'City',
          'Town',
          'Village',
          'Municipality',
          'Other',
        ]
      );
      setStage('cityQualifier');
      return;
    }

    if (stage === 'cityQualifier') {
  if (/^other$/i.test(v)) {
    addMsg(setChatLog, 'tima', 'Type the qualifier you want (e.g., "Township"):');
    setStage('cityQualifierOther');
    return;
  }

  const choice = /city|town|village|municipality/i.test(v) ? String(v).trim() : '';
  if (!choice) {
    addMsg(setChatLog, 'tima', 'Please choose one:', ['City', 'Town', 'Village', 'Municipality', 'Other']);
    return;
  }

  const label = `${choice} of`;

  // Update deal and continue via the standardized router so we don't re-ask Fronting
  const next = {
    ...deal,
    address: { ...(deal.address || {}), cityQualifier: label },
  };

  setDeal((d) => ({
    ...d,
    address: { ...(d.address || {}), cityQualifier: label },
  }));

  return advanceAfterAddressOrMLS(addMsg, setStage, setChatLog, setDeal, next);
}

if (stage === 'cityQualifierOther') {
  const raw = String(v || '').trim();
  const label = raw ? (/\bof$/i.test(raw) ? raw : `${raw} of`) : '';

  if (!label) {
    addMsg(setChatLog, 'tima', 'Type the qualifier you want (e.g., "Township"):');
    return;
  }

  const next = {
    ...deal,
    address: { ...(deal.address || {}), cityQualifier: label },
  };

  setDeal((d) => ({
    ...d,
    address: { ...(d.address || {}), cityQualifier: label },
  }));

  return advanceAfterAddressOrMLS(addMsg, setStage, setChatLog, setDeal, next);
}

    

    // ===== Fronting On =====
    if (stage === 'fronting') {
      // Accept single letters (N/E/S/W) or full words (North/East/South/West)
      const raw = String(v || '').trim();
      let dir = '';
      if (/^[NESW]$/i.test(raw)) {
        const map = { N: 'North', E: 'East', S: 'South', W: 'West' };
        dir = map[raw[0].toUpperCase()];
      } else if (/north|south|east|west/i.test(raw)) {
        const m = raw.match(/north|south|east|west/i)[0];
        dir = m[0].toUpperCase() + m.slice(1).toLowerCase();
      }

      // Save both nested and top-level for compatibility with router + PDF
      setDeal((d) => ({
        ...d,
        frontingOn: dir, // top-level (for legacy checks/mapping)
        address: {
          ...(d.address || {}),
          frontingOn: dir, // nested (for PDF mapping)
        },
      }));

      // If cityQualifier is missing, ask it now; otherwise continue via router
      const hasQ = !!(deal?.address?.cityQualifier);
      if (!hasQ) {
        addMsg(
          setChatLog,
          'tima',
          'Is the city name a City, Town, Village, Municipality, or Other?',
          ['City', 'Town', 'Village', 'Municipality', 'Other']
        );
        setStage('cityQualifier');
        return;
      }

      // Continue the standardized flow, skipping what’s already filled
      return advanceAfterAddressOrMLS(
        addMsg,
        setStage,
        setChatLog,
        setDeal,
        {
          ...deal,
          frontingOn: dir,
          address: { ...(deal.address || {}), frontingOn: dir },
        }
      );
    }
    // ===== Completion Date (C1) =====
    if (stage === 'completionDateWait') {
      if (/choose date/i.test(v)) {
        setShowCompletionDateModal(true);
        return; 
      }

      // typed fallback (YYYY-MM-DD)
      const val = String(v || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        setDeal((d) => ({ ...d, completionDate: val }));
        return advanceAfterAddressOrMLS(
          addMsg,
          setStage,
          setChatLog,
          setDeal,
          { ...deal, completionDate: val }
        );
      }

      addMsg(setChatLog, 'tima', 'Please type a valid date (YYYY-MM-DD) or tap "Choose Date".', ['Choose Date']);
      return;
    }

      // ===== Typed Schedules (S1) =====
    if (stage === 'schedulesTyped') {
      const raw = String(v || '').toUpperCase();
      const cleaned = raw.replace(/[^A-Z,]/g, '');
      const letters = cleaned
        .split(',')
        .map((s) => s.trim())
        .filter((s) => ['B','C','D','E','F','G'].includes(s));

      const unique = Array.from(new Set(letters));

      setDeal((d) => ({
        ...d,
        schedules: ['A', ...unique],
        schedulesText: unique.join(', ')
      }));

      return advanceAfterAddressOrMLS(
        addMsg,
        setStage,
        setChatLog,
        setDeal,
        { ...deal, schedules: ['A', ...unique], schedulesText: unique.join(', ') }
      );
    }

// ===== Legal description =====
if (stage === 'legalDesc') {
  // If already filled, just continue via router
  if (hasLegalDescription(deal)) {
    return advanceAfterAddressOrMLS(addMsg, setStage, setChatLog, setDeal, deal);
  }

  const text = String(v || '').trim();
  if (!text) {
    addMsg(setChatLog, 'tima', 'What is the legal description of the property?');
    return;
  }

  // Save Legal Description
  setDeal((d) => ({
    ...(d || {}),
    legalDescription: text,
  }));

  // If cityQualifier still missing, try to infer it from the new Legal text
  const hasQ = !!(deal?.address?.cityQualifier);
  if (!hasQ) {
    const inferred = inferCityQualifierFromLegal(text);
    if (inferred) {
      setDeal((d) => ({
        ...(d || {}),
        address: { ...(d?.address || {}), cityQualifier: inferred },
      }));
    }
  }

  // Continue standardized flow
  return advanceAfterAddressOrMLS(
    addMsg,
    setStage,
    setChatLog,
    setDeal,
    {
      ...deal,
      legalDescription: text,
      address: {
        ...(deal.address || {}),
        cityQualifier: hasQ ? deal.address.cityQualifier : (inferCityQualifierFromLegal(text) || deal?.address?.cityQualifier),
      },
    }
  );
}

    // ===== Price & deposit =====
    if (stage === 'offerPrice') {
  const clean = v.replace(/[^\d]/g, '');

  const nextDeal = {
    ...deal,
    money: {
      ...(deal.money || {}),
      offerPrice: clean,
      offerPriceWords: numberToWords(clean),
    },
  };

  setDeal(nextDeal);

  return advanceAfterAddressOrMLS(
    addMsg,
    setStage,
    setChatLog,
    setDeal,
    nextDeal
  );
}


    if (stage === 'deposit') {
  const clean = String(v || '').replace(/[^\d.]/g, '');

  const nextDeal = {
    ...deal,
    money: {
      ...(deal.money || {}),
      deposit: clean,
    },
  };

  setDeal((d) => ({
    ...d,
    money: {
      ...(d.money || {}),
      deposit: clean,
    },
  }));

  return advanceAfterAddressOrMLS(
    addMsg,
    setStage,
    setChatLog,
    setDeal,
    nextDeal
  );
}



 if (stage === 'irrevParty') {
  const who = /seller/i.test(v) ? 'Seller' : 'Buyer'; // default to Buyer on ambiguity

  setDeal((d) => ({
    ...d,
    // legacy + PDF mapping path
    irrev: {
      ...(d.irrev || {}),
      party: who,
    },
    // router path (newer)
    irrevocability: {
      ...(d.irrevocability || {}),
      party: who,
    },
  }));

  // Now ask for the irrevocable DATE with buttons
  addMsg(
    setChatLog,
    'tima',
    'What is the irrevocable date?',
    ['Today', 'Other']
  );
  setStage('irrevDatePicking');
  return;
}
   
if (stage === 'irrevDatePicking') {
  const txt = String(v || '').trim();

  // BUTTON: "Today"
  if (/^today$/i.test(txt)) {
    const dNow = new Date();
    const yyyy = dNow.getFullYear();
    const mm = String(dNow.getMonth() + 1).padStart(2, '0');
    const dd = String(dNow.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;

    // store date for time modal
    setTmpIrrevDate(iso);

    // update deal so router / PDF can see the date immediately
    setDeal((d) => ({
      ...d,
      irrevocability: {
        ...(d.irrevocability || {}),
        date: iso,
      },
    }));

    // skip date picker, go straight to TIME modal
    setShowIrrevTimeModal(true);
    setStage('irrevTimePicking');
    return;
  }

  // BUTTON: "Other" → open date picker, prefilled to today
  if (/^other$/i.test(txt)) {
    const dNow = new Date();
    const yyyy = dNow.getFullYear();
    const mm = String(dNow.getMonth() + 1).padStart(2, '0');
    const dd = String(dNow.getDate()).padStart(2, '0');
    const isoToday = `${yyyy}-${mm}-${dd}`;

    setTmpIrrevDate(isoToday);      // prefill
    setShowIrrevDateModal(true);    // show calendar so they can change it
    // we stay in 'irrevDatePicking' while the modal is open;
    // saveIrrevDate() will move us on to the time step.
    return;
  }

  // Fallback: nudge user to tap a button
  addMsg(
    setChatLog,
    'tima',
    'Please choose "Today" or "Other".',
    ['Today', 'Other']
  );
  return;
}



    // deposit timing after irrev flow will resume in saveIrrevTime()
   if (stage === 'depositTiming') {
  const choice = String(v || '').trim();

  if (
    /^herewith$/i.test(choice) ||
    /^upon acceptance$/i.test(choice) ||
    /^as otherwise described in this agreement$/i.test(choice)
  ) {
    const nextDeal = {
      ...deal,
      money: {
        ...(deal.money || {}),
        depositTiming: choice,
      },
    };

    setDeal((d) => ({
      ...d,
      money: {
        ...(d.money || {}),
        depositTiming: choice,
      },
    }));

    if (stage === 'depositTiming') {
  const choice = String(v || '').trim();

  if (
    /^herewith$/i.test(choice) ||
    /^upon acceptance$/i.test(choice) ||
    /^as otherwise described in this agreement$/i.test(choice)
  ) {
    const nextDeal = {
      ...deal,
      money: {
        ...(deal.money || {}),
        depositTiming: choice,
      },
    };

    setDeal(nextDeal);

    return advanceAfterAddressOrMLS(
      addMsg,
      setStage,
      setChatLog,
      setDeal,
      nextDeal
    );
  }

  addMsg(
    setChatLog,
    'tima',
    'Please choose one:',
    ['Herewith', 'Upon Acceptance', 'As otherwise described in this Agreement']
  );
  return;
}

  }

  addMsg(
    setChatLog,
    'tima',
    'Please choose one:',
    ['Herewith', 'Upon Acceptance', 'As otherwise described in this Agreement']
  );
  return;
}



    if (
      stage === 'depositTimingOther'
    ) {
      setDeal((d) => ({
        ...d,
        money: {
          ...d.money,
          depositTiming: `Other: ${v}`,
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'Who will hold the deposit in trust?',
        [
          'Listing Brokerage',
          'Other',
        ]
      );
      setStage('depositHolder');
      return;
    }
if (stage === 'depositHolder') {
  // Listing Brokerage
  if (/listing brokerage/i.test(v)) {
    const listingName =
      deal?.brokerages?.listing?.name || 'Listing Brokerage';

    const nextDeal = {
      ...deal,
      money: {
        ...(deal.money || {}),
        depositHolder: listingName,
      },
    };

    setDeal(nextDeal);

    return advanceAfterAddressOrMLS(
      addMsg,
      setStage,
      setChatLog,
      setDeal,
      nextDeal
    );
  }

  // "Other" → ask for typed name
  if (/other/i.test(v)) {
    addMsg(
      setChatLog,
      'tima',
      'Type the deposit holder name (e.g., "XYZ Law LLP in Trust").'
    );
    setStage('depositHolderOtherTyped');
    return;
  }

  // Direct typed value
  const nextDeal = {
    ...deal,
    money: {
      ...(deal.money || {}),
      depositHolder: v,
    },
  };

  setDeal(nextDeal);

  return advanceAfterAddressOrMLS(
    addMsg,
    setStage,
    setChatLog,
    setDeal,
    nextDeal
  );
}

if (stage === 'depositHolderOtherTyped') {
  const nextDeal = {
    ...deal,
    money: {
      ...(deal.money || {}),
      depositHolder: v,
    },
  };

  setDeal(nextDeal);

  return advanceAfterAddressOrMLS(
    addMsg,
    setStage,
    setChatLog,
    setDeal,
    nextDeal
  );
}


    if (
      stage ===
      'depositHolderOtherTyped'
    ) {
      setDeal((d) => ({
        ...d,
        money: {
          ...d.money,
          depositHolder: v,
        },
      }));
      addMsg(
  setChatLog,
  'tima',
  'Please choose the Closing / Completion Date:'
);
setStage('completionDate');
setShowCompletionDateModal(true);

      return;
    }

    // Open completion date modal when router sets this stage
if (stage === 'completionDate') {
  setShowCompletionDateModal(true);
  return;
}

if (stage === 'hstChoice') {
  const choice = String(v || '').trim().toLowerCase();
  let hst = '';
  if (/^included/i.test(choice)) hst = 'Included In';
  else if (/^not|^no|^excluded/i.test(choice)) hst = 'Not Included';
  else if (/^included in$/i.test(v)) hst = 'Included In';
  else if (/^not included$/i.test(v)) hst = 'Not Included';

  if (!hst) {
    addMsg(setChatLog, 'tima', 'HST?', ['Not Included', 'Included In']);
    return;
  }

  setDeal((prev) => ({ ...prev, hstChoice: hst }));
  return advanceAfterAddressOrMLS(addMsg, setStage, setChatLog, setDeal, { ...deal, hstChoice: hst });
}
if (stage === 'schedules') {
  // Buttons now come as objects: { label: 'B', selected: true/false }
  // When the user taps a button, v = the label text only.
  const choice = String(v || '').trim().toUpperCase();

  // If nothing valid → just refresh bubble
  if (!choice) {
    showSchedulePicker(Array.from(tmpSchedulesRef.current), true);
    return;
  }

  // Toggle B–G letters
  if (['B', 'C', 'D', 'E', 'F', 'G'].includes(choice)) {
    const s = tmpSchedulesRef.current;
    if (s.has(choice)) s.delete(choice);
    else s.add(choice);

    showSchedulePicker(Array.from(s), true);
    return;
  }

  // Clear
  if (choice === 'CLEAR') {
    tmpSchedulesRef.current.clear();
    showSchedulePicker([], true);
    return;
  }

  // Done → commit schedules & move forward
  if (choice === 'DONE') {
    commitSchedules();
    return;
  }

  // Unknown → refresh picker
  showSchedulePicker(Array.from(tmpSchedulesRef.current), true);
  return;
}





    if (stage === 'frontage') {
      const clean = v.replace(/[^\d.]/g, '');
      setDeal((d) => ({
        ...d,
        sizes: {
          ...(d.sizes || {}),
          frontage: clean,
        },
      }));
      addMsg(setChatLog, 'tima', 'Is the frontage in feet or metres?', ['Feet', 'Metres']);
      setStage('frontageUnit');
      return;
    }
if (stage === 'depth') {
      const clean = String(v || '').replace(/[^\d.]/g, '');

      // Build a "next deal" snapshot for routing
      const nextDeal = {
        ...deal,
        sizes: {
          ...(deal.sizes || {}),
          depth: clean,
        },
      };

      // Persist depth in state
      setDeal((d) => ({
        ...d,
        sizes: {
          ...(d.sizes || {}),
          depth: clean,
        },
      }));

      // Continue the ordered flow (unit is already in sizeUnit from frontageUnit)
      return advanceAfterAddressOrMLS(addMsg, setStage, setChatLog, setDeal, nextDeal);
    }

    if (stage === 'frontageUnit') {
      const unit = /metre/i.test(String(v)) ? 'metres' : 'feet';
      setDeal((d) => ({
        ...d,
        sizes: {
          ...(d.sizes || {}),
          frontageUnit: unit,
          // keep legacy single-unit path in sync for PDF mapping
          sizeUnit: unit,
        },
      }));
      // proceed to depth number entry
            // proceed to depth number entry
      addMsg(setChatLog, 'tima', 'What is the depth of the property?');
      setStage('depth');
      return;
    }

    if (stage === 'depthUnit') {
      const unit = /metre/i.test(String(v)) ? 'metres' : 'feet';
      setDeal((d) => ({
        ...d,
        sizes: {
          ...(d.sizes || {}),
          depthUnit: unit,
          // keep legacy single-unit path in sync for PDF mapping
          sizeUnit: unit,
        },
      }));
      // resume ordered flow after addressing lot units
      return advanceAfterAddressOrMLS(addMsg, setStage, setChatLog, setDeal, deal);
    }

if (stage === 'presentUse') {
  const val = String(v || '').trim();

  // If empty, ask again with buttons
  if (!val) {
    addMsg(setChatLog, 'tima', 'What is the present use of the property?', [
      'Single Family Residential',
      'Condo',
      'Duplex',
      'Residential with Apartment',
      'Other',
    ]);
    return;
  }

  // Save
  setDeal((prev) => ({ ...prev, presentUse: val }));

  // Move directly to Listing Brokerage
  addMsg(setChatLog, 'tima', 'Listing brokerage name:');
  setStage('listingBrokerage');
  return;
}

    // ===== After email / HST / etc. =====
    if (stage === 'sellerAgentEmail') {
      const noticesNow = deal?.notices || {};
      const existingSeller =
        noticesNow.sellerAgentEmail || noticesNow.sellerEmail || '';

      // If already filled (eg. from MLS) and user just presses Enter, skip straight to Buyer email
      if (existingSeller && !String(v || '').trim()) {
        const suggestedBuyerEmail = agentProfile?.agentEmail || '';
        if (suggestedBuyerEmail) {
          addMsg(
            setChatLog,
            'tima',
            `Buyer agent email for delivery of documents? (Press Enter to keep ${suggestedBuyerEmail})`
          );
          setStage('buyerAgentEmailWithDefault');
        } else {
          addMsg(
            setChatLog,
            'tima',
            'Buyer agent notices email?'
          );
          setStage('buyerAgentEmail');
        }
        return;
      }

      // Normal path: save seller notices email, then go to buyer
      setDeal((d) => ({
        ...d,
        notices: {
          ...(d.notices || {}),
          sellerAgentEmail: v,
        },
      }));

      const suggestedBuyerEmail =
        agentProfile?.agentEmail || '';
      if (suggestedBuyerEmail) {
        addMsg(
          setChatLog,
          'tima',
          `Buyer agent email for delivery of documents? (Press Enter to keep ${suggestedBuyerEmail})`
        );
        setStage('buyerAgentEmailWithDefault');
      } else {
        addMsg(
          setChatLog,
          'tima',
          'Buyer agent notices email?'
        );
        setStage('buyerAgentEmail');
      }
      return;
    }

    if (stage === 'buyerAgentEmailWithDefault') {
      const noticesNow = deal?.notices || {};
      const existingBuyer =
        noticesNow.buyerAgentEmail || noticesNow.buyerEmail || '';

      // If already filled and user just presses Enter, skip to inclusions
      if (existingBuyer && !String(v || '').trim()) {
        addMsg(
          setChatLog,
          'tima',
          'What chattels are included?'
        );
        setStage('inclusions');
        return;
      }

      const val =
        v || agentProfile.agentEmail || '';
      setDeal((d) => ({
        ...d,
        notices: {
          ...(d.notices || {}),
          buyerAgentEmail: val,
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'What chattels are included?'
      );
      setStage('inclusions');
      return;
    }

    if (stage === 'buyerAgentEmail') {
      const noticesNow = deal?.notices || {};
      const existingBuyer =
        noticesNow.buyerAgentEmail || noticesNow.buyerEmail || '';

      // If already filled and user just presses Enter, skip to inclusions
      if (existingBuyer && !String(v || '').trim()) {
        addMsg(
          setChatLog,
          'tima',
          'What chattels are included? (Long paragraph is fine.)'
        );
        setStage('inclusions');
        return;
      }

      setDeal((d) => ({
        ...d,
        notices: {
          ...(d.notices || {}),
          buyerAgentEmail: v,
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'What chattels are included? (Long paragraph is fine.)'
      );
      setStage('inclusions');
      return;
    }

    if (stage === 'inclusions') {
      const existing = String(deal?.inclusions || '').trim();

      // If inclusions already set (eg. from MLS) and user just presses Enter, skip to exclusions
      if (existing && !String(v || '').trim()) {
        addMsg(
          setChatLog,
          'tima',
          'Add exclusions?',
          ['Add exclusions', 'NONE']
        );
        setStage('exclusionsStart');
        return;
      }

      setDeal((d) => ({
        ...d,
        inclusions: v,
      }));
      addMsg(
        setChatLog,
        'tima',
        'Add exclusions?',
        ['Add exclusions', 'NONE']
      );
      setStage('exclusionsStart');
      return;
    }

    if (stage === 'exclusionsStart') {
      const existing =
        typeof deal?.exclusions === 'string'
          ? deal.exclusions.trim()
          : '';

      // If exclusions already set (eg. MLS filled) and user just presses Enter, skip to rentals
      if (existing && !String(v || '').trim()) {
        addMsg(
          setChatLog,
          'tima',
          'Select rental/lease-to-own items the Buyer will assume (tap items, then "Done").',
          [
            'Hot water tank',
            'Furnace',
            'Air Conditioner',
            'Other',
            'None',
            'Done',
          ]
        );
        setPendingRentals([]);
        setStage('rentals');
        return;
      }

      if (/^none$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          exclusions: 'None',
        }));
        addMsg(
          setChatLog,
          'tima',
          'Select rental/lease-to-own items the Buyer will assume (tap all items that apply, then select "Done").',
          [
            'Hot water tank',
            'Furnace',
            'Air Conditioner',
            'Other',
            'None',
            'Done',
          ]
        );
        setPendingRentals([]);
        setStage('rentals');
        return;
      }
      if (/^add exclusions$/i.test(v)) {
        addMsg(
          setChatLog,
          'tima',
          'Type exclusions (fixtures excluded).'
        );
        setStage('exclusionsText');
        return;
      }
      setDeal((d) => ({
        ...d,
        exclusions: v,
      }));
      addMsg(
        setChatLog,
        'tima',
        'Select rental/lease-to-own items the Buyer will assume (tap items, then "Done").',
        [
          'Hot water tank',
          'Furnace',
          'Air Conditioner',
          'Other',
          'None',
          'Done',
        ]
      );
      setPendingRentals([]);
      setStage('rentals');
      return;
    }

    if (stage === 'exclusionsText') {
      const existing =
        typeof deal?.exclusions === 'string'
          ? deal.exclusions.trim()
          : '';

      // If exclusions already set and user just presses Enter, skip to rentals
      if (existing && !String(v || '').trim()) {
        addMsg(
          setChatLog,
          'tima',
          'Select rental/lease-to-own items the Buyer will assume (tap items, then "Done").',
          [
            'Hot water tank',
            'Furnace',
            'Air Conditioner',
            'Other',
            'None',
            'Done',
          ]
        );
        setPendingRentals([]);
        setStage('rentals');
        return;
      }

      setDeal((d) => ({
        ...d,
        exclusions: v,
      }));
      addMsg(
        setChatLog,
        'tima',
        'Select rental/lease-to-own items the Buyer will assume (tap items, then "Done").',
        [
          'Hot water tank',
          'Furnace',
          'Air Conditioner',
          'Other',
          'None',
          'Done',
        ]
      );
      setPendingRentals([]);
      setStage('rentals');
      return;
    }

    if (stage === 'rentals') {
      const existingRentals = String(
        deal?.rentalItems || deal?.leasedItems || ''
      ).trim();

      // If rentals already set and user just presses Enter, skip to HST
      if (existingRentals && !String(v || '').trim()) {
        addMsg(
          setChatLog,
          'tima',
          'HST?',
          ['Not Included', 'Included In']
        );
        setStage('hst');
        return;
      }

      if (/^done$/i.test(v)) {
        const list = pendingRentals.length
          ? pendingRentals.join(', ')
          : '';
        setDeal((d) => ({
          ...d,
          rentalItems: list || d.rentalItems || '',
        }));
        addMsg(
          setChatLog,
          'tima',
          'HST?',
          ['Not Included', 'Included In']
        );
        setStage('hst');
        return;
      }
      if (/^none$/i.test(v)) {
        setPendingRentals([]);
        setDeal((d) => ({
          ...d,
          rentalItems: 'None',
        }));
        addMsg(
          setChatLog,
          'tima',
          'HST?',
          ['Not Included', 'Included In']
        );
        setStage('hst');
        return;
      }
      if (/^other$/i.test(v)) {
        addMsg(
          setChatLog,
          'tima',
          'Type the other rental item:'
        );
        setStage('rentalsOther');
        return;
      }
      {
        const allowed = [
          'Hot water tank',
          'Furnace',
          'Air Conditioner',
        ];
        if (allowed.includes(v)) {
          setPendingRentals((prev) =>
            prev.includes(v) ? prev : [...prev, v]
          );
          addMsg(
            setChatLog,
            'tima',
            `Added "${v}". Tap more or "Done".`,
            [
              'Hot water tank',
              'Furnace',
              'Air Conditioner',
              'Other',
              'None',
              'Done',
            ]
          );
          return;
        }
      }
      addMsg(
        setChatLog,
        'tima',
        'Tap items, then "Done".',
        [
          'Hot water tank',
          'Furnace',
          'Air Conditioner',
          'Other',
          'None',
          'Done',
        ]
      );
      return;
    }

    if (stage === 'rentalsOther') {
      setPendingRentals((prev) =>
        prev.includes(v) ? prev : [...prev, v]
      );
      addMsg(
        setChatLog,
        'tima',
        `Added "${v}". Tap more or "Done".`,
        [
          'Hot water tank',
          'Furnace',
          'Air Conditioner',
          'Other',
          'None',
          'Done',
        ]
      );
      setStage('rentals');
      return;
    }

    // ===== HST =====
    if (stage === 'hst') {
      const existingHst = String(deal?.hstChoice || '').trim();

      // If HST already chosen (eg. from MLS) and user just presses Enter, jump to Title Search date
      if (existingHst && !String(v || '').trim()) {
        setTmpTitleDate('');
        setShowTitleDateModal(true);
        setStage('titleDatePicking');
        return;
      }

      if (/^not included$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          hstMode: 'not-included',
          hstChoice: 'Not Included',
        }));
      } else if (/^included in$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          hstMode: 'inc',
          hstChoice: 'Included In',
        }));
      } else {
        addMsg(
          setChatLog,
          'tima',
          'Please choose one:',
          ['Not Included', 'Included In']
        );
        return;
      }

      // open Title Search date modal next
      setTmpTitleDate('');
      setShowTitleDateModal(true);
      setStage('titleDatePicking');
      return;
    }

    // ===== Listing Brokerage =====
    if (stage === 'listingBrokerage') {
      const listing = deal.brokerages.listing || {};
      const hasName = !!listing.name;
      const hasPhone = !!listing.phone;
      const hasAgent = !!listing.agent;

      // If ALL listing brokerage fields are already filled and user just presses Enter,
      // skip straight to Buyer Brokerage confirm.
      if (hasName && hasPhone && hasAgent && !String(v || '').trim()) {
        const bbName = agentProfile?.brokerageName || '';
        const bbPhone = agentProfile?.brokeragePhone || '';
        const baName = agentProfile?.agentFullName || '';
        addMsg(
          setChatLog,
          'tima',
          `Use your profile for buyer brokerage?\nName: ${bbName || '(none)'}\nPhone: ${bbPhone || '(none)'}\nAgent: ${baName || '(none)'}\n`,
          ['Yes, use profile', 'Edit']
        );
        setStage('buyerBrokerageConfirm');
        return;
      }

      if (!listing.name) {
        setDeal((d) => ({
          ...d,
          brokerages: {
            ...d.brokerages,
            listing: {
              ...d.brokerages.listing,
              name: v,
            },
          },
        }));
        addMsg(
          setChatLog,
          'tima',
          'Listing brokerage phone:'
        );
        return;
      }
      if (!listing.phone) {
        setDeal((d) => ({
          ...d,
          brokerages: {
            ...d.brokerages,
            listing: {
              ...d.brokerages.listing,
              phone: v,
            },
          },
        }));
        addMsg(
          setChatLog,
          'tima',
          'Listing salesperson/agent name:'
        );
        return;
      }
      if (!listing.agent) {
        setDeal((d) => ({
          ...d,
          brokerages: {
            ...d.brokerages,
            listing: {
              ...d.brokerages.listing,
              agent: v,
            },
          },
        }));
      } else {
        setDeal((d) => ({
          ...d,
          brokerages: {
            ...d.brokerages,
            listing: {
              ...d.brokerages.listing,
              agent: v,
            },
          },
        }));
      }

      const bbName =
        agentProfile?.brokerageName || '';
      const bbPhone =
        agentProfile?.brokeragePhone || '';
      const baName =
        agentProfile?.agentFullName || '';
      addMsg(
        setChatLog,
        'tima',
        `Use your profile for buyer brokerage?\nName: ${bbName || '(none)'}\nPhone: ${bbPhone || '(none)'}\nAgent: ${baName || '(none)'}\n`,
        ['Yes, use profile', 'Edit']
      );
      setStage('buyerBrokerageConfirm');
      return;
    }

    // ===== Buyer Brokerage confirm / edit =====
    if (
      stage ===
      'buyerBrokerageConfirm'
    ) {
      if (/^yes/i.test(v)) {
        setDeal((d) => ({
          ...d,
          brokerages: {
            ...d.brokerages,
            buyer: {
              ...d.brokerages.buyer,
              name:
                agentProfile?.brokerageName ||
                d.brokerages
                  .buyer
                  .name,
              phone:
                agentProfile?.brokeragePhone ||
                d.brokerages
                  .buyer
                  .phone,
              agent:
                agentProfile?.agentFullName ||
                d.brokerages
                  .buyer
                  .agent,
            },
          },
        }));
        addMsg(
          setChatLog,
          'tima',
          'Do you want to add Buyer/Seller lawyer details now?',
          ['Yes', 'Skip']
        );
        setStage(
          'lawyersYN'
        );
        return;
      }
      if (/^edit$/i.test(v)) {
        addMsg(
          setChatLog,
          'tima',
          'Buyer brokerage name:'
        );
        setStage(
          'buyerBrokerageEditName'
        );
        return;
      }
      addMsg(
        setChatLog,
        'tima',
        'Please choose one:',
        [
          'Yes, use profile',
          'Edit',
        ]
      );
      return;
    }

    if (
      stage ===
      'buyerBrokerageEditName'
    ) {
      setDeal((d) => ({
        ...d,
        brokerages: {
          ...d.brokerages,
          buyer: {
            ...d.brokerages.buyer,
            name: v,
          },
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'Buyer brokerage phone:'
      );
      setStage(
        'buyerBrokerageEditPhone'
      );
      return;
    }

    if (
      stage ===
      'buyerBrokerageEditPhone'
    ) {
      setDeal((d) => ({
        ...d,
        brokerages: {
          ...d.brokerages,
          buyer: {
            ...d.brokerages.buyer,
            phone: v,
          },
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'Buyer salesperson/agent name:'
      );
      setStage(
        'buyerBrokerageEditAgent'
      );
      return;
    }

    if (
      stage ===
      'buyerBrokerageEditAgent'
    ) {
      setDeal((d) => ({
        ...d,
        brokerages: {
          ...d.brokerages,
          buyer: {
            ...d.brokerages.buyer,
            agent: v,
          },
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'Do you want to add Buyer/Seller lawyer details now?',
        ['Yes', 'Skip']
      );
      setStage(
        'lawyersYN'
      );
      return;
    }

    // ===== Lawyers? =====
    if (stage === 'lawyersYN') {
      if (/^yes$/i.test(v)) {
        addMsg(
          setChatLog,
          'tima',
          'Seller’s lawyer name (or type "Skip")'
        );
        setStage(
          'sellerLawyerName'
        );
        return;
      }
      addMsg(
        setChatLog,
        'tima',
        'Add buyer address for service & phone?',
        ['Add', 'Skip']
      );
      setStage(
        'buyerServiceYN'
      );
      return;
    }

    // ---- Seller Lawyer series
    if (
      stage ===
      'sellerLawyerName'
    ) {
      if (!/^skip$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          lawyers: {
            ...d.lawyers,
            seller: {
              ...d.lawyers.seller,
              name: v,
            },
          },
        }));
      }
      addMsg(
        setChatLog,
        'tima',
        'Seller lawyer address (or "Skip")'
      );
      setStage(
        'sellerLawyerAddr'
      );
      return;
    }

    if (
      stage ===
      'sellerLawyerAddr'
    ) {
      if (!/^skip$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          lawyers: {
            ...d.lawyers,
            seller: {
              ...d.lawyers.seller,
              addr: v,
            },
          },
        }));
      }
      addMsg(
        setChatLog,
        'tima',
        'Seller lawyer email (or "Skip")'
      );
      setStage(
        'sellerLawyerEmail'
      );
      return;
    }

    if (
      stage ===
      'sellerLawyerEmail'
    ) {
      if (!/^skip$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          lawyers: {
            ...d.lawyers,
            seller: {
              ...d.lawyers.seller,
              email: v,
            },
          },
        }));
      }
      addMsg(
        setChatLog,
        'tima',
        'Seller lawyer phone (or "Skip")'
      );
      setStage(
        'sellerLawyerPhone'
      );
      return;
    }

    if (
      stage ===
      'sellerLawyerPhone'
    ) {
      if (!/^skip$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          lawyers: {
            ...d.lawyers,
            seller: {
              ...d.lawyers.seller,
              phone: v,
            },
          },
        }));
      }
      addMsg(
        setChatLog,
        'tima',
        'Seller lawyer fax (or "Skip")'
      );
      setStage(
        'sellerLawyerFax'
      );
      return;
    }

    if (
      stage ===
      'sellerLawyerFax'
    ) {
      if (!/^skip$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          lawyers: {
            ...d.lawyers,
            seller: {
              ...d.lawyers.seller,
              fax: v,
            },
          },
        }));
      }
      addMsg(
        setChatLog,
        'tima',
        'Buyer’s lawyer name (or "Skip")'
      );
      setStage(
        'buyerLawyerName'
      );
      return;
    }

    // ---- Buyer Lawyer series
    if (
      stage ===
      'buyerLawyerName'
    ) {
      if (!/^skip$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          lawyers: {
            ...d.lawyers,
            buyer: {
              ...d.lawyers.buyer,
              name: v,
            },
          },
        }));
      }
      addMsg(
        setChatLog,
        'tima',
        'Buyer lawyer address (or "Skip")'
      );
      setStage(
        'buyerLawyerAddr'
      );
      return;
    }

    if (
      stage ===
      'buyerLawyerAddr'
    ) {
      if (!/^skip$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          lawyers: {
            ...d.lawyers,
            buyer: {
              ...d.lawyers.buyer,
              addr: v,
            },
          },
        }));
      }
      addMsg(
        setChatLog,
        'tima',
        'Buyer lawyer email (or "Skip")'
      );
      setStage(
        'buyerLawyerEmail'
      );
      return;
    }

    if (
      stage ===
      'buyerLawyerEmail'
    ) {
      if (!/^skip$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          lawyers: {
            ...d.lawyers,
            buyer: {
              ...d.lawyers.buyer,
              email: v,
            },
          },
        }));
      }
      addMsg(
        setChatLog,
        'tima',
        'Buyer lawyer phone (or "Skip")'
      );
      setStage(
        'buyerLawyerPhone'
      );
      return;
    }

    if (
      stage ===
      'buyerLawyerPhone'
    ) {
      if (!/^skip$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          lawyers: {
            ...d.lawyers,
            buyer: {
              ...d.lawyers.buyer,
              phone: v,
            },
          },
        }));
      }
      addMsg(
        setChatLog,
        'tima',
        'Buyer lawyer fax (or "Skip")'
      );
      setStage(
        'buyerLawyerFax'
      );
      return;
    }

    if (
      stage ===
      'buyerLawyerFax'
    ) {
      if (!/^skip$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          lawyers: {
            ...d.lawyers,
            buyer: {
              ...d.lawyers.buyer,
              fax: v,
            },
          },
        }));
      }
      addMsg(
        setChatLog,
        'tima',
        'Add buyer address for service & phone?',
        ['Add', 'Skip']
      );
      setStage(
        'buyerServiceYN'
      );
      return;
    }

   // ===== Buyer Service =====
if (stage === 'buyerServiceYN') {
  if (/^add$/i.test(v)) {
    addMsg(setChatLog, 'tima', 'Buyer mailing address for service (one line):');
    setStage('buyerServiceAddress');
    return;
  }

  // Skip → finalize forms now
  addMsg(setChatLog, 'tima', 'All set! You can switch between the forms above to edit.');

  const formsToAdd = [];
  // Always include Offer Summary
  formsToAdd.push('Form 801 – Offer Summary Document');
  // Purchase agreement based on property type
  formsToAdd.push(
    deal.propertyType === 'Condo'
      ? 'Form 101 – Agreement of Purchase and Sale – Condominium'
      : 'Form 100 – Agreement of Purchase and Sale – Residential'
  );
  // Representation doc
  if (deal.representationType === 'Designated') {
    formsToAdd.push('Form 371 – Buyer Designated Representation Agreement');
  } else if (deal.representationType === 'Client') {
    formsToAdd.push('Form 300 – Buyer Representation Agreement (Client)');
  }

  formsToAdd.forEach((f) => ensureFormInList(f));
   setStage('done');
  return;
}

if (stage === 'buyerServiceAddress') {
  setDeal((d) => ({
    ...d,
    service: { ...(d.service || {}), buyerAddress: v },
  }));
  addMsg(setChatLog, 'tima', 'Buyer phone (or "Skip"):');
  setStage('buyerServicePhone');
  return;
}

if (stage === 'buyerServicePhone') {
  if (!/^skip$/i.test(v)) {
    setDeal((d) => ({ ...d, service: { ...(d.service || {}), buyerPhone: v } }));
  }

  addMsg(setChatLog, 'tima', 'All set! You can switch forms above; they’ll stay in sync. Add or remove forms anytime.');

  const formsToAdd = [];
  formsToAdd.push('Form 801 – Offer Summary Document');
  formsToAdd.push(
    deal.propertyType === 'Condo'
      ? 'Form 101 – Agreement of Purchase and Sale – Condominium'
      : 'Form 100 – Agreement of Purchase and Sale – Residential'
  );
  if (deal.representationType === 'Designated') {
    formsToAdd.push('Form 371 – Buyer Designated Representation Agreement');
  } else if (deal.representationType === 'Client') {
    formsToAdd.push('Form 300 – Buyer Representation Agreement (Client)');
  }

  formsToAdd.forEach((f) => ensureFormInList(f));
  setSelectedForm('Form 801 – Offer Summary Document');
  setStage('done');
  return;
}


// ===== Fallback =====
addMsg(
  setChatLog,
  'tima',
  'Got it. Keep going—or use the form chips above to switch, add, or remove.'
);
return;
}; // ← END handleUserInput


  // =========================
  // SIMPLE MODAL HANDLERS
  // =========================

// Irrevocable date/time modal flow
const saveIrrevDate = () => {
  if (!tmpIrrevDate) return;

  // Close the date modal and immediately open the time modal
  setShowIrrevDateModal(false);
  setShowIrrevTimeModal(true);

  // Also make sure the chosen date is pushed into the deal
  setDeal((d) => ({
    ...d,
    irrevocability: {
      ...(d.irrevocability || {}),
      date: tmpIrrevDate,
    },
  }));

  // When they save the date from the calendar, we move on to picking time
  setStage('irrevTimePicking');
};

const saveIrrevTime = () => {
  if (!tmpIrrevDate || !tmpIrrevTime) return;

  const iso = toISODateTime(tmpIrrevDate, tmpIrrevTime || '00:00');

  // Save into deal
  setDeal((d) => ({
    ...d,
    // legacy + PDF mapping path
    irrev: {
      ...(d.irrev || {}),
      onISO: iso,
      until: to12h(tmpIrrevTime || '00:00'),
    },
    // router path (newer)
    irrevocability: {
      ...(d.irrevocability || {}),
      date: tmpIrrevDate,              // yyyy-mm-dd
      time: tmpIrrevTime || '00:00',   // HH:mm
    },
  }));

  // Close the time modal now that we've saved it
  setShowIrrevTimeModal(false);

  // Build snapshot for router
  const nextDeal = {
    ...deal,
    irrevocability: {
      ...(deal.irrevocability || {}),
      date: tmpIrrevDate,
      time: tmpIrrevTime || '00:00',
    },
  };

  // Continue ordered flow
  return advanceAfterAddressOrMLS(
    addMsg,
    setStage,
    setChatLog,
    setDeal,
    nextDeal
  );
};const saveCompletionDate = () => {
  if (!tmpCompletionDate) return;

  // Build the next deal with the chosen completion date
  const nextDeal = {
    ...deal,
    completionDate: tmpCompletionDate,
  };

  // Save it
  setDeal(nextDeal);

  // Close the modal
  setShowCompletionDateModal(false);

  // Confirm to the user
  addMsg(
    setChatLog,
    'tima',
    `Completion / Closing Date set to ${tmpCompletionDate}.`
  );

  // Move directly to Seller agent notices email
  addMsg(
    setChatLog,
    'tima',
    'Seller agent notices email?'
  );
  setStage('sellerAgentEmail');
  return;
};


  // Title Search (Requisition) date modal
  const saveTitleDate = () => {
    if (!tmpTitleDate) return;
    setDeal((d) => ({
      ...d,
      titleSearchDate:
        tmpTitleDate,
    }));
    setShowTitleDateModal(false);

        // Ask Present Use next (required before Listing Brokerage)
    addMsg(
      setChatLog,
      'tima',
      'What is the present use of the property?',
      [
        'Single Family Residential',
        'Condo',
        'Duplex',
        'Residential with Apartment',
        'Commercial',
        'Other'
      ]
    );
    setStage('presentUse');

  };

 // Start Offer from home tiles
const startOfferFromTiles = () => {
  setMode('forms');
  setStage('intent');       // no forms yet
  setActiveForms([]);       // keep right pane blank
  setSelectedForm('');      // nothing selected
};

// show right-side UI as soon as we have forms (immediately after Property Type) 
const showFormUI = activeForms.length > 0 && stage !== 'intent';
const showRightPane = showFormUI;


// ---- pick the APS that matches the user's property type hint (handles 100/101/102/...) ----
function pickPreferredAPSName(forms, hint) {
  if (!Array.isArray(forms) || forms.length === 0) return '';

  // Normalize once
  const L = forms.map((n) => String(n || '').toLowerCase());

  // Generic APS detector
  const isAPS = (s) =>
    /agreement\s+of\s+purchase\s+and\s+sale|form\s*10\d\b/.test(s);

  // Map hint -> regex that prefers the correct APS variant
  const hintToRegex = {
    freehold: /(form\s*100\b|freehold)/,
    potl: /(form\s*100\b|freehold|potl)/,
    condo: /(form\s*101\b|condo|condominium)/,
    'co-op': /(form\s*102\b|co-?op)/,
    mobile: /(form\s*103\b|mobile)/,
    leasehold: /(leasehold|form\s*10\d\b)/,
  };

  // 1) Try to find APS that matches the hint’s regex
  if (hint && hintToRegex[hint]) {
    const idx = L.findIndex((s) => isAPS(s) && hintToRegex[hint].test(s));
    if (idx >= 0) return forms[idx];
  }

  // 2) Otherwise, prefer any APS at all
  const apsIdx = L.findIndex((s) => isAPS(s));
  if (apsIdx >= 0) return forms[apsIdx];

  // 3) Fallback to first
  return forms[0];
}

// ---- reorder activeForms to put preferred APS first, and ensure it is selected ----
useEffect(() => {
  if (activeForms.length === 0) return;

  // Determine preferred APS by hint
  const target = pickPreferredAPSName(activeForms, preferredFormHint);

  // Reorder list so preferred APS is first
  setActiveForms((arr) => {
    const uniq = Array.from(new Set(arr));
    const rest = uniq.filter((n) => n !== target);
    return target ? [target, ...rest] : uniq;
  });

  // Select it if not already selected
  if (target && selectedForm !== target) {
    setSelectedForm(target);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeForms, preferredFormHint]);

// ---- ensure representation form appears as soon as the choice is made ----
useEffect(() => {
  const t = deal && deal.representationType ? String(deal.representationType) : '';
  if (!t) return;
  if (/^designated$/i.test(t)) {
    ensureFormInList('Form 371 – Buyer Designated Representation Agreement');
  } else if (/^client$/i.test(t)) {
    ensureFormInList('Form 300 – Buyer Representation Agreement (Client)');
  }
  // we do NOT change selectedForm here (APS stays first via your other effect)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [deal.representationType]);

// ---- Forms list helpers (delete + add more) ---------------------------------
function removeFormFromList(name) {
  setActiveForms((arr) => {
    const next = arr.filter((n) => n !== name);
    // if we deleted the selected form, pick the first remaining
    if (selectedForm === name) {
      const nextSelected = next[0] || '';
      if (nextSelected !== selectedForm) setSelectedForm(nextSelected);
    }
    return next;
  });
}

function openFormsPicker() {
  // initialize the picker set with currently active forms (for convenient toggling)
  setFormsPickerSet(new Set(activeForms));
  setShowFormsPicker(true);
}

function toggleFormInPicker(name) {
  setFormsPickerSet((prev) => {
    const s = new Set(prev);
    if (s.has(name)) s.delete(name);
    else s.add(name);
    return s;
  });
}

function commitFormsPicker() {
  const chosen = Array.from(formsPickerSet);
  // ensure stable order: keep existing, then add new that weren't present
  setActiveForms((existing) => {
    const existingSet = new Set(existing);
    const added = chosen.filter((n) => !existingSet.has(n));
    const kept = existing.filter((n) => chosen.includes(n));
    const next = [...kept, ...added];
    // keep current selection if still present; otherwise pick first
    const sel = next.includes(selectedForm) ? selectedForm : (next[0] || '');
    if (sel !== selectedForm) setSelectedForm(sel);
    return next;
  });
  setShowFormsPicker(false);
}

// ---- Helpers to add/remove/select forms by regex ---------------------------------
function ensureFormByRegex(rx) {
  try {
    const names = Object.keys(FORM_FILE || {});
    const found = names.find((n) => rx.test(String(n)));
    if (!found) return '';
    ensureFormInList(found);
    return found;
  } catch {
    return '';
  }
}

function removeFormByRegex(rx) {
  setActiveForms((arr) => {
    const next = arr.filter((n) => !rx.test(String(n)));
    if (selectedForm && rx.test(String(selectedForm))) {
      const nextSelected = next[0] || '';
      if (nextSelected !== selectedForm) setSelectedForm(nextSelected);
    }
    return next;
  });
}

function preferAndSelect(name) {
  if (!name) return;
  setActiveForms((arr) => {
    const uniq = Array.from(new Set([name, ...arr.filter((n) => n !== name)]));
    return uniq;
  });
  if (selectedForm !== name) setSelectedForm(name);
}


// Compute available list from your FORM_FILE keys (what you actually have on disk)
const ALL_FORM_NAMES = Object.keys(FORM_FILE || {});
const AVAILABLE_FORMS = ALL_FORM_NAMES; // if you want to filter later, do it here


// ---- DEV: Audit PDF field bindings (safe, optional) ----
function auditPdfBindings() {
  try {
    const dev =
      (typeof window !== 'undefined' && (window.timaDev || window.TIMA || window)) || {};
    const out = {};

    // Try known debug hooks if present
    if (typeof dev.listFields === 'function') {
      out.fields = dev.listFields();
    }
    if (typeof dev.scan === 'function') {
      out.scan = dev.scan();
    }
    if (typeof dev.dumpOverlay === 'function') {
      out.overlay = dev.dumpOverlay();
    }

    // Snapshot of current deal and counts (shallow)
    try {
      out.deal = {
        ...(deal || {}),
        chatCount: Array.isArray(chatLog) ? chatLog.length : undefined,
        activeFormsCount: Array.isArray(activeForms) ? activeForms.length : undefined,
      };
    } catch (_e) { /* ignore */ }

    // Nudge a re-apply so overlay exposes last-bind info if available
    if (typeof window !== 'undefined' && typeof window.TIMA_forceApply === 'function') {
      try { window.TIMA_forceApply(); } catch (_e) { /* ignore */ }
    }

    // eslint-disable-next-line no-console
    console.groupCollapsed('%cTIMA Audit: PDF field bindings', 'font-weight:bold');
    // eslint-disable-next-line no-console
    console.log(out);
    // eslint-disable-next-line no-console
    console.groupEnd();

    addMsg(setChatLog, 'tima', 'Audit complete. See console for details.');
  } catch (_err) {
    addMsg(setChatLog, 'tima', 'Audit ran, but no dev hooks were found. Open the console to verify.');
  }
}
// ---- FORM HELPERS: find/add/remove by regex (label-agnostic) ----
function findFormByRegex(re) {
  try {
    if (!re) return '';
    const arr = Array.isArray(AVAILABLE_FORMS) ? AVAILABLE_FORMS : [];
    const hit = arr.find((n) => re.test(String(n || '')));
    return hit || '';
  } catch (_e) { return ''; }
}

function ensureFormByRegex(re) {
  const hit = findFormByRegex(re);
  if (!hit) return '';
  ensureFormInList(hit);
  return hit;
}

function removeFormByRegex(re) {
  try {
    setActiveForms((arr) => arr.filter((n) => !re.test(String(n || ''))));
  } catch (_e) { /* ignore */ }
}

function preferAndSelect(name) {
  if (!name) return;
  setActiveForms((arr) => {
    const uniq = Array.from(new Set(arr.concat(name)));
    const rest = uniq.filter((x) => x !== name);
    return [name, ...rest];
  });
  if (selectedForm !== name) setSelectedForm(name);
}


// =========================
// RENDER
// =========================
return (
  <div className="app h-screen overflow-hidden flex flex-col">
    {/* NOTE: Removed dev/debug toolbar per request */}

    {/* Main content */}
    {mode === 'home' ? (
      <div className="p-6">
        <HomeTiles
          onSelect={(key) => {
            if (key === 'listing') startOfferFromTiles();
            if (key === 'pipeline') {
              addMsg(
                setChatLog,
                'tima',
                'Pipeline features coming soon. Start an offer to continue.',
                ['Start an offer'],
              );
              setStage('intent');
              setMode('forms');
            }
            if (key === 'chat') {
              addMsg(setChatLog, 'tima', 'Voice and chat sessions coming soon.');
            }
            if (key === 'concierge') {
              addMsg(setChatLog, 'tima', 'Concierge services launching soon!');
            }
          }}
        />
      </div>
    ) : (
      /* Content row: Left (Chat 1/3) + Right (Forms 2/3) */
      <div className="flex min-w-0 min-h-0 flex-1 h-[calc(100vh-0px)] flex-col lg:flex-row">
        {/* Mobile toggle (small screens only) */}
<div className="lg:hidden sticky top-0 z-10 bg-white border-b">
  <div className="flex">
    <button
      type="button"
      className={`flex-1 px-3 py-2 text-sm ${mobilePane === 'chat' ? 'font-semibold border-b-2 border-blue-600' : ''}`}
      onClick={() => setMobilePane('chat')}
    >
      Chat
    </button>
    <button
      type="button"
      className={`flex-1 px-3 py-2 text-sm ${mobilePane === 'pdf' ? 'font-semibold border-b-2 border-blue-600' : ''}`}
      onClick={() => setMobilePane('pdf')}
    >
      Forms/PDF
    </button>
  </div>
</div>

        {/* Left: Chat (1/3 on lg) */}
        <div className={`min-w-0 min-h-0 flex flex-col relative z-20 w-full lg:w-1/3 ${mobilePane === 'chat' ? '' : 'hidden lg:flex'}`}>
          <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-auto p-4 space-y-2">
            {chatLog.map((m, i) => (
              <div
                key={i}
                className={`rounded px-3 py-2 ${m.sender === 'user' ? 'bg-blue-50' : 'bg-gray-50'}`}
              >
                <div className="text-xs opacity-60 mb-1">{m.sender}</div>
                <div className="whitespace-pre-wrap break-words">{m.text}</div>

                {Array.isArray(m.buttons) && m.buttons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.buttons.map((b, j) => (
                      <button
                        key={j}
                        className="text-sm border px-2 py-1 rounded"
                        onClick={() => handleUserInput(b)}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input row + voice */}
          <div className="p-3 border-t flex items-center gap-2">
            <input
              ref={chatInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUserInput(input);
              }}
              className="flex-1 border rounded px-3 py-2"
              placeholder="Type and press Enter…"
            />
            <button className="border rounded px-3 py-2" onClick={() => handleUserInput(input)}>
              Send
            </button>
            <VoiceControls onFinalText={(txt) => handleUserInput(txt)} />
          </div>
        </div>

        {/* Right: PDF Preview (2/3 on lg) */}
<div className={`min-w-0 border-l flex flex-col relative z-0 w-full lg:w-2/3 ${mobilePane === 'pdf' ? '' : 'hidden lg:flex'}`}>
  {/* Flex column so header stays tiny and PDF takes the rest */}
  <div className="flex flex-col min-h-0 flex-1">
    {/* Compact header */}
    <div className="shrink-0 sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
      <div className="flex items-center gap-1 px-2 py-1 overflow-x-auto">
        {activeForms.map((name) => (
          <div
            key={name}
            className={`flex items-center border rounded text-xs ${
              selectedForm === name ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'
            }`}
            title={name}
          >
            <button
              type="button"
              className="px-2 py-1 truncate max-w-[160px] text-left"
              onClick={() => {
                setSelectedForm(name);
                setTimeout(() => {
                  if (typeof window !== 'undefined' && typeof window.TIMA_forceApply === 'function') {
                    try { window.TIMA_forceApply(); } catch (_e) { /* ignore */ }
                  }
                }, 0);
              }}
            >
              {name}
            </button>
            {/* Delete (×) */}
            <button
              type="button"
              className="px-1 py-1 text-gray-500 hover:text-red-600"
              aria-label={`Remove ${name}`}
              title="Remove"
              onClick={() => {
                setActiveForms((arr) => {
                  const next = arr.filter((n) => n !== name);
                  if (selectedForm === name) {
                    const nextSel = next[0] || '';
                    if (nextSel !== selectedForm) setSelectedForm(nextSel);
                  }
                  return next;
                });
              }}
            >
              ×
            </button>
          </div>
        ))}

        <div className="flex-1" />

        {/* Add forms (prominent) */}
        <button
          type="button"
          onClick={openFormsPicker}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Add forms
        </button>

        {/* Dev: Audit PDF fields */}
        <button
          type="button"
          onClick={auditPdfBindings}
          className="ml-1 px-2 py-1 text-[11px] rounded border border-gray-300 bg-white hover:bg-gray-50"
          title="Scan PDF field bindings and log results"
        >
          Audit
        </button>
      </div>
    </div>

    {/* PDF viewer takes all remaining height */}
    <div className="flex-1 min-h-0">
      {showRightPane ? (
        <div ref={pdfjsContainerRef} className="w-full h-full overflow-auto" />
      ) : (
        <div className="w-full h-full overflow-auto flex items-center justify-center text-sm text-gray-500">
          Complete the chat on the left to load your forms.
        </div>
      )}
    </div>
  </div>
</div>

      </div> /* ← CLOSE the flex row (Left + Right) */
    )}

    {/* ===== Modals ===== */}
{/* Forms Picker modal */}
{showFormsPicker && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded shadow w-[520px] max-h-[70vh] flex flex-col">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold">Add / remove forms</h3>
        <p className="text-xs text-gray-500 mt-1">
          Toggle the forms you want in this workspace. Your APS will be kept first automatically.
        </p>
      </div>

      {/* List */}
      <div className="px-4 py-3 overflow-auto">
        <ul className="space-y-2">
          {AVAILABLE_FORMS.map((name) => {
            const checked = formsPickerSet.has(name);
            return (
              <li key={name} className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checked}
                    onChange={() => toggleFormInPicker(name)}
                  />
                  <span className="text-sm">{name}</span>
                </label>
                {/* small hint chip for common ones */}
                {/801|Agreement of Purchase and Sale|371|300/.test(name) && (
                  <span className="ml-auto text-[10px] px-2 py-[2px] rounded bg-gray-100 text-gray-600">
                    Suggested
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t flex justify-end gap-2">
        <button
          type="button"
          className="px-3 py-2 border rounded"
          onClick={() => setShowFormsPicker(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-3 py-2 border rounded bg-blue-600 text-white hover:bg-blue-700"
          onClick={commitFormsPicker}
        >
          Done
        </button>
      </div>
    </div>
  </div>
)}

    {/* Address modal */}
{showAddressModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded shadow p-4 w-[520px]">
      <h3 className="font-semibold mb-2">Enter Address</h3>

      <input
        ref={addressInputRef}
        value={addressSearchVal}
        onChange={(e) => setAddressSearchVal(e.target.value)}
        className="w-full border rounded px-3 py-2"
        placeholder="Start typing; choose a Google Places suggestion…"
        autoComplete="off"
        inputMode="search"
        name="tima-address"
      />

      <div className="mt-3 flex justify-end gap-2">
        <button
          className="px-3 py-2 border rounded"
          onClick={() => setShowAddressModal(false)}
        >
          Cancel
        </button>

        <button
          className="px-3 py-2 rounded bg-blue-600 text-white"
          onClick={() => {
            const raw = String(addressSearchVal || '').trim();
            if (!raw) {
              addMsg(setChatLog, 'tima', 'Please enter or choose an address.');
              return;
            }

            // Use your existing parser
            const parsed = parseCanadianAddress(raw);
            const num = String(parsed.streetNumber || '').trim();
            const street = String(parsed.streetName || '').trim();
            const unit = String(parsed.unitNumber || '').trim();
            const city = String(parsed.city || '').trim();
            const prov = String(parsed.province || '').trim();
            const pc = String(parsed.postalCode || '').trim();

            if (!street || (!num && !city)) {
              addMsg(setChatLog, 'tima', 'Please include at least the street name and a street number or city.');
              return;
            }

            let nextDeal;
            setDeal((d) => {
              nextDeal = {
                ...(d || {}),
                address: {
                  ...(d?.address || {}),
                  streetNumber: num,
                  streetName: street,
                  unit: unit || d?.address?.unit || '',
                  city: city,
                  CityName: city, // keep legacy key consistent if your PDF mapping reads this
                  province: prov,
                  postalCode: pc,
                },
              };
              return nextDeal;
            });

            setShowAddressModal(false);
            const pretty =
              (num ? num + ' ' : '') +
              (street || '') +
              (city ? ', ' + city : '') +
              (prov ? ', ' + prov : '') +
              (pc ? ' ' + pc : '');
            addMsg(setChatLog, 'tima', `Address set to: ${pretty}`);

            // Route to the next missing item (fronting → legal → price → etc.)
            advanceAfterAddressOrMLS(addMsg, setStage, setChatLog, setDeal, nextDeal);
          }}
        >
          Save
        </button>
      </div>
    </div>
  </div>
)}

    {/* Irrevocable Date modal */}
    {showIrrevDateModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow p-4 w-[380px]">
          <h3 className="font-semibold mb-2">Irrevocable Date</h3>
          <input
            type="date"
            value={tmpIrrevDate}
            onChange={(e) => setTmpIrrevDate(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              className="px-3 py-2 border rounded"
              onClick={() => setShowIrrevDateModal(false)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-2 border rounded"
              onClick={saveIrrevDate}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Irrev time modal */}
    {showIrrevTimeModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow p-4 w-[380px]">
          <h3 className="font-semibold mb-2">Irrevocable Time</h3>
          <input
            type="time"
            value={tmpIrrevTime}
            onChange={(e) => setTmpIrrevTime(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button className="px-3 py-2 border rounded" onClick={() => setShowIrrevTimeModal(false)}>
              Cancel
            </button>
            <button className="px-3 py-2 border rounded" onClick={saveIrrevTime}>
              Save
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Completion date modal */}
    {showCompletionDateModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow p-4 w-[380px]">
          <h3 className="font-semibold mb-2">Completion Date</h3>
          <input
            type="date"
            value={tmpCompletionDate}
            onChange={(e) => setTmpCompletionDate(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              className="px-3 py-2 border rounded"
              onClick={() => setShowCompletionDateModal(false)}
            >
              Cancel
            </button>
            <button className="px-3 py-2 border rounded" onClick={saveCompletionDate}>
              Save
            </button>
          </div>
        </div>
      </div>
    )}

        {/* Agreement date modal */}
{showAgreementDateModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded shadow p-4 w-[380px]">
      <h3 className="font-semibold mb-2">Agreement Date</h3>
      <input
        type="date"
        value={tmpAgreementDate}
        onChange={(e) => setTmpAgreementDate(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          className="px-3 py-2 border rounded"
          onClick={() => {
            setShowAgreementDateModal(false);
          }}
        >
          Cancel
        </button>
        <button
          className="px-3 py-2 rounded bg-blue-600 text-white"
          onClick={() => {
            const iso = String(tmpAgreementDate || '').slice(0, 10);
            if (!iso) {
              addMsg(setChatLog, 'tima', 'Please pick a valid date.');
              return;
            }
            let nextDeal;
setDeal((d) => {
  nextDeal = {
    ...(d || {}),
    agreementDate: iso, // legacy flat field (kept for older mappings)
    dates: { ...(d?.dates || {}), agreementDate: iso },
  };
  return nextDeal;
});

setShowAgreementDateModal(false);
addMsg(setChatLog, 'tima', `Agreement Date set to ${iso}.`);
goToNamesAfterAgreement(nextDeal, addMsg, setStage, setChatLog, setDeal);



          }}
        >
          Save
        </button>
      </div>
    </div>
  </div>
)}

{/* MLS PDF upload modal */}
{showMlsUploadModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded shadow p-4 w-[460px]">
      <h3 className="font-semibold mb-2">Upload MLS PDF</h3>

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setMlsPdfFile(e.target.files?.[0] || null)}
        className="w-full border rounded px-3 py-2"
      />

      <div className="mt-3 flex justify-end gap-2">
        <button
          className="px-3 py-2 border rounded"
          onClick={() => setShowMlsUploadModal(false)}
        >
          Cancel
        </button>

        <button
          className="px-3 py-2 bg-blue-600 text-white rounded"
          onClick={async () => {
            if (!mlsPdfFile) return;

            try {
              const result = await recognizeListingFromPdf(mlsPdfFile);

              // Debug table of parsed keys (visible in DevTools)
              if (result) console.table(result);

              // Merge parsed data into deal (non-destructive)
              setDeal((prev) => {
                const r = result || {};
                const p = prev || {};
                const prevAddr = p.address || {};

                // sellersText → up to two sellers (don’t overwrite if you already typed names)
                const mergeSellers = () => {
                  const out = Array.isArray(p.sellers) ? [...p.sellers] : [];
                  if (typeof r.sellersText === 'string' && r.sellersText.trim()) {
                    const parts = r.sellersText
                      .split(/\s*(?:&| and |,)\s*/i)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (parts[0] && !out[0]) out[0] = parts[0];
                    if (parts[1] && !out[1]) out[1] = parts[1];
                  }
                  return out;
                };

                // normalizePhone is optional in your helpers; fall back if missing
                const normPhone = (val) => {
                  const raw = val || '';
                  if (typeof normalizePhone === 'function') return normalizePhone(raw);
                  const digits = String(raw).replace(/[^\d]/g, '');
                  if (digits.length === 10) {
                    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
                  }
                  return raw;
                };

                return {
                  ...p,

                  // basic flags
                  mlsParsed: !!r,

                  // MLS ID if present
                  mlsId: r.mlsId || p.mlsId || '',

                  // address: never clobber existing unless parsed has real values
                  address: {
                    ...prevAddr,
                    streetNumber: r.address?.streetNumber || prevAddr.streetNumber || '',
                    streetName:   r.address?.streetName  || prevAddr.streetName  || '',
                    unitNumber:   r.address?.unitNumber  || prevAddr.unitNumber  || '',
                    // keep both keys in sync for downstream consumers
                    CityName:     r.address?.CityName    || r.address?.city || prevAddr.CityName || prevAddr.city || '',
                    city:         r.address?.city        || r.address?.CityName || prevAddr.city || prevAddr.CityName || '',
                    province:     r.address?.province    || prevAddr.province || 'ON',
                    postalCode:   r.address?.postalCode  || prevAddr.postalCode || '',
                    // mirror street to sideOf (your PDF wants it)
                    sideOf:       r.address?.streetName  || r.address?.streetName || prevAddr.sideOf || '',  
                  },

                  // sellers (array of up to two)
                  sellers: mergeSellers(),

                  // fields commonly used on APS
                  legalDescription: r.legalDescription || p.legalDescription || '',
                  inclusions: r.inclusions || p.inclusions || '',
                  exclusions: r.exclusions || p.exclusions || '',
                  rentalItems: r.rentals || p.rentalItems || '',

                  // sizes block (what the PDF builder expects)
                  sizes: {
                    ...(p.sizes || {}),
                    frontage: r.frontage || p.sizes?.frontage || '',
                    depth: r.depth || p.sizes?.depth || '',
                    sizeUnit: p.sizes?.sizeUnit || 'feet',
                  },

                  // keep your debug objects if you already use them
                  listingBrokerage: {
                    name: r.brokerageName || p.listingBrokerage?.name || '',
                    phone: r.brokeragePhone || p.listingBrokerage?.phone || '',
                  },
                  listingAgent: {
                    name: r.agentName || p.listingAgent?.name || '',
                    email: r.agentEmail || p.listingAgent?.email || '',
                    phone: r.agentPhone || p.listingAgent?.phone || '',
                  },

                  // mirror into the keys your PDF builder actually reads
                  brokerages: {
                    ...(p.brokerages || {}),
                    listing: {
                      ...(p.brokerages?.listing || {}),
                      name: r.brokerageName || p.brokerages?.listing?.name || '',
                      phone: normPhone(r.brokeragePhone || p.brokerages?.listing?.phone || ''),
                      agent: r.agentName || p.brokerages?.listing?.agent || '',
                    },
                    buyer: {
                      ...(p.brokerages?.buyer || {}),
                    },
                  },

                                    money: {
                    ...(p.money || {}),
                    depositHolder:
                      p.money?.depositHolder ||
                      r.brokerageName ||
                      p.brokerages?.listing?.name ||
                      '',
                  },


                  // notices (seller delivery email on page 5); only set if empty
                  notices: {
                    ...(p.notices || {}),
                    sellerAgentEmail: p?.notices?.sellerAgentEmail || r.agentEmail || '',
                    buyerAgentEmail: p?.notices?.buyerAgentEmail || (agentProfile?.agentEmail || ''),
                  },
                };
              });

              // Continue flow after upload — only if parse yielded something useful
const hasUseful =
  !!(
    result &&
    (
      result.mlsId ||
      (result.address && result.address.streetName) ||
      result.legalDescription ||
      result.brokerageName ||
      result.inclusions || result.exclusions || result.rentals
    )
  );

if (hasUseful) {
  addMsg(
    setChatLog,
    'tima',
    'Updated documents with MLS information. We’ll keep going with anything we still need.'
  );
  console.table(result);

  // ask in chat first, then modal if needed
setShowMlsUploadModal(false);
addMsg(
  setChatLog,
  'tima',
  'What is the Agreement Date?',
  ['Today', 'Choose date']
);
setStage('agreementDateAsk');
;

} else {
  // parsing returned nothing usable: close modal and prompt next step
  addMsg(
    setChatLog,
    'tima',
    'Error reading the MLS PDF. You can paste an MLS ID or type "skip".',
    ['skip']
  );
  setStage('mlsIdPreParty');
  setShowMlsUploadModal(false);
}
} catch (err) {
  console.error('MLS parse error:', err);
  addMsg(
    setChatLog,
    'tima',
    'Error reading the MLS PDF. You can paste an MLS ID or type "skip".',
    ['skip']
  );
  setStage('mlsIdPreParty');
  setShowMlsUploadModal(false);
}
}}
>
  Upload
</button>
</div>
</div>
</div>
)}




    {/* Title Search (Requisition) date modal */}
    {showTitleDateModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow p-4 w-[380px]">
          <h3 className="font-semibold mb-2">Title Search (Requisition) Date</h3>
          <input
            type="date"
            value={tmpTitleDate}
            onChange={(e) => setTmpTitleDate(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button className="px-3 py-2 border rounded" onClick={() => setShowTitleDateModal(false)}>
              Cancel
            </button>
            <button className="px-3 py-2 border rounded" onClick={saveTitleDate}>
              Save
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
export default App;
