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
    purchasePrice: ['txtp_price', 'txtp_pricewords'],
    depositAmount: ['txtp_deposit', 'txtp_depositwords'],
    depositTiming: ['hidhereupon'],
    depositHolder: ['txtDepositHolder'],

    // Schedules
    attachedSchedules: ['txtAttachedSchedule'],

    // Irrevocable (modal)
    irrevBy: ['hidirrev_v_p'],
    irrevTime: ['txtp_irrev_t'],
    irrevDay: ['txtp_OfferExpireDate_d'],
    irrevMonthWord: ['txtp_OfferExpireDate_mmmm'],

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
    sizeUnit: 'feet',
  },
};

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

// ---------------- HELPERS ----------------
function addMsg(setter, sender, text, buttons = null) {
  setter((prev) => [...prev, { sender, text, buttons }]);
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

/** Build the logical→Acro payload (STRICT). */
function buildAcroFromDeal(currentDeal, prof) {
  const acro = {};
    // Agreement date (store raw; specific field-splitting can be added when IDs are confirmed)
  acro.agreementDate = currentDeal.agreementDate || '';
    // Split Agreement date into day / month (word) / year for "this ___ day of ________ 20____"
  (function () {
    const s = currentDeal.agreementDate || '';
    // Expecting YYYY-MM-DD
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) {
      acro.agreementDay = '';
      acro.agreementMonthWord = '';
      acro.agreementYear = '';
      return;
    }
    const [_, yyyy, mm, dd] = m;

    // Month index 1-12 → word
    const MONTHS = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthNum = parseInt(mm, 10);
    const monthWord = MONTHS[monthNum] || '';

    acro.agreementDay = String(parseInt(dd, 10));         // e.g., "7"
    acro.agreementMonthWord = monthWord;                  // e.g., "November"
    acro.agreementYear = yyyy;                            // e.g., "2025"

    // If your PDF uses a "20____" printed prefix with a 2-digit field, uncomment below:
    // acro.agreementYearLast2 = yyyy.slice(-2);
  })();



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
    const irrevDateParts = getDateParts(
      currentDeal.irrev.onISO.slice(0, 10)
    );
    acro.irrevDay = irrevDateParts.day;
    acro.irrevMonthWord = irrevDateParts.monthWord;
    acro.irrevTime = currentDeal.irrev.until;
    acro.irrevBy = currentDeal.irrev.party;
  }

  // Agreement / completion / title search
  if (currentDeal.completionDate) {
    const c = getDateParts(currentDeal.completionDate);
    acro.completionDay = c.day;
    acro.completionMonthWord = c.monthWord;
    acro.completionYear = c.year;
  }
  if (currentDeal.titleSearchDate) {
    const t = getDateParts(currentDeal.titleSearchDate);
    acro.requisitionDay = t.day;
    acro.requisitionMonthWord = t.monthWord;
  }

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

// === Upload MLS PDF → parse in-memory ===
async function recognizeListingFromPdf(file) {
  // Read file into ArrayBuffer
  const buf = await file.arrayBuffer();

  // Lazy import pdfjs-dist so initial bundle stays small
  const pdfjsLib = await import('pdfjs-dist');
  const workerEntry = await import('pdfjs-dist/build/pdf.worker.entry');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerEntry;

  // Open document
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;

  // Read text from first 3 pages (enough for most Realtor.ca PDFs)
  let raw = '';
  const maxPages = Math.min(doc.numPages || 1, 3);
  for (let i = 1; i <= maxPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (item && item.str) raw += item.str + '\n';
    }
  }

  const text = raw.replace(/\s+/g, ' ').trim();

  // ---------------- Heuristic parsing ----------------

  // MLS ID like "MLS® Number: E1234567" or "MLS#: N8765432"
  let mlsId = null;
  {
    const m = /MLS(?:®|\u00AE)?\s*(?:Number|#)[:\s]*([A-Z]?\d{5,9})/i.exec(text);
    if (m) mlsId = m[1];
  }

  // List price like "$899,000" or "List Price: $1,199,900"
  let listPrice = null;
  {
    const m =
      /(?:List\s*Price|Price)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i.exec(text) ||
      /\$([\d,]+(?:\.\d{2})?)/.exec(text);
    if (m) listPrice = m[1];
  }

  // Address fields
  let unitNumber = null;
  let streetNumber = null;
  let streetName = null;
  let city = null;
  let province = null;
  let postalCode = null;

  // Try "Unit 501 123 Main St" or "#501 123 Main St"
  {
    const unitM = /(Unit|#)\s*([A-Za-z0-9-]{1,10})\s+(\d{1,6}\s+[A-Za-z].{2,40})/i.exec(text);
    if (unitM) {
      unitNumber = unitM[2];
      const st = unitM[3];
      const split = /^(\d{1,6})\s+(.+)$/.exec(st);
      if (split) {
        streetNumber = split[1];
        streetName = split[2].replace(/\s+,.*$/, '').trim();
      }
    }
  }

  // Try "123 Main St, Toronto ON M1M 1M1"
  if (!streetNumber || !streetName) {
    const stM = /(\d{1,6})\s+([A-Za-z].{2,50}),?\s+([A-Za-z][A-Za-z\s'.-]{2,40}),?\s+(ON|Ontario)\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)/i.exec(text);
    if (stM) {
      streetNumber = streetNumber || stM[1];
      streetName = streetName || stM[2].trim();
      city = city || stM[3].trim();
      province = province || (stM[4].toUpperCase().startsWith('ON') ? 'ON' : stM[4]);
      postalCode = postalCode || stM[5].toUpperCase().replace(/\s+/, ' ');
    }
  }

  // Fallback without postal
  if (!streetNumber || !streetName) {
    const alt = /(\d{1,6})\s+([A-Za-z][A-Za-z0-9\s'.-]{2,50}),?\s+([A-Za-z][A-Za-z\s'.-]{2,40})/i.exec(text);
    if (alt) {
      streetNumber = streetNumber || alt[1];
      streetName = streetName || alt[2].trim();
      city = city || alt[3].trim();
    }
  }

  // Normalize price to number if found
  let priceNum = null;
  if (listPrice) {
    const n = Number(String(listPrice).replace(/[^\d.]/g, ''));
    priceNum = Number.isFinite(n) ? n : null;
  }

  // Shape expected by the rest of your code
  return {
    mlsId: mlsId || '',
    listPrice: priceNum,
    address: streetNumber || streetName || city ? {
      streetNumber: streetNumber || '',
      streetName: streetName || '',
      unitNumber: unitNumber || '',
      CityName: city || '',
      province: province || '',
      postalCode: postalCode || '',
    } : null,
  };
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
    addMsg(setChatLog, 'user', v);
    const lower = v.toLowerCase();

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

  // Continue with Agreement date
  addMsg(setChatLog, 'tima', 'What’s the date of this Agreement?', ['Today', 'Enter date']);
  setStage('agreementDate');
  return;
}

    // ===== Agreement date =====
    if (stage === 'agreementDate') {
      if (/^today$/i.test(v)) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');

        setDeal((d) => ({ ...d, agreementDate: `${yyyy}-${mm}-${dd}` }));

        // Confirm + immediately ask Buyer/Seller count
        addMsg(setChatLog, 'tima', `Agreement date set to ${yyyy}-${mm}-${dd}.`);

        const currentParty = deal.representing || deal.party || '';
        if (currentParty === 'Buyer' || currentParty === 'Tenant') {

          addMsg(setChatLog, 'tima', 'How many buyers?', ['1', '2']);
          setStage('buyerCount');
        } else {
          addMsg(setChatLog, 'tima', 'How many sellers?', ['1', '2']);
          setStage('sellerCount');
        }
        return;
      }

      if (/^enter date$/i.test(v)) {
        // Open modal instead of free-typing
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
          setDeal((d) => ({
            ...d,
            address: {
              ...d.address,
              streetNumber:
                listing
                  .address
                  ?.streetNumber ||
                d.address
                  .streetNumber,
              streetName:
                listing
                  .address
                  ?.streetName ||
                d.address
                  .streetName,
              city:
                listing
                  .address
                  ?.city ||
                d.address.city,
              province:
                listing
                  .address
                  ?.province ||
                d.address
                  .province,
              postalCode:
                listing
                  .address
                  ?.postalCode ||
                d.address
                  .postalCode,
              sideOf:
                listing
                  .address
                  ?.streetName ||
                d.address.sideOf,
            },
            money: {
              ...d.money,
              offerPrice: listing.listPrice
                ? String(
                    listing.listPrice
                  )
                : d.money
                    .offerPrice,
              offerPriceWords:
                listing.listPrice
                  ? numberToWords(
                      listing.listPrice
                    )
                  : d.money
                      .offerPriceWords,
            },
          }));
          addMsg(
            setChatLog,
            'tima',
            `Found MLS ${listing.mlsId}. Prefilled address & price.`
          );
        })
        .catch((e) =>
          console.debug(
            'mls lookup error',
            e?.message || ''
          )
        );

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
      const n = /2/.test(v) ? 2 : 1;
      setDeal((d) => ({
        ...d,
        buyers: Array.from(
          { length: n }
        ).map(
          (_x, i) =>
            d.buyers[i] || ''
        ),
      }));
      addMsg(
        setChatLog,
        'tima',
        'Enter Buyer 1 full legal name:'
      );
      setStage('buyer1');
      return;
    }

    if (stage === 'buyer1') {
      setDeal((d) => {
        const arr = [
          ...(d.buyers || ['']),
        ];
        arr[0] = v;
        return {
          ...d,
          buyers: arr,
        };
      });
      if ((deal.buyers?.length || 1) >= 2) {
        addMsg(
          setChatLog,
          'tima',
          'Enter Buyer 2 full legal name:'
        );
        setStage('buyer2');
      } else {
        addMsg(
          setChatLog,
          'tima',
          'How many sellers?',
          ['1', '2']
        );
        setStage('sellerCount');
      }
      return;
    }

    if (stage === 'buyer2') {
      setDeal((d) => {
        const arr = [
          ...(d.buyers || [
            '',
            '',
          ]),
        ];
        arr[1] = v;
        return {
          ...d,
          buyers: arr,
        };
      });
      addMsg(
        setChatLog,
        'tima',
        'How many sellers?',
        ['1', '2']
      );
      setStage('sellerCount');
      return;
    }

    // ===== Sellers =====
    if (stage === 'sellerCount') {
      const n = /2/.test(v) ? 2 : 1;
      setDeal((d) => ({
        ...d,
        sellers: Array.from(
          { length: n }
        ).map(
          (_x, i) =>
            d.sellers[i] ||
            ''
        ),
      }));
      addMsg(
        setChatLog,
        'tima',
        'Enter Seller 1 full legal name:'
      );
      setStage('seller1');
      return;
    }

    if (stage === 'seller1') {
      setDeal((d) => {
        const arr = [
          ...(d.sellers || [
            '',
          ]),
        ];
        arr[0] = v;
        return {
          ...d,
          sellers: arr,
        };
      });
      if ((deal.sellers?.length || 1) >= 2) {
        addMsg(
          setChatLog,
          'tima',
          'Enter Seller 2 full legal name:'
        );
        setStage('seller2');
      } else {
        // Ask MLS before Address
        addMsg(
          setChatLog,
          'tima',
          'Do you have an MLS ID for this property? (Paste it, tap "Upload MLS PDF", or type "skip")',
          ['Upload MLS PDF', 'skip']
        );
        setStage('mlsId');
      }
      return;
    }

    if (stage === 'seller2') {
      setDeal((d) => {
        const arr = [
          ...(d.sellers || [
            '',
            '',
          ]),
        ];
        arr[1] = v;
        return {
          ...d,
          sellers: arr,
        };
      });
            // Ask MLS before Address (same as Seller 1 path)
      addMsg(
        setChatLog,
        'tima',
        'Do you have an MLS ID for this property? (Paste it, tap "Upload MLS PDF", or type "skip")',
        ['Upload MLS PDF', 'skip']
      );
      setStage('mlsId');

      return;
    }

    // ===== Address =====
    if (stage === 'addressPrompt') {
      if (/^enter address$/i.test(v)) {
        setAddressSearchVal('');
        setShowAddressModal(true);
        setStage('addressLine'); // continues in modal
        return;
      }
      addMsg(
        setChatLog,
        'tima',
        'Tap the button to enter the address.',
        ['Enter address']
      );
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
        addMsg(
          setChatLog,
          'tima',
          'Type the qualifier you want (e.g., "Township"):'
        );
        setStage(
          'cityQualifierOther'
        );
        return;
      }
      const choice = /city|town|village|municipality/i.test(
        v
      )
        ? v.trim()
        : '';
      if (!choice) {
        addMsg(
          setChatLog,
          'tima',
          'Please choose one:',
          [
            'City',
            'Town',
            'Village',
            'Municipality',
            'Other',
          ]
        );
        return;
      }
      setDeal((d) => ({
        ...d,
        address: {
          ...d.address,
          cityQualifier: `${choice} of`,
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'Fronting On (direction)?',
        ['North', 'South', 'East', 'West']
      );
      setStage('fronting');
      return;
    }

    if (stage === 'cityQualifierOther') {
      const label = String(v || '').trim();
      setDeal((d) => ({
        ...d,
        address: {
          ...d.address,
          cityQualifier: label.endsWith(
            'of'
          )
            ? label
            : `${label} of`,
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'Fronting On (direction)?',
        ['North', 'South', 'East', 'West']
      );
      setStage('fronting');
      return;
    }

    // ===== Fronting On =====
    if (stage === 'fronting') {
      const dir = /north|south|east|west/i.test(
        v
      )
        ? v[0].toUpperCase() +
          v.slice(1).toLowerCase()
        : '';
      setDeal((d) => ({
        ...d,
        address: {
          ...d.address,
          frontingOn: dir,
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'What is the offer price? (numbers only, e.g., 800000)'
      );
      setStage('offerPrice');
      return;
    }

    // ===== Price & deposit =====
    if (stage === 'offerPrice') {
      const clean = v.replace(
        /[^\d]/g,
        ''
      );
      setDeal((d) => ({
        ...d,
        money: {
          ...d.money,
          offerPrice: clean,
          offerPriceWords:
            numberToWords(clean),
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'Deposit amount? (numbers only, e.g., 20000)'
      );
      setStage('deposit');
      return;
    }

    if (stage === 'deposit') {
      const clean = v.replace(
        /[^\d]/g,
        ''
      );
      setDeal((d) => ({
        ...d,
        money: {
          ...d.money,
          deposit: clean,
          depositWords:
            numberToWords(clean),
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'Irrevocable by whom?',
        ['Buyer', 'Seller']
      );
      setStage('irrevParty');
      return;
    }

    if (stage === 'irrevParty') {
      const who = /buyer|seller/i.test(
        v
      )
        ? /[bB]/.test(v)
          ? 'Buyer'
          : 'Seller'
        : '';
      setDeal((d) => ({
        ...d,
        irrev: {
          ...d.irrev,
          party: who,
        },
      }));
      setTmpIrrevDate('');
      setTmpIrrevTime('');
      setShowIrrevDateModal(true);
      setStage('irrevDatePicking');
      return;
    }

    // deposit timing after irrev flow will resume in saveIrrevTime()
    if (stage === 'depositTiming') {
      if (
        /^herewith$/i.test(v) ||
        /^upon acceptance$/i.test(
          v
        ) ||
        /^other$/i.test(v)
      ) {
        if (/^other$/i.test(v)) {
          addMsg(
            setChatLog,
            'tima',
            'Type the deposit timing details (e.g., "Within 24 hours of acceptance").'
          );
          setStage(
            'depositTimingOther'
          );
          return;
        }
        setDeal((d) => ({
          ...d,
          money: {
            ...d.money,
            depositTiming: v,
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
      addMsg(
        setChatLog,
        'tima',
        'Please choose one:',
        [
          'Herewith',
          'Upon Acceptance',
          'Other',
        ]
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
      if (
        /listing brokerage/i.test(v)
      ) {
        setDeal((d) => {
          const name =
            d?.brokerages
              ?.listing?.name ||
            '';
        return {
            ...d,
            money: {
              ...d.money,
              depositHolder:
                name ||
                'Listing Brokerage',
            },
          };
        });
        if (
          !deal.brokerages
            ?.listing?.name
        ) {
          addMsg(
            setChatLog,
            'tima',
            'Type the listing brokerage name (deposit holder):'
          );
          setStage(
            'depositHolderOtherTyped'
          );
        } else {
          addMsg(
            setChatLog,
            'tima',
            'Which schedules will be attached? Tap letters, then tap "Done".',
            [
              'A',
              'B',
              'C',
              'D',
              'More',
              'Done',
            ]
          );
          setPendingSchedules(
            []
          );
          setStage('schedules');
        }
        return;
      }
      if (/other/i.test(v)) {
        addMsg(
          setChatLog,
          'tima',
          'Type the deposit holder name (e.g., "XYZ Law LLP in Trust").'
        );
        setStage(
          'depositHolderOtherTyped'
        );
        return;
      }
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
        'Which schedules will be attached? Tap letters, then tap "Done".',
        [
          'A',
          'B',
          'C',
          'D',
          'More',
          'Done',
        ]
      );
      setPendingSchedules([]);
      setStage('schedules');
      return;
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
        'Which schedules will be attached? Tap letters, then tap "Done".',
        [
          'A',
          'B',
          'C',
          'D',
          'More',
          'Done',
        ]
      );
      setPendingSchedules([]);
      setStage('schedules');
      return;
    }

    if (stage === 'schedules') {
  const choice = String(v || '').trim().toUpperCase();

  // First entry: show picker
  if (!choice) {
    showSchedulePicker(Array.from(tmpSchedulesRef.current));
    return;
  }

  // Toggle B..F
  if (['B', 'C', 'D', 'E', 'F'].includes(choice)) {
    if (tmpSchedulesRef.current.has(choice)) {
      tmpSchedulesRef.current.delete(choice);
    } else {
      tmpSchedulesRef.current.add(choice);
    }
    showSchedulePicker(Array.from(tmpSchedulesRef.current));
    return;
  }

  // Clear
  if (choice === 'CLEAR') {
    tmpSchedulesRef.current = new Set();
    showSchedulePicker([]);
    return;
  }

  // Done
  if (choice === 'DONE') {
    commitSchedules();
    return;
  }

  // Anything else: re-show
  showSchedulePicker(Array.from(tmpSchedulesRef.current));
  return;
}

    if (stage === 'legalDesc') {
      setDeal((d) => ({
        ...d,
        legalDescription: v,
      }));
      addMsg(
        setChatLog,
        'tima',
        'Frontage (more or less) — numbers only (feet).'
      );
      setStage('frontage');
      return;
    }

    if (stage === 'frontage') {
      const clean = v.replace(
        /[^\d.]/g,
        ''
      );
      setDeal((d) => ({
        ...d,
        sizes: {
          ...(d.sizes || {}),
          frontage: clean,
          sizeUnit:
            d.sizes?.sizeUnit ||
            'feet',
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'Depth (more or less) — numbers only (feet).'
      );
      setStage('depth');
      return;
    }

    if (stage === 'depth') {
      const clean = v.replace(
        /[^\d.]/g,
        ''
      );
      setDeal((d) => ({
        ...d,
        sizes: {
          ...(d.sizes || {}),
          depth: clean,
          sizeUnit:
            d.sizes?.sizeUnit ||
            'feet',
        },
      }));
      addMsg(
        setChatLog,
        'tima',
        'Present use (e.g., Single Family Residential).'
      );
      setStage(
        'presentUse'
      );
      return;
    }

    if (stage === 'presentUse') {
      setDeal((d) => ({
        ...d,
        presentUse: v,
      }));
      addMsg(
        setChatLog,
        'tima',
        'Seller agent email for delivery of documents:'
      );
      setStage(
        'sellerAgentEmail'
      );
      return;
    }

    // ===== After email / HST / etc. =====
    if (stage === 'sellerAgentEmail') {
      setDeal((d) => ({
        ...d,
        notices: {
          ...(d.notices || {}),
          sellerAgentEmail: v,
        },
      }));
      const suggestedBuyerEmail =
        agentProfile?.agentEmail ||
        '';
      if (suggestedBuyerEmail) {
        addMsg(
          setChatLog,
          'tima',
          `Buyer agent email for delivery of documents? (Press Enter to keep ${suggestedBuyerEmail})`
        );
        setStage(
          'buyerAgentEmailWithDefault'
        );
      } else {
        addMsg(
          setChatLog,
          'tima',
          'Buyer agent email for delivery of documents:'
        );
        setStage(
          'buyerAgentEmail'
        );
      }
      return;
    }

    if (
      stage ===
      'buyerAgentEmailWithDefault'
    ) {
      const val =
        v ||
        agentProfile.agentEmail ||
        '';
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
        'What chattels are included? (Long paragraph is fine.)'
      );
      setStage('inclusions');
      return;
    }

    if (stage === 'buyerAgentEmail') {
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
      setStage(
        'exclusionsStart'
      );
      return;
    }

    if (
      stage === 'exclusionsStart'
    ) {
      if (/^none$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          exclusions:
            'None',
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
        setPendingRentals(
          []
        );
        setStage('rentals');
        return;
      }
      if (
        /^add exclusions$/i.test(
          v
        )
      ) {
        addMsg(
          setChatLog,
          'tima',
          'Type exclusions (fixtures excluded).'
        );
        setStage(
          'exclusionsText'
        );
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
      if (/^done$/i.test(v)) {
        const list = pendingRentals.length
          ? pendingRentals.join(
              ', '
            )
          : '';
        setDeal((d) => ({
          ...d,
          rentalItems:
            list ||
            d.rentalItems ||
            '',
        }));
        addMsg(
          setChatLog,
          'tima',
          'HST?',
          [
            'Not Included',
            'Included In',
          ]
        );
        setStage('hst');
        return;
      }
      if (/^none$/i.test(v)) {
        setPendingRentals([]);
        setDeal((d) => ({
          ...d,
          rentalItems:
            'None',
        }));
        addMsg(
          setChatLog,
          'tima',
          'HST?',
          [
            'Not Included',
            'Included In',
          ]
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
        setStage(
          'rentalsOther'
        );
        return;
      }
      {
        const allowed = [
          'Hot water tank',
          'Furnace',
          'Air Conditioner',
        ];
        if (
          allowed.includes(v)
        ) {
          setPendingRentals(
            (prev) =>
              prev.includes(
                v
              )
                ? prev
                : [
                    ...prev,
                    v,
                  ]
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
      setPendingRentals(
        (prev) =>
          prev.includes(v)
            ? prev
            : [...prev, v]
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
      if (/^not included$/i.test(v)) {
        setDeal((d) => ({
          ...d,
          hstMode:
            'not-included',
          hstChoice:
            'Not Included',
        }));
      } else if (
        /^included in$/i.test(
          v
        )
      ) {
        setDeal((d) => ({
          ...d,
          hstMode: 'inc',
          hstChoice:
            'Included In',
        }));
      } else {
        addMsg(
          setChatLog,
          'tima',
          'Please choose one:',
          [
            'Not Included',
            'Included In',
          ]
        );
        return;
      }

      // open Title Search date modal next
      setTmpTitleDate('');
      setShowTitleDateModal(true);
      setStage(
        'titleDatePicking'
      );
      return;
    }

    // ===== Listing Brokerage =====
    if (stage === 'listingBrokerage') {
      const listing = deal.brokerages.listing;
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
        agentProfile?.brokerageName ||
        '';
      const bbPhone =
        agentProfile?.brokeragePhone ||
        '';
      const baName =
        agentProfile?.agentFullName ||
        '';
      addMsg(
        setChatLog,
        'tima',
        `Use your profile for buyer brokerage?\nName: ${bbName || '(none)'}\nPhone: ${bbPhone || '(none)'}\nAgent: ${baName || '(none)'}\n`,
        ['Yes, use profile', 'Edit']
      );
      setStage(
        'buyerBrokerageConfirm'
      );
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
  setShowIrrevDateModal(false);
  setShowIrrevTimeModal(true);
};

const saveIrrevTime = () => {
  if (!tmpIrrevDate || !tmpIrrevTime) return;

  const iso = toISODateTime(tmpIrrevDate, tmpIrrevTime || '00:00');

  setDeal((d) => ({
    ...d,
    irrev: {
      ...(d.irrev || {}),
      onISO: iso,
      until: to12h(tmpIrrevTime || '00:00'),
    },
  }));

  // close irrev time modal
  setShowIrrevTimeModal(false);

  // immediately ask for Closing / Completion Date
  addMsg(setChatLog, 'tima', 'Please choose the Closing / Completion Date:');
  setShowCompletionDateModal(true);
  setStage('completionDate');
};

// Completion / Closing date modal save
const saveCompletionDate = () => {
  if (!tmpCompletionDate) return;

  setDeal((d) => ({
    ...d,
    completionDate: tmpCompletionDate,
  }));

  // close modal
  setShowCompletionDateModal(false);
  // Open Schedules picker (start at B; A is automatic)
  showSchedulePicker(deal?.schedules || []);

  // confirm to the user and proceed
  addMsg(
    setChatLog,
    'tima',
    `Completion / Closing Date set to ${tmpCompletionDate}.`
  );

 // next: schedule selection (multi-select; A is automatic)
  setStage('schedules');
  showSchedulePicker(Array.from(tmpSchedulesRef.current));
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

    addMsg(
      setChatLog,
      'tima',
      'Listing brokerage name:'
    );
    setStage('listingBrokerage');
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

// Compute available list from your FORM_FILE keys (what you actually have on disk)
const ALL_FORM_NAMES = Object.keys(FORM_FILE || {});
const AVAILABLE_FORMS = ALL_FORM_NAMES; // if you want to filter later, do it here

// ---- SCHEDULES: helpers (A is implicit; user can toggle B..F) ----
function normalizeScheduleLetters(letters) {
  const order = ['B', 'C', 'D', 'E', 'F'];
  const set = new Set(
    Array.from(letters || [])
      .map((s) => String(s || '').trim().toUpperCase())
      .filter((s) => order.includes(s))
  );
  return order.filter((s) => set.has(s));
}

function schedulesTextForPdf(extraLetters) {
  const list = normalizeScheduleLetters(extraLetters);
  if (list.length === 0) return 'Schedule A attached hereto.';
  return `Schedules ${list.join(', ')} attached hereto.`;
}

function showSchedulePicker(current = []) {
  const norm = normalizeScheduleLetters(current);
  tmpSchedulesRef.current = new Set(norm);

  const picked = norm.length ? `Currently picked: ${norm.join(', ')}` : 'Currently picked: (none)';
  const guidance =
    'Select one or more Schedules to attach (A is automatic). Tap letters to toggle, then press Done.';

  // One chat bubble with multi-select buttons
  addMsg(setChatLog, 'tima', `${guidance}\n\n${picked}`, ['B', 'C', 'D', 'E', 'F', 'Clear', 'Done']);
  setStage('schedules');
}

function commitSchedules() {
  const extras = normalizeScheduleLetters(Array.from(tmpSchedulesRef.current));
  const letters = ['A', ...extras];
  const text = schedulesTextForPdf(extras);

  setDeal((d) => ({
    ...d,
    schedules: letters,      // e.g., ['A','B','C']
    schedulesText: text      // e.g., "Schedules B, C attached hereto."
  }));

    addMsg(
    setChatLog,
    'tima',
    extras.length
      ? `Okay — attaching Schedule A and ${extras.join(', ')}.`
      : 'Okay — attaching Schedule A only.'
  );

  // Next: Present Use
  addMsg(setChatLog, 'tima', 'Present use (e.g., Single Family Residential).');
  setStage('presentUse');
}


// (dev: keep references so ESLint doesn't mark as unused before wiring steps C/D)
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-unused-expressions
  window && (window.TIMA_schedule = { showSchedulePicker, commitSchedules, schedulesTextForPdf });
}

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
            <button className="px-3 py-2 border rounded" onClick={() => setShowAddressModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    {/* Ensure Google Places dropdown is always on top */}
    <style>{`.pac-container{z-index:99999 !important}`}</style>

    {/* Irrev date modal */}
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
            <button className="px-3 py-2 border rounded" onClick={() => setShowIrrevDateModal(false)}>
              Cancel
            </button>
            <button className="px-3 py-2 border rounded" onClick={saveIrrevDate}>
              Next
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
              onClick={() => setShowAgreementDateModal(false)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-2 bg-blue-600 text-white rounded"
              onClick={() => {
                if (!tmpAgreementDate) return;
                setDeal((d) => ({ ...d, agreementDate: tmpAgreementDate }));
                setShowAgreementDateModal(false);

                addMsg(setChatLog, 'tima', `Agreement date set to ${tmpAgreementDate}.`);
                const currentParty = deal.representing || deal.party || '';
                if (currentParty === 'Buyer' || currentParty === 'Tenant') {

                  addMsg(setChatLog, 'tima', 'How many buyers?', ['1', '2']);
                  setStage('buyerCount');
                } else {
                  addMsg(setChatLog, 'tima', 'How many sellers?', ['1', '2']);
                  setStage('sellerCount');
                }
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
                 // Parse the uploaded MLS PDF and apply results safely
                  const result = await recognizeListingFromPdf(mlsPdfFile);
                  if (result) {
                    console.table(result); // debug: view parsed fields in DevTools

                    setDeal((d) => {
                      const prevAddr = d.address || {};
                      const parsedAddr = result.address || null;

                      const mergedAddress = parsedAddr
                        ? {
                            ...prevAddr,
                            streetNumber: parsedAddr.streetNumber || prevAddr.streetNumber || '',
                            streetName:  parsedAddr.streetName  || prevAddr.streetName  || '',
                            unitNumber:  parsedAddr.unitNumber  || prevAddr.unitNumber  || '',
                            CityName:    parsedAddr.CityName    || prevAddr.CityName    || '',
                            province:    parsedAddr.province    || prevAddr.province    || '',
                            postalCode:  parsedAddr.postalCode  || prevAddr.postalCode  || '',
                            // keep your existing convention: mirror streetName into sideOf if present
                            sideOf:      (parsedAddr.streetName || prevAddr.sideOf || ''),
                          }
                        : prevAddr;

                      const prevMoney = d.money || {};
                      const priceNum  = result.listPrice != null ? String(result.listPrice) : (prevMoney.offerPrice || '');

                      return {
                        ...d,
                        mlsId: result.mlsId || d.mlsId || '',
                        address: mergedAddress,
                        money: {
                          ...prevMoney,
                          offerPrice: priceNum,
                          offerPriceWords:
                            result.listPrice != null
                              ? (typeof numberToWords === 'function' ? numberToWords(result.listPrice) : (prevMoney.offerPriceWords || ''))
                              : (prevMoney.offerPriceWords || ''),
                        },
                      };
                    });

                                        // Re-select APS so it stays visible after upload
                    try {
                      // Prefer the APS matching property type; fallback to any 100–103
                      let fAPS = '';
                      const ptype = (deal?.propertyType || '').toLowerCase();
                      if (ptype === 'freehold' || ptype === 'potl')      fAPS = ensureFormByRegex(/\b100\b/i);
                      else if (ptype === 'condo')                        fAPS = ensureFormByRegex(/\b101\b/i);
                      else if (ptype === 'co-op')                        fAPS = ensureFormByRegex(/\b102\b/i);
                      else if (ptype === 'mobile')                       fAPS = ensureFormByRegex(/\b103\b/i);
                      if (!fAPS) fAPS = ensureFormByRegex(/\b10[0-3]\b/i);

                      if (fAPS) {
                        preferAndSelect(fAPS);
                        // Fallback: explicitly set selected form so the preview re-inits
                        setSelectedForm((prev) => (prev === fAPS ? fAPS : fAPS));
                      }
                    } catch (e) { /* keep current selection if helper not available */ }


                    // New, concise message
                  addMsg(setChatLog, 'tima', 'Updated documents with MLS information. We’ll keep going with anything we still need.');
                  } else {
                    addMsg(setChatLog, 'tima', 'MLS data not found. Paste the MLS ID or type "skip" not enter information manually.', ['skip']);
                  }
                } catch (_e) {
                  addMsg(setChatLog, 'tima', 'Error reading the MLS PDF. You can paste an MLS ID or type "skip".', ['skip']);
                } finally {
                  setShowMlsUploadModal(false);
                }
                // After upload, nudge to Address
                addMsg(setChatLog, 'tima', 'What is the property address?', ['Enter address']);
                setStage('addressPrompt');


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
