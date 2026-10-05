// frontend/src/utils/pdf/buildForm100.js
// Normalizes MLS + chat answers into the logical keys PdfFormOverlay expects,
// AND mirrors those values onto the actual raw PDF field ids so the overlay
// can fill directly via its identity pass (no console, no extra adapters).

function trim(s) {
  return (s == null ? '' : String(s)).trim();
}

function moneyStr(n) {
  const s = trim(n).replace(/[^0-9.]/g, '');
  if (!s) return '';
  const v = Number(s);
  if (!Number.isFinite(v)) return '';
  return v.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function pickFirst(...args) {
  for (const a of args) {
    if (a == null) continue;
    const s = trim(a);
    if (s) return s;
  }
  return '';
}

const MONTH_NAMES = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
];

function splitDateParts(iso) {
  const out = { d: '', mmmm: '', yy: '' };
  if (!iso) return out;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return out;
    out.d = String(d.getDate()).padStart(2, '0');
    out.mmmm = MONTH_NAMES[d.getMonth()];
    out.yy = String(d.getFullYear()).slice(-2);
  } catch { /* noop */ }
  return out;
}

// Raw-id targets for Form 100 (no fan-outs to signatures per your request)
const RAW_100 = {
  // Parties
  buyer1FullName: ['txtbuyer1'],
  buyer2FullName: ['txtbuyer2'],
  seller1FullName: ['txtseller1'],
  seller2FullName: ['txtseller2'],

  // Property
  municipalAddress: ['txtp_streetnum', 'txtp_street', 'txtp_unitNumber'],
  CityName: ['txtp_city'],
  province: ['txtp_state'],
  postalCode: ['txtp_zipcode'],
  subdivision: ['txtp_Subdivision'],
  legalDescription: ['txtp_legaldesc'],

  // Money
  offerPrice: ['txtp_price'],
  offerPriceWords: ['txtp_pricewords'],
  deposit: ['txtp_deposit'],
  depositWords: ['txtp_depositwords'],
  depositHolder: ['txtDepositHolder'],

  // Dates (triplets mirrored below using splitDateParts)
  // agreementDate, irrevOn, completionDate, titleSearchDate

  // Brokerage / lawyers
  ListingEmail: ['txtl_brkagentemail'],
  CoopEmail: ['txts_brkagentemail'],
  ListingFax: ['txtListFax'],
  CoopFax: ['txtSellFax'],

  // Chattels / fixtures / rentals
  chattelsIncluded: ['txtp_propincludes'],
  fixturesExcluded: ['txtp_propexcludes'],
  rentalItems: ['txtp_LeasedItems'],

  // Attached schedules
  schedulesAttached: ['txtAttachedSchedule', 'txtAddSchedule'],

  // Misc
  zoning: ['txtp_ZoningClass'],
  schoolDistrict: ['txtp_SchoolDistrict'],
};

// Date logical → raw triplets
const DATE_RAW_100 = {
  agreementDate: ['txtp_OfferDate_d', 'txtp_OfferDate_mmmm', 'txtp_OfferDate_yy'],
  irrevOn: ['txtp_OfferExpireDate_d', 'txtp_OfferExpireDate_mmmm', 'txtp_OfferExpireDate_yy'],
  completionDate: ['txtp_closedate_d', 'txtp_closedate_mmmm', 'txtp_closedate_yy'],
  titleSearchDate: ['txtp_fundingDate_d', 'txtp_fundingDate_mmmm', 'txtp_fundingDate_yy'],
  // NOTE: irrevUntil is time + am/pm, handled in overlay via map; we keep it logical.
};

export function buildForm100({ mlsPayload = {}, chatAnswers = {}, extra = {} } = {}) {
  // Flatten MLS address example shapes
  const mlsAddr = mlsPayload.address || {};
  const chatAddr = chatAnswers || {};

  // --- Logical keys (unchanged API for the overlay’s mapped write + date splitter) ---
  const out = {
    // Parties
    buyer1FullName: pickFirst(chatAnswers.buyer1FullName, chatAnswers.buyerName, chatAnswers.AllBuyerNames),
    buyer2FullName: pickFirst(chatAnswers.buyer2FullName),
    seller1FullName: pickFirst(chatAnswers.seller1FullName, chatAnswers.sellerName, chatAnswers.AllSellerNames),
    seller2FullName: pickFirst(chatAnswers.seller2FullName),

    // Property address
    municipalAddress: pickFirst(
      chatAnswers.municipalAddress,
      `${mlsAddr.streetNumber || ''} ${mlsAddr.streetName || ''}`.trim()
    ),
    CityName: pickFirst(chatAddr.CityName, chatAddr.city, mlsAddr.city),
    province: pickFirst(chatAddr.province, mlsAddr.province),
    postalCode: pickFirst(chatAddr.postalCode, mlsAddr.postalCode),
    subdivision: pickFirst(mlsPayload.subdivision, chatAnswers.subdivision),

    // Legal
    legalDescription: pickFirst(
      chatAnswers.legalDescription,
      mlsPayload.legal?.description,
      mlsPayload.legalDescription,
      (mlsPayload.legal && typeof mlsPayload.legal === 'string') ? mlsPayload.legal : ''
    ),

    // Price / deposit
    offerPrice: pickFirst(chatAnswers.offerPrice, mlsPayload.list?.price, mlsPayload.price),
    offerPriceWords: pickFirst(chatAnswers.offerPriceWords),
    deposit: pickFirst(chatAnswers.deposit, mlsPayload.deposit),
    depositWords: pickFirst(chatAnswers.depositWords),
    depositHolder: pickFirst(chatAnswers.depositHolder),

    // Dates
    agreementDate: pickFirst(chatAnswers.agreementDate),
    irrevOn: pickFirst(chatAnswers.irrevOn),
    irrevUntil: pickFirst(chatAnswers.irrevUntil),
    completionDate: pickFirst(chatAnswers.completionDate),
    titleSearchDate: pickFirst(chatAnswers.titleSearchDate),

    // Schedules
    schedulesAttached: pickFirst(chatAnswers.schedulesAttached),
    ScheduleA: pickFirst(chatAnswers.ScheduleA, chatAnswers.ScheduleACombined, chatAnswers.clausesText),
    ScheduleAClauseSpacing: Number.isFinite(extra?.ScheduleAClauseSpacing) ? extra.ScheduleAClauseSpacing : undefined,

    // Misc
    zoning: pickFirst(chatAnswers.zoning, mlsPayload.zoning),
    schoolDistrict: pickFirst(chatAnswers.schoolDistrict),
  };

  // Money formatting on logical values (front door)
  if (out.offerPrice) out.offerPrice = moneyStr(out.offerPrice);
  if (out.deposit) out.deposit = moneyStr(out.deposit);

  // --- Mirror logicals onto RAW PDF field ids (so overlay fills via identity pass) ---
  const mirrored = { ...out };

  // Simple one-to-many string mirrors (no fan-outs beyond what’s listed)
  for (const [logical, targets] of Object.entries(RAW_100)) {
    const val = mirrored[logical];
    if (val == null || val === '') continue;
    const arr = Array.isArray(targets) ? targets : [targets];
    for (const raw of arr) {
      if (!raw) continue;
      if (mirrored[raw] == null) mirrored[raw] = val;
    }
  }

  // Dates: write raw triplets as well, so identity pass fills even without map
  const dateMap = {
    agreementDate: DATE_RAW_100.agreementDate,
    irrevOn: DATE_RAW_100.irrevOn,
    completionDate: DATE_RAW_100.completionDate,
    titleSearchDate: DATE_RAW_100.titleSearchDate,
  };
  for (const [logical, triple] of Object.entries(dateMap)) {
    const parts = splitDateParts(mirrored[logical]);
    if (!triple || !Array.isArray(triple) || triple.length !== 3) continue;
    const [d, mmmm, yy] = triple;
    if (parts.d && mirrored[d] == null) mirrored[d] = parts.d;
    if (parts.mmmm && mirrored[mmmm] == null) mirrored[mmmm] = parts.mmmm;
    if (parts.yy && mirrored[yy] == null) mirrored[yy] = parts.yy;
  }

  return mirrored;
}
