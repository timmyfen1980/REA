/* eslint-disable no-console */

// ======================================================================
// UNIVERSAL MLS NORMALIZER – REALM (Client Full, Broker Full, FullSheet)
// ======================================================================
// Produces EXACT key names App.js merges:
// mlsId, address:{streetNumber,streetName,unitNumber,city,province,postalCode},
// legalDescription, sellers[], frontingOn, inclusions, exclusions, rentalItems,
// frontage, depth, townCityMunicipalityOF,
// brokerageName, brokeragePhone, agentName, agentEmail,
// coopBrokerage, coopBrokeragePhone, coopAgent, coopAgentEmail
// ======================================================================

export async function normalizeMLS(file) {
  try {
    const raw = await extractPdfText(file);
    const text = normalizeWhitespace(raw);
    console.log("RAW_MLS_TEXT >>>", text);

    const address = extractAddress(text);
    const legalDescription = extractLegal(text);
    const sellers = extractSellers(text);
    const frontingOn = extractFrontingOn(text);
    const inclusions = extractInclusions(text);
    const exclusions = extractExclusions(text);
    const rentalItems = extractRentals(text);
    const frontage = extractFrontage(text);
    const depth = extractDepth(text);
    const mlsId = extractMLS(text);
    const municipality = extractMunicipalityName(legalDescription, address.city);

    const listing = extractListingSide(text);
    const coop = extractCoopSide(text);

    return {
      mlsId,

      address: {
        streetNumber: address.streetNumber || "",
        streetName: address.streetName || "",
        unitNumber: "",
        city: address.city || "",
        province: address.province || "ON",
        postalCode: address.postalCode || "",
      },

      legalDescription,
      sellers,
      frontingOn,
      inclusions,
      exclusions,
      rentalItems,
      frontage,
      depth,
      townCityMunicipalityOF: municipality,

      brokerageName: listing.brokerageName,
      brokeragePhone: listing.brokeragePhone,
      agentName: listing.agentName,
      agentEmail: listing.agentEmail,

      coopBrokerage: coop.coopBrokerage,
      coopBrokeragePhone: coop.coopBrokeragePhone,
      coopAgent: coop.coopAgent,
      coopAgentEmail: coop.coopAgentEmail,
    };
  } catch (err) {
    console.error("normalizeMLS error:", err);
    return null;
  }
}

// ======================================================================
// PDF TEXT EXTRACTION
// ======================================================================
async function extractPdfText(file) {
  const url = URL.createObjectURL(file);

  const pdfjsLib = await import(
    /* webpackIgnore: true */ `${process.env.PUBLIC_URL}/vendor/pdfjs/build/pdf.mjs`
  );

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `${process.env.PUBLIC_URL}/vendor/pdfjs/build/pdf.worker.mjs`;

  const loadingTask = pdfjsLib.getDocument({ url });
  const pdf = await loadingTask.promise;

  let out = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map((i) => i.str).join(" ") + "\n";
  }

  try {
    URL.revokeObjectURL(url);
  } catch {
    /* no-op */
  }

  return out;
}

// ======================================================================
// NORMALIZERS
// ======================================================================
function normalizeWhitespace(str) {
  return str.replace(/\s+/g, " ").trim();
}

function clean(str) {
  if (!str) return "";
  return str.replace(/[\u2012\u2013\u2014\u2015]/g, "-").replace(/\s+/g, " ").trim();
}

// ======================================================================
// ADDRESS EXTRACTION
// ======================================================================
function extractAddress(text) {
  if (!text) return {};

  // REALM puts the full address on the FIRST LINE 100% of the time.
  const first = text.split("\n")[0].trim();

  // Example:
  // "1001 Wardman Cres, Whitby Whitby, Williamsburg, Durham, Ontario L1N 3H1"
  const m = first.match(
    /(\d{1,5}\s+[A-Za-z0-9'.\- ]+),?\s+([A-Za-z]+)[^A-Za-z]+Ontario[^A-Za-z]+([A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d)/i
  );

  if (m) {
    const streetFull = clean(m[1]); 
    const parts = streetFull.split(" ");

    return {
      streetNumber: parts[0],
      streetName: parts.slice(1).join(" "),
      city: clean(m[2]),
      province: "ON",
      postalCode: m[3].toUpperCase().replace(/\s+/, " "),
    };
  }

  return {
    streetNumber: "",
    streetName: "",
    city: "",
    province: "ON",
    postalCode: "",
  };
}

// ======================================================================
// MUNICIPALITY LOGIC
// ======================================================================
function extractMunicipalityName(legalDescription, fallbackCity) {
  if (legalDescription) {
    const parts = clean(legalDescription).split(/\s+/);
    const last = parts[parts.length - 1];
    if (last && /^[A-Za-z]+$/.test(last)) {
      return capitalize(last);
    }
  }
  return fallbackCity || "";
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
}

// ======================================================================
// MLS NUMBER
// ======================================================================
function extractMLS(text) {
  const m = text.match(/\bE\d{8}\b/i);
  return m ? m[0] : "";
}

// ======================================================================
// LEGAL DESCRIPTION
// ======================================================================
function extractLegal(text) {
  const m = text.match(/(LT\s+\d+.*?WHITBY|PL\s+\d+.*?WHITBY|CON\s+.*?WHITBY)/i);
  return m ? clean(m[0]) : "";
}

// ======================================================================
// FRONTING ON
// ======================================================================
function extractFrontingOn(text) {
  const m = text.match(/Front On:\s*([NSEW])/i);
  if (!m) return "";
  const map = { N: "North", S: "South", E: "East", W: "West" };
  return map[m[1].toUpperCase()] || "";
}

// ======================================================================
// INCLUSIONS / EXCLUSIONS
// ======================================================================
function extractInclusions(text) {
  const m = /INCLUSIONS[: ]+(.*?)(?=EXCLUSIONS|SHOWING|Prepared By|$)/i.exec(text);
  return m ? clean(m[1]) : "";
}

function extractExclusions(text) {
  const m = /EXCLUSIONS[: ]+(.*?)(?=SHOWING|Prepared By|PROPERTY|$)/i.exec(text);
  return m ? clean(m[1]) : "";
}

// ======================================================================
// RENTAL ITEMS
// ======================================================================
function extractRentals(text) {
  const m = text.match(/Rental Items[: ]+([^A-Z]+)/i);
  return m ? clean(m[1]) : "";
}

// ======================================================================
// SELLERS
// ======================================================================
function extractSellers(text) {
  let m = text.match(/Sellers:\s*([A-Za-z0-9 '&\-]+)/i);
  if (m) {
    return clean(m[1])
      .split("&")
      .map((s) => clean(s))
      .filter(Boolean);
  }

  m = text.match(/ARN#\s*\d+\s+([A-Za-z][A-Za-z '\-]+)/i);
  if (m) {
    return [clean(m[1])];
  }

  return [];
}

// ======================================================================
// FRONTAGE & DEPTH
// ======================================================================
function extractFrontage(text) {
  const m = text.match(/(\d{1,4}(\.\d{1,2})?)\s*x\s*(\d{1,4}(\.\d{1,2})?)\s*Feet/i);
  return m ? clean(m[1]) : "";
}

function extractDepth(text) {
  const m = text.match(/(\d{1,4}(\.\d{1,2})?)\s*x\s*(\d{1,4}(\.\d{1,2})?)\s*Feet/i);
  return m ? clean(m[3]) : "";
}

// ======================================================================
// LISTING SIDE
// ======================================================================
function extractListingSide(text) {
  const blockMatch = text.match(/LISTING CONTRACTED WITH([\s\S]*?)(Prepared By|ROOM INFO|PROPERTY HISTORY|$)/i);
  const block = blockMatch ? clean(blockMatch[1]) : "";

  const nameMatch = block.match(/([A-Z0-9 '&\-,\.]+INC\.|BROKERAGE)/i);
  const brokerageName = nameMatch ? clean(nameMatch[1]) : "";

  const phoneMatch = block.match(/PHONE[: ]+(\d{3}[- ]?\d{3}[- ]?\d{4})/i);
  const brokeragePhone = phoneMatch ? clean(phoneMatch[1]) : "";

  const faxMatch = block.match(/FAX[: ]+(\d{3}[- ]?\d{3}[- ]?\d{4})/i);
  const brokerageFax = faxMatch ? clean(faxMatch[1]) : "";

  const agentMatch = block.match(/([A-Z][A-Za-z'\- ]+),\s*(Salesperson|Broker)/i);
  const agentName = agentMatch ? clean(agentMatch[1]) : "";

  const email = text.match(/[A-Za-z0-9._%+-]+@danplowman\.com/i);
  const agentEmail = email ? clean(email[0]) : "";

  return {
    brokerageName,
    brokeragePhone,
    brokerageFax,
    brokerageAddress: "",
    agentName,
    agentEmail,
  };
}

// ======================================================================
// CO-OPERATING SIDE
// ======================================================================
function extractCoopSide(text) {
  const blockMatch = text.match(/Prepared By:\s*([\s\S]*?)(Printed On:|ROOM INFO|PROPERTY HISTORY|$)/i);
  const block = blockMatch ? clean(blockMatch[1]) : "";

  const agent = clean(block.match(/([A-Z][A-Za-z'\- ]+),\s*(Broker|Salesperson)/i)?.[1] || "");
  const brokerage = clean(block.match(/([A-Z0-9 '&\-,\.]+BROKERAGE)/i)?.[1] || "");
  const phone = clean(block.match(/(\d{3}[- ]?\d{3}[- ]?\d{4})/)?.[1] || "");
  const email = clean(block.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]+)/)?.[1] || "");

  return {
    coopBrokerage: brokerage,
    coopBrokeragePhone: phone,
    coopAgent: agent,
    coopAgentEmail: email,
  };
}
