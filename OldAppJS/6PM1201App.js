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
  const [lastQID, setLastQID] = useState("startOffer");

  const [activeForms, setActiveForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState("");
  const [mobilePane, setMobilePane] = useState("chat");

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
      "startOffer"
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

  // 3 — echo ONLY typed messages
  if (!isButtonClick) {
    addMsg("user", userInput, null, currentQID);
  }

  // 4 — route next stage
  const next = getNextStage(currentQID, userInput);
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
  // AUTO ADD 371/300 BASED ON REPRESENTATION TYPE
  // ====================================================
  useEffect(() => {
    const t = deal?.representationType || "";

    if (/designated/i.test(t)) {
      setActiveForms((arr) =>
        arr.includes("Form 371 – Buyer Designated Representation Agreement")
          ? arr
          : [...arr, "Form 371 – Buyer Designated Representation Agreement"]
      );
    }

    if (/client/i.test(t)) {
      setActiveForms((arr) =>
        arr.includes("Form 300 – Buyer Representation Agreement (Client)")
          ? arr
          : [...arr, "Form 300 – Buyer Representation Agreement (Client)"]
      );
    }
  }, [deal.representationType]);

  // ====================================================
  // AUTO-LOAD APS BASED ON PROPERTY TYPE
  // ====================================================
  useEffect(() => {
    const type = (deal?.propertyType || "").toLowerCase();
    if (!type) return;

    let formName = "";

    if (type.includes("freehold")) {
      formName = "Form 100 – Agreement of Purchase and Sale (Residential)";
    } else if (type.includes("condo")) {
      formName = "Form 101 – Condo Agreement of Purchase and Sale";
    } else if (type.includes("potl")) {
      formName = "Form 105 – POTL Agreement of Purchase and Sale";
    } else if (type.includes("mobile")) {
      formName = "Form 105 – Mobile Home Agreement of Purchase and Sale";
    } else if (type.includes("comm")) {
      formName = "Form 500 – Commercial Agreement of Purchase and Sale";
    }

    if (!formName) return;

    setActiveForms((prev) => {
      if (prev.includes(formName)) return prev;
      return [...prev, formName];
    });

    setSelectedForm((prev) => prev || formName);
  }, [deal.propertyType]);


  const AVAILABLE_FORMS = Object.keys(FORM_FILE || {});

  function openFormsPicker() {
    setModalState((m) => ({ ...m, showFormsPicker: true }));
  }
  // ====================================================
  // MLS PDF → DEAL MERGE (STABLE PRODUCTION VERSION)
  // ====================================================
  function handleMlsPdfSelected(file) {
    if (!file) return;

    recognizeListingFromPdf(file)
      .then((result) => {
        if (!result) {
          addMsg(
            "tima",
            "Error reading MLS PDF. You can paste the MLS ID or type 'skip'.",
            ["skip"],
            lastQID
          );
          return;
        }

        setDeal((prev) => {
          const r = result || {};
          const p = prev || {};
          const prevAddr = p.address || {};

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
            mlsId: r.mlsId || p.mlsId || "",

            address: {
              ...prevAddr,
              streetNumber: r.address?.streetNumber || prevAddr.streetNumber || "",
              streetName: r.address?.streetName || prevAddr.streetName || "",
              unitNumber: r.address?.unitNumber || prevAddr.unitNumber || "",
              city: r.address?.city || prevAddr.city || "",
              province: r.address?.province || prevAddr.province || "ON",
              postalCode: r.address?.postalCode || prevAddr.postalCode || ""
            },

            sellers: Array.isArray(r.sellers) ? r.sellers : p.sellers || [],

            legalDescription: r.legalDescription || p.legalDescription || "",
            inclusions: r.inclusions || p.inclusions || "",
            exclusions: r.exclusions || p.exclusions || "",
            rentalItems: r.rentalItems || p.rentalItems || "",

            sizes: {
              ...(p.sizes || {}),
              frontage: r.frontage || p.sizes?.frontage || "",
              depth: r.depth || p.sizes?.depth || "",
              sizeUnit: p.sizes?.sizeUnit || "feet"
            },

            brokerages: {
              ...(p.brokerages || {}),
              listing: {
                ...(p.brokerages?.listing || {}),
                name: r.brokerageName || p.brokerages?.listing?.name || "",
                phone: normalizePhone(r.brokeragePhone || p.brokerages?.listing?.phone || ""),
                agent: r.agentName || p.brokerages?.listing?.agent || ""
              },
              buyer: {
                ...(p.brokerages?.buyer || {})
              }
            },

            notices: {
              ...(p.notices || {}),
              sellerAgentEmail: r.agentEmail || p.notices?.sellerAgentEmail || "",
              buyerAgentEmail: agentProfile?.agentEmail || p.notices?.buyerAgentEmail || ""
            },

            money: {
              ...(p.money || {}),
              depositHolder:
                p.money?.depositHolder ||
                r.brokerageName ||
                p.brokerages?.listing?.name ||
                ""
            }
          };
        });

        addMsg(
          "tima",
          "MLS information loaded. We'll continue where we left off.",
          null,
          lastQID
        );

        const next = getNextStage(lastQID, "mls-uploaded");
        if (next && chatFlow[next]) {
          const node = chatFlow[next];
          addMsg("tima", node.text, node.buttons || null, next);
        }
      })
      .catch(() => {
        addMsg(
          "tima",
          "Error reading MLS PDF. You can paste the MLS ID or type 'skip'.",
          ["skip"],
          lastQID
        );
      });
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

    const next = getNextStage(lastQID, raw, true);
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

    const next = getNextStage(qid, value, true);
    if (next && chatFlow[next]) {
      const node = chatFlow[next];
      addMsg("tima", node.text, node.buttons || null, next);
      setLastQID(next);
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
                  text={m.text}
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
            className={`flex flex-col min-w-0 w-full lg:w-2/3 border-l ${
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
                    {name}
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

            {/* PDF PREVIEW */}
            <div className="flex-1 overflow-auto">
              {activeForms.length > 0 ? (
                <div ref={pdfjsContainerRef} className="w-full h-full" />
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
