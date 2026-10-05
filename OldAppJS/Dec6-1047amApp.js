// =========================
// App.js (FULL CLEAN REBUILD)
// Based ONLY on your latest uploaded files.
// Blue-button selection fixed.
// User-echo removed for button clicks.
// Proper routing restored.
// =========================

import React, {
  useState,
  useEffect,
  useRef,
  useMemo
} from "react";

import { chatFlow } from "./chatFlow";
import { getNextStage } from "./chatRouter";
import { dealReducer } from "./dealReducer";

import ChatBubble from "./components/ChatBubble.jsx";
import ButtonBar from "./components/ButtonBar.jsx";
import { ModalManager } from "./components/ModalManager.jsx";

import HomeTiles from "./features/home/HomeTiles.jsx";
import VoiceControls from "./features/voice/VoiceControls.jsx";

import { normalizeMLS as recognizeListingFromPdf } from "./hooks/mlsNormalizer.js";

import { renderPdfJsPreview } from "./pdfjsPreview";
import pdfRegistry from "./utils/pdf/registry.js";

import { buildForm100 as buildAcroFromDeal } from "./utils/pdf/buildForm100.js";

import { getAgentProfile } from "./profileStore.js";
import PdfOverlayV2 from "./components/PdfOverlayV2";
import PdfOverlayFillLayer from "./components/PdfOverlayFillLayer";
import { useFieldMapper } from "./hooks/useFieldMapper";

const { FORM_FILE, FORM_ALIAS, resolveFormUrl, normalizePublicUrl } =
  pdfRegistry || {};

const INITIAL_DEAL = {};

// ==========================================================
// CANADIAN ADDRESS PARSER — ESLint-clean
// ==========================================================
function parseCanadianAddress(raw) {
  const out = {
    streetNumber: "",
    streetName: "",
    unitNumber: "",
    city: "",
    province: "",
    postalCode: ""
  };

  if (!raw) return out;
  const s = String(raw).trim();

  const [line1, line2 = ""] = s.split(/\s*,\s*/);

  const m1 = line1.match(/^(?:([Uu]nit|#|Apt\.?)\s*(\S+)\s+)?(\d+)\s+(.+)$/);

  if (m1) {
    if (m1[2]) out.unitNumber = m1[2];
    out.streetNumber = m1[3];
    out.streetName = m1[4];
  } else {
    const parts = line1.split(/\s+/);
    if (parts.length > 1 && /^\d+$/.test(parts[0])) {
      out.streetNumber = parts[0];
      out.streetName = parts.slice(1).join(" ");
    } else {
      out.streetName = line1;
    }
  }

  const postalMatch = s.match(/[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d/);
  if (postalMatch) {
    out.postalCode = postalMatch[0].toUpperCase().replace(/\s+/, " ");
  }

  const tokens = line2.split(/\s+/).filter(Boolean);
  if (tokens.length > 0) out.city = tokens[0].replace(/,$/, "");

  const provMatch = line2.match(
    /\b(ON|QC|NS|NB|MB|BC|PE|SK|AB|NL|YT|NT|NU)\b/i
  );

  if (provMatch) out.province = provMatch[1].toUpperCase();

  return out;
}

// =========================
// MAIN APP
// =========================
export default function App() {
  // STATE
  const [mode, setMode] = useState("forms");
  const [chatLog, setChatLog] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [deal, setDeal] = useState(INITIAL_DEAL);
  const [agentProfile] = useState(getAgentProfile() || {});
  const [lastQID, setLastQID] = useState("greeting");
  const [activeForms, setActiveForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState("");
  const [mobilePane, setMobilePane] = useState("chat");
const {
  editMode,
  setEditMode,
  activePage,
  setActivePage,
  fieldMap,
  updateField,
  saveToFile
} = useFieldMapper();
useEffect(() => {
  setEditMode(false);
}, []);

  // REFS
  const pdfjsContainerRef = useRef(null);
  const viewerCtxRef = useRef(null);
  const acroRafRef = useRef(0);

  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);
  const lastQuestionRef = useRef("");

  // MODALS
  const [modalState, setModalState] = useState({
    showAgreementDate: false,
    showIrrevDate: false,
    showIrrevTime: false,
    showCompletionDate: false,
    showTitleDate: false,
    showAddress: false,
    showMlsUpload: false,
    showFormsPicker: false
  });

  const [modalData, setModalData] = useState({});

  // =========================
  // addMsg (FINAL)
  // =========================
  function addMsg(sender, text, buttons = null, qid = null) {
    if (sender === "tima") {
      if (qid) setLastQID(qid);
      if (buttons?.length > 0) {
        lastQuestionRef.current = qid;
      }
    }

    setChatLog((prev) => [
      ...prev,
      { sender, text, buttons, qid }
    ]);
  }

  // =========================
  // INITIAL GREETING
  // =========================
  useEffect(() => {
    setChatLog([]);
    addMsg(
  "tima",
  "Hi! I am REA your AI real estate assistant. How can I help you today?",
  ["Start an offer", "Help build my pipeline", "Scheduling assistant"],
  "greeting"
);

  }, []);

  // =========================
// AUTO-SCROLL
// =========================
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
    // intentionally empty (ESLint-safe)
  }
}, [chatLog]);

// =========================
// ACRO BUILDER
// =========================
const acro = useMemo(
  () => buildAcroFromDeal(deal, agentProfile),
  [deal, agentProfile]
);

// ===============================
// INIT PDF VIEWER
// ===============================
useEffect(() => {
  const container = pdfjsContainerRef.current;
  if (!container || !selectedForm) return;

  const url = normalizePublicUrl(resolveFormUrl(selectedForm));
  const aliasMap = FORM_ALIAS[selectedForm] || {};
  let cancelled = false;

  (async () => {
    try {
      if (viewerCtxRef.current?.destroy) {
        await viewerCtxRef.current.destroy();
      }
      viewerCtxRef.current = null;
      container.innerHTML = "";

      const ctx = await renderPdfJsPreview({
        container,
        url,
        acro,
        aliasMap
      });

      if (!cancelled) {
        viewerCtxRef.current = ctx;
      }
      // Force overlays to start on Page 1
try {
  setActivePage(1);
} catch (e) {
  /* no-op, ESLint-safe */
}

    } catch (err) {
      console.error("PDF preview error:", err);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [selectedForm]);

// ===============================
// LIVE PDF PATCH
// ===============================
useEffect(() => {
  const ctx = viewerCtxRef.current;
  if (!ctx?.updateValues) return;

  if (acroRafRef.current) {
    cancelAnimationFrame(acroRafRef.current);
  }

  acroRafRef.current = requestAnimationFrame(() => {
    try {
      ctx.updateValues(acro);
    } catch (err) {
      // intentionally empty (ESLint-safe)
    }
  });

  return () => {
    if (acroRafRef.current) {
      cancelAnimationFrame(acroRafRef.current);
    }
    acroRafRef.current = 0;
  };
}, [acro]);


  // ======================================================
// HANDLE USER INPUT — FINAL VERSION (ADVANCES CHAT)
// ======================================================
function handleUserInput(raw) {
  console.log("DEAL STATE:", deal);

  const userInput = String(raw || "").trim();
  if (!userInput) return;

  const currentQID = lastQID;
  const buttonList = chatFlow[currentQID]?.buttons || [];

  const isButtonClick = buttonList
    .map((b) => b.toLowerCase())
    .includes(userInput.toLowerCase());

  // 1 — update deal
  if (currentQID) {
    setDeal((d) => dealReducer(d, currentQID, userInput));
  }

  // 2 — highlight button
  if (currentQID) {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQID]: userInput
    }));
  }

  /// 3 — echo ONLY real typed messages (hide internal modal-complete)
if (!isButtonClick && raw !== "modal-complete") {
  addMsg("user", userInput, null, currentQID);
}


  // 4 — route next stage
  const next = getNextStage(currentQID, userInput, deal);
  if (!next) return;

  // 5 — modal handling
  if (next.startsWith("modal:")) {
    const modalKey = next.replace("modal:", "");
    setModalState((m) => ({ ...m, [modalKey]: true }));
    return;
  }

  // 6 — normal next chat bubble
  const node = chatFlow[next];
  if (!node) return;

  addMsg(
    "tima",
    node.text || "",
    node.buttons || null,
    node.qid || next
  );

  // update the lastQID
  setLastQID(node.qid || next);
}

// ====================================================
// AUTO-ADD FORMS BASED ON REPRESENTATION OR PROPERTY TYPE
// ====================================================
useEffect(() => {
  const type = (deal?.propertyType || "").toLowerCase();
  const rep = (deal?.representationType || "").toLowerCase();

  // === Representation Forms ===
  if (/designated/.test(rep)) {
    setActiveForms((arr) =>
      arr.includes("20_371") ? arr : [...arr, "20_371"]
    );
    setSelectedForm((prev) => prev || "20_371");
  }

  if (/client/.test(rep)) {
    setActiveForms((arr) =>
      arr.includes("1_300") ? arr : [...arr, "1_300"]
    );
    setSelectedForm((prev) => prev || "1_300");
  }

  // === APS Forms based on Property Type ===
  let shortKey = "";

  if (type.includes("freehold")) shortKey = "1_100";
  else if (type.includes("condo")) shortKey = "2_101";
  else if (type.includes("potl")) shortKey = "16_111";
  else if (type.includes("mobile")) shortKey = ""; // optional skip
  else if (type.includes("comm")) shortKey = "1_500";

  if (shortKey) {
    setActiveForms((prev) =>
      prev.includes(shortKey) ? prev : [...prev, shortKey]
    );
    setSelectedForm((prev) => prev || shortKey);
  }
}, [deal.propertyType, deal.representationType]);

const AVAILABLE_FORMS = Object.keys(FORM_FILE || {});


  // ==========================================
// PRETTY LABELS FOR FORM TABS (UI ONLY)
// DO NOT CHANGE FORM KEYS — LOGIC SAFE
// ==========================================
const PRETTY_NAME = {
  // APS FORMS
  "1_100": "APS – Freehold",
  "2_101": "APS – Condo",
  "16_111": "APS – POTL",
  "1_500": "APS – Commercial",

  // REPRESENTATION FORMS
  "20_371": "Form 371 – Buyer Designated Representation",
  "1_300": "Form 300 – Buyer Representation (Client)",

  // OPTIONAL PRETTIER GENERICS (SAFE)
  "1_200": "Listing Agreement – Seller Rep",
  "1_400": "Agreement to Lease – Residential",
  "2_2024": "Clause Booklet (2024)"
};


  function openFormsPicker() {
    setModalState((m) => ({ ...m, showFormsPicker: true }));
  }


// ====================================================
// MLS PDF → DEAL MERGE (ASYNC STRATUS PARSER VERSION)
// ====================================================
async function handleMlsPdfSelected(file) {
  if (!file) return;

  let result = null;

  try {
    // normalizeMLS is async now
    result = await recognizeListingFromPdf(file);
  } catch (err) {
    console.error("MLS parse error:", err);
    addMsg(
      "tima",
      "I couldn't read this MLS sheet. You can paste the MLS number or type 'skip'.",
      ["skip"],
      lastQID
    );
    return;
  }

  if (!result) {
    addMsg(
      "tima",
      "I couldn't extract any information from that MLS sheet. You can paste the MLS number or type 'skip'.",
      ["skip"],
      lastQID
    );
    return;
  }

  // ================================
  // MERGE INTO DEAL
  // ================================
  setDeal((prev) => {
    const p = prev || {};

    const addr = result.address || {};
    const normalizePhone = (raw) => {
      const digits = String(raw || "").replace(/[^\d]/g, "");
      if (digits.length === 10) {
        return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
      }
      return raw;
    };

    return {
      ...p,
      mlsParsed: true,
      mlsId: result.mlsId || p.mlsId || "",

      address: {
        ...(p.address || {}),
        streetNumber: addr.streetNumber || p.address?.streetNumber || "",
        streetName: addr.streetName || p.address?.streetName || "",
        unitNumber: addr.unitNumber || p.address?.unitNumber || "",
        city: addr.city || p.address?.city || "",
        province: addr.province || p.address?.province || "ON",
        postalCode: addr.postalCode || p.address?.postalCode || ""
      },

      legalDescription:
        result.legalDescription || p.legalDescription || "",

      inclusions:
        result.inclusions || p.inclusions || "",

      exclusions:
        result.exclusions || p.exclusions || "",

      rentalItems:
        result.rentalItems || p.rentalItems || "",

      sizes: {
        ...(p.sizes || {}),
        frontage: result.frontage || p.sizes?.frontage || "",
        depth: result.depth || p.sizes?.depth || "",
        sizeUnit: p.sizes?.sizeUnit || "feet"
      },

      sellers: Array.isArray(result.sellers)
        ? result.sellers
        : p.sellers || [],

      brokerages: {
        ...(p.brokerages || {}),
        listing: {
          ...(p.brokerages?.listing || {}),
          name: result.brokerageName || p.brokerages?.listing?.name || "",
          phone: normalizePhone(
            result.brokeragePhone || p.brokerages?.listing?.phone || ""
          ),
          agent: result.agentName || p.brokerages?.listing?.agent || ""
        },
        buyer: {
          ...(p.brokerages?.buyer || {})
        }
      },

      notices: {
        ...(p.notices || {}),
        sellerAgentEmail:
          result.agentEmail || p.notices?.sellerAgentEmail || "",
        buyerAgentEmail:
          agentProfile?.agentEmail || p.notices?.buyerAgentEmail || ""
      },

      money: {
        ...(p.money || {}),
        depositHolder:
          p.money?.depositHolder ||
          result.brokerageName ||
          p.brokerages?.listing?.name ||
          ""
      }
    };
  });

  /// ================================
// CONTINUE CHAT FLOW
// (Dynamic MLS summary)
// ================================
const parts = [];

if (result.address) {
  const addr = result.address;
  const line = [
    addr.streetNumber,
    addr.streetName,
    addr.unitNumber,
    addr.city,
    addr.province,
    addr.postalCode
  ]
    .filter(Boolean)
    .join(" ");
  if (line) parts.push(`• Address: ${line}`);
}

if (result.legalDescription) {
  parts.push(`• Legal Description: ${result.legalDescription}`);
}

if (result.inclusions) {
  parts.push(`• Inclusions: ${result.inclusions}`);
}

if (result.exclusions) {
  parts.push(`• Exclusions: ${result.exclusions}`);
}

if (result.rentalItems) {
  parts.push(`• Rentals: ${result.rentalItems}`);
}

if (result.frontage) {
  parts.push(`• Frontage: ${result.frontage} ft`);
}

if (result.depth) {
  parts.push(`• Depth: ${result.depth} ft`);
}

if (Array.isArray(result.sellers) && result.sellers.length > 0) {
  parts.push(`• Sellers: ${result.sellers.join(", ")}`);
}

if (result.brokerageName) {
  parts.push(`• Listing Brokerage: ${result.brokerageName}`);
}

if (result.brokeragePhone) {
  parts.push(`• Brokerage Phone: ${result.brokeragePhone}`);
}

if (result.agentName) {
  parts.push(`• Listing Agent: ${result.agentName}`);
}

if (result.agentEmail) {
  parts.push(`• Agent Email: ${result.agentEmail}`);
}

addMsg(
  "tima",
  `MLS information loaded:\n\n${parts.join("\n")}\n\nContinuing…`,
  null,
  lastQID
);



  const next = getNextStage(lastQID, "mls-uploaded", deal);
  if (next && chatFlow[next]) {
    const node = chatFlow[next];
    addMsg("tima", node.text, node.buttons || null, next);
    setLastQID(next);
  }
}


  // ====================================================
  // ADDRESS SAVED FROM MODAL (STABLE)
  // ====================================================
  function handleAddressSaved(raw) {
    const parsed = parseCanadianAddress(raw);

    setDeal((d) => ({
      ...d,
      address: {
        ...(d.address || {}),
        streetNumber: parsed.streetNumber || "",
        streetName: parsed.streetName || "",
        unitNumber: parsed.unitNumber || "",
        city: parsed.city || "",
        province: parsed.province || "",
        postalCode: parsed.postalCode || ""
      }
    }));

    const node = chatFlow[lastQID];
    if (node) {
      addMsg("tima", `Address set to: ${raw}`, null, lastQID);
    }

    const next = getNextStage(lastQID, raw, deal);
    if (next && chatFlow[next]) {
      const n = chatFlow[next];
      addMsg("tima", n.text, n.buttons || null, next);
    }
  }

  // ====================================================
// DATE/TIME MODAL SAVE — STABLE
// ====================================================
function handleModalSave(qid, value) {
  const updated = dealReducer(deal, qid, value);
  setDeal(updated);

  const next = getNextStage(qid, value, deal);
  if (next && chatFlow[next]) {
    const node = chatFlow[next];
    addMsg("tima", node.text, node.buttons || null, next);
    setLastQID(next);
  }
}  // ← IMPORTANT: THIS IS THE END OF handleModalSave



// ====================================================
// MODAL DONE HANDLER — NEW (SAFE, ESLint-clean)
// ====================================================
function handleModalDone(qid) {
  try {
    // When a modal finishes, treat it as if the user clicked a button
    // with value "modal-complete". This triggers the chat engine to advance.
    handleUserInput("modal-complete");
  } catch (e) {
    /* no-op, ESLint-safe */
  }
}

// ====================================================
// RENDER
// ====================================================
return (
  <div className="app h-screen overflow-hidden flex flex-col">

    {mode === "home" ? (
      <div className="p-6">
        <HomeTiles onSelect={() => setMode("forms")} />
      </div>
    ) : (
      <div className="flex flex-1 min-h-0 min-w-0 flex-col lg:flex-row">

        {/* ======================
            MOBILE TOGGLE
        ====================== */}
        <div className="lg:hidden sticky top-0 bg-white border-b z-10 flex">
          <button
            className={`flex-1 px-3 py-2 text-sm ${
              mobilePane === "chat"
                ? "font-semibold border-b-2 border-blue-600"
                : ""
            }`}
            onClick={() => setMobilePane("chat")}
          >
            Chat
          </button>

          <button
            className={`flex-1 px-3 py-2 text-sm ${
              mobilePane === "pdf"
                ? "font-semibold border-b-2 border-blue-600"
                : ""
            }`}
            onClick={() => setMobilePane("pdf")}
          >
            Forms/PDF
          </button>
        </div>

        {/* ======================
            LEFT CHAT PANEL
        ====================== */}
        <div
          className={`flex flex-col min-w-0 min-h-0 w-full lg:w-1/3 border-r bg-white ${
            mobilePane === "chat" ? "" : "hidden lg:flex"
          }`}
        >
          <div
            ref={chatScrollRef}
            className="flex-1 min-h-0 overflow-auto p-4 space-y-3 bg-white"
          >
            {chatLog.map((m, i) => (
              <ChatBubble
                key={i}
                sender={m.sender}
                text={typeof m.text === "string" ? m.text : ""}
                buttons={m.buttons}
                selectedAnswers={selectedAnswers}
                qid={m.qid}
                onClickButton={(btn) => handleUserInput(btn)}
              />
            ))}
          </div>

          {/* CHAT INPUT */}
          <div className="p-3 border-t flex items-center gap-2">
            <input
              ref={chatInputRef}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = e.target.value;
                  e.target.value = "";
                  handleUserInput(val);
                }
              }}
              className="flex-1 border rounded px-3 py-2"
              placeholder="Type and press Enter…"
            />

            <VoiceControls onFinalText={(t) => handleUserInput(t)} />
          </div>
        </div>

        {/* ======================
            RIGHT PDF PANEL
        ====================== */}

        

        <div
          className={`flex flex-col min-w-0 min-h-0 w-full lg:w-2/3 border-l ${
            mobilePane === "pdf" ? "" : "hidden lg:flex"
          }`}
        >

          {/* FORM TABS */}
          <div className="shrink-0 border-b bg-white p-2 flex items-center gap-1 overflow-x-auto">
            {activeForms.map((name) => (
              <div
                key={name}
                className={`flex items-center border rounded text-xs ${
                  selectedForm === name
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-300 bg-white"
                }`}
              >
                <button
                  className="px-2 py-1 truncate max-w-[140px]"
                  onClick={() => {
                    setSelectedForm(name);
                    setTimeout(() => {
                      if (window?.TIMA_forceApply) {
                        try {
                          window.TIMA_forceApply();
                        } catch {/* no-op */}
                      }
                    }, 0);
                  }}
                >
                  {PRETTY_NAME[name] || name}
                </button>

                <button
                  className="px-1 py-1 text-gray-500 hover:text-red-600"
                  onClick={() =>
                    setActiveForms((arr) => {
                      const next = arr.filter((n) => n !== name);
                      if (selectedForm === name) {
                        setSelectedForm(next[0] || "");
                      }
                      return next;
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}

            <div className="flex-1" />

            <button
              className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white"
              onClick={() =>
                setModalState((m) => ({ ...m, showFormsPicker: true }))
              }
            >
              Add forms
            </button>
          </div>
{/* === SAVE FIELD MAP (TEMP, WORKING) === */}
<div
  style={{
    position: "absolute",
    top: "45px",
    right: "20px",
    zIndex: 999999,
    pointerEvents: "auto"
  }}
>
  <button
    onClick={() => {
      console.log("SAVE FIELD MAP CLICKED");
      saveToFile();
    }}
    style={{
      padding: "8px 12px",
      background: "#ffa500",
      border: "1px solid #cc8400",
      borderRadius: "4px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
      pointerEvents: "auto"
    }}
  >
    SAVE FIELD MAP
  </button>

  {/* === MAPPING MODE TOGGLE BUTTON === */}
  <div
    style={{
      marginTop: "10px",
      pointerEvents: "auto"
    }}
  >
    <button
      onClick={() => setEditMode((v) => !v)}
      style={{
        padding: "6px 10px",
        background: editMode ? "#2ecc71" : "#e74c3c",
        border: "1px solid #333",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: "600",
        cursor: "pointer",
        color: "#fff"
      }}
    >
      {editMode ? "EXIT MAPPING MODE" : "ENTER MAPPING MODE"}
    </button>
  </div>
</div>

{/* PDF PREVIEW */}
<div className="flex-1 overflow-hidden min-h-0 max-h-full relative w-full">
  {activeForms.length > 0 ? (
    <div style={{ position: "absolute", inset: 0 }}>
      
      {/* EXISTING PDF VIEWER (unchanged) */}
      <div
  ref={pdfjsContainerRef}
  id="pdfjs-preview"
  style={{
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "auto",
    background: "#fafafa",
    pointerEvents: "auto"
  }}
></div>


      {/* NEW OVERLAY V2 (additive only) */}
      <PdfOverlayV2
        getPageRects={() => viewerCtxRef.current?.getPageRects?.()}
        fieldMap={fieldMap}
        onUpdateField={updateField}
        activePage={activePage}
        editMode={editMode}
      />
      {/* FILL LAYER (real-time text on PDF) */}
<PdfOverlayFillLayer
  getPageRects={() => viewerCtxRef.current?.getPageRects?.()}
  fieldMap={fieldMap}
  acro={acro}
  activePage={activePage}
  editMode={editMode}
/>

    </div>
  ) : (
    <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
      Complete the chat on the left to load your forms.
    </div>
  )}
</div>



        </div>
      </div>
    )}

    {/* ======================
        MODALS
    ====================== */}
    <ModalManager
  modalState={modalState}
  modalData={modalData}
  onModalDone={handleModalDone}   // <-- ADD THIS LINE
  setModalState={setModalState}
  setModalData={setModalData}
  deal={deal}
  setDeal={setDeal}
  onAddressSaved={handleAddressSaved}
  onMlsPdfSelected={handleMlsPdfSelected}
  onModalSave={handleModalSave}
  availableForms={AVAILABLE_FORMS}
  activeForms={activeForms}
  selectedForm={selectedForm}
  setActiveForms={setActiveForms}
  setSelectedForm={setSelectedForm}

    />
  </div>
);
}
