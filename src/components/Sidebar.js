import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ─── Status helpers ───────────────────────────────────────────────────────────
function statusDotColor(raw) {
  if (!raw || raw === "+") return "#00cfff";
  if (raw === "D")         return "#ff4455";
  return "#ffcc00";
}

function statusLabel(raw) {
  if (!raw || raw === "+") return "Operational";
  if (raw === "D")         return "Decayed";
  if (raw === "P")         return "Partial";
  if (raw === "B")         return "Standby";
  if (raw === "S")         return "Spare";
  if (raw === "X")         return "Extended";
  return "Unknown";
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: "alpha",   label: "A → Z",   icon: "⇅" },
  { key: "status",  label: "Status",  icon: "◉" },
  { key: "norad",   label: "NORAD",   icon: "#" },
  { key: "country", label: "Country", icon: "⊕" },
  { key: "launch",  label: "Launch",  icon: "◷" },
];

const getName = item => (typeof item === "string" ? item : item.name);
const getRaw  = item => (typeof item === "string" ? "+" : item.opsStatusRaw);

function sortItems(items, sortKey) {
  const clone = [...items];
  switch (sortKey) {
    case "alpha":
      return clone.sort((a, b) => getName(a).localeCompare(getName(b)));
    case "status": {
      const order = { "+": 0, "P": 1, "B": 2, "S": 3, "X": 4, "?": 5, "": 6, "D": 7 };
      return clone.sort((a, b) => (order[getRaw(a)] ?? 6) - (order[getRaw(b)] ?? 6));
    }
    case "norad":
      return clone.sort((a, b) =>
        parseInt(a.noradId || "999999", 10) - parseInt(b.noradId || "999999", 10)
      );
    case "country":
      return clone.sort((a, b) => (a.country || "").localeCompare(b.country || ""));
    case "launch":
      return clone.sort((a, b) => {
        const da = a.launchDate ? new Date(a.launchDate) : new Date(0);
        const db = b.launchDate ? new Date(b.launchDate) : new Date(0);
        return db - da;
      });
    default:
      return clone;
  }
}

// ─── Feedback label options ───────────────────────────────────────────────────
const ISSUE_LABELS = [
  { value: "bug",      icon: "🐛", color: "#ff4455", border: "rgba(255,68,85,0.35)",  bg: "rgba(255,68,85,0.08)"  },
  { value: "question", icon: "❓", color: "#ffcc00", border: "rgba(255,204,0,0.35)",  bg: "rgba(255,204,0,0.08)"  },
  { value: "feedback", icon: "💬", color: "#00cfff", border: "rgba(0,207,255,0.35)",  bg: "rgba(0,207,255,0.08)"  },
];

// ─── Feedback API call ────────────────────────────────────────────────────────
const FEEDBACK_COOLDOWN_MS = 30000;
const FEEDBACK_LS_KEY      = "satmon_last_feedback_ts";

async function submitFeedback(message, label) {
  const token = process.env.REACT_APP_GITHUB_FEEDBACK_TOKEN;
  const owner = process.env.REACT_APP_GITHUB_OWNER || "Emkave";
  const repo  = process.env.REACT_APP_GITHUB_REPO  || "satmon";

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      "Authorization":        `Bearer ${token}`,
      "Accept":               "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type":         "application/json",
    },
    body: JSON.stringify({
      title:  `[${label}] ${message.slice(0, 72)}${message.length > 72 ? "…" : ""}`,
      body:   message,
      labels: [label],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return await res.json();
}

// ─── Label button ─────────────────────────────────────────────────────────────
function LabelButton({ lbl, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  const lit = active || hovered;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        padding: "10px 6px",
        background: lit ? lbl.bg : "rgba(255,255,255,0.03)",
        border: `1px solid ${lit ? lbl.border : "rgba(255,255,255,0.07)"}`,
        borderRadius: "7px",
        color: lit ? lbl.color : "rgba(255,255,255,0.28)",
        fontFamily: "'Share Tech', monospace",
        fontSize: "11.5px",
        letterSpacing: "1px",
        textTransform: "uppercase",
        cursor: "pointer",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: "6px",
        transition: "background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s",
        boxShadow: active ? `0 0 14px ${lbl.bg}` : "none",
        outline: "none",
      }}
    >
      {lbl.value}
    </button>
  );
}

// ─── Send button ──────────────────────────────────────────────────────────────
function SendButton({ onClick, disabled, sending, labelDef, hasText }) {
  const [hovered, setHovered] = useState(false);
  const lit = hasText && hovered && !disabled;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", padding: "12px",
        background: lit ? labelDef?.bg : hasText ? labelDef?.bg : "rgba(255,255,255,0.02)",
        border: `1px solid ${hasText ? lit ? labelDef?.color : labelDef?.border : "rgba(255,255,255,0.06)"}`,
        borderRadius: "8px",
        color: hasText ? labelDef?.color : "rgba(255,255,255,0.2)",
        fontFamily: "'Share Tech', monospace",
        fontSize: "12px", letterSpacing: "3px",
        textTransform: "uppercase",
        cursor: hasText && !sending ? "pointer" : "default",
        transition: "border-color 0.18s, box-shadow 0.18s",
        boxShadow: lit ? `0 0 14px ${labelDef?.bg}` : "none",
        outline: "none",
      }}
    >
      {sending ? "Transmitting..." : "Send Message"}
    </button>
  );
}

// ─── Feedback modal ───────────────────────────────────────────────────────────
function FeedbackModal({ onClose }) {
  const [selectedLabel, setSelectedLabel] = useState("feedback");
  const [text, setText]     = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | success | error | cooldown
  const [errMsg, setErrMsg] = useState("");
  const [closing, setClosing] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Trigger exit animation then actually unmount
  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Client-side cooldown guard
    const lastTs  = parseInt(localStorage.getItem(FEEDBACK_LS_KEY) || "0", 10);
    const elapsed = Date.now() - lastTs;
    if (elapsed < FEEDBACK_COOLDOWN_MS) {
      const secs = Math.ceil((FEEDBACK_COOLDOWN_MS - elapsed) / 1000);
      setErrMsg(`Please wait ${secs}s before sending another message.`);
      setStatus("cooldown");
      return;
    }

    setStatus("sending");
    setErrMsg("");
    try {
      await submitFeedback(trimmed, selectedLabel);
      localStorage.setItem(FEEDBACK_LS_KEY, String(Date.now()));
      setStatus("success");
    } catch (e) {
      setErrMsg(e.message || "Failed to send. Please try again.");
      setStatus("error");
    }
  };

  const activeLabelDef = ISSUE_LABELS.find(l => l.value === selectedLabel);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: closing ? "backdropOut 0.2s ease forwards" : "backdropIn 0.2s ease forwards",
      }}
      onClick={e => { if (e.target === e.currentTarget) dismiss(); }}
      onKeyDown={e => {
        if (e.key === "Escape") 
          dismiss();
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && status === "idle") 
          handleSubmit();
      }}
    >
      <div style={{
        width: "420px",
        background: "rgba(8,16,28,0.97)",
        border: "1px solid rgba(0,207,255,0.25)",
        borderRadius: "12px",
        boxShadow: "0 0 60px rgba(0,207,255,0.08), 0 20px 60px rgba(0,0,0,0.8)",
        overflow: "hidden",
        animation: closing
          ? "modalOut 0.2s cubic-bezier(0.4,0,1,1) forwards"
          : "modalIn  0.22s cubic-bezier(0.34,1.56,0.64,1) forwards",
      }}>

        {/* Header */}
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid rgba(0,207,255,0.10)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{
              fontFamily: "'Share Tech', monospace",
              fontSize: "11px", textTransform: "uppercase",
              letterSpacing: "3px", color: "rgba(0,207,255,0.45)",
              marginBottom: "4px",
            }}>Satmon // Feedback</div>
            <div style={{
              fontFamily: "'Share Tech', monospace",
              fontSize: "18px", color: "#fff", letterSpacing: "1px",
            }}>Report Issue / Suggest</div>
          </div>
          <button onClick={dismiss} style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#888", borderRadius: "6px",
            width: "28px", height: "28px", cursor: "pointer", fontSize: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px" }}>
          {status === "success" ? (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <div style={{ fontSize: "34px", marginBottom: "10px" }}>✓</div>
              <div style={{
                fontFamily: "'Share Tech', monospace", fontSize: "16px",
                color: "#00cfff", letterSpacing: "1px", marginBottom: "6px",
              }}>Message Received</div>
              <div style={{
                fontFamily: "'Share Tech', monospace", fontSize: "13px",
                color: "rgba(255,255,255,0.3)",
              }}>Your report has been filed on GitHub.</div>
              <button onClick={dismiss} style={{
                marginTop: "22px", padding: "9px 28px",
                background: "rgba(0,207,255,0.08)", border: "1px solid rgba(0,207,255,0.28)",
                borderRadius: "6px", color: "#00cfff",
                fontFamily: "'Share Tech', monospace", fontSize: "12px",
                letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer",
              }}>Close</button>
            </div>
          ) : (
            <>
              {/* Hint */}
              <div style={{
                fontFamily: "'Share Tech', monospace", fontSize: "12px",
                color: "rgba(255,255,255,0.3)", lineHeight: "1.6", marginBottom: "16px",
              }}>
                Describe your issue or suggestion. No account needed — submitted anonymously.
              </div>

              {/* Label picker */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{
                  fontFamily: "'Share Tech', monospace", fontSize: "10px",
                  textTransform: "uppercase", letterSpacing: "2px",
                  color: "rgba(0,207,255,0.4)", marginBottom: "8px",
                }}>Category</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {ISSUE_LABELS.map(lbl => (
                    <LabelButton
                      key={lbl.value}
                      lbl={lbl}
                      active={selectedLabel === lbl.value}
                      onClick={() => setSelectedLabel(lbl.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => { setText(e.target.value); if (status !== "idle") setStatus("idle"); }}
                placeholder={
                  selectedLabel === "bug"      ? "e.g. Satellite X shows incorrect orbit path..." :
                  selectedLabel === "question" ? "e.g. What does the yellow dot mean?..." :
                                                 "e.g. It would be great if we could filter by orbit type..."
                }
                maxLength={1000}
                rows={5}
                style={{
                  width: "100%", padding: "11px 12px",
                  background: "rgba(0,0,0,0.45)",
                  border: `1px solid ${
                    status === "error" || status === "cooldown"
                      ? "rgba(255,68,85,0.4)"
                      : activeLabelDef
                        ? activeLabelDef.border
                        : "rgba(0,207,255,0.18)"
                  }`,
                  borderRadius: "8px", color: "#e0e0e0",
                  fontFamily: "'Share Tech', monospace",
                  fontSize: "13.5px", lineHeight: "1.6",
                  resize: "vertical", outline: "none",
                  boxSizing: "border-box", letterSpacing: "0.3px",
                  transition: "border-color 0.15s",
                }}
              />

              {/* Footer row */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginTop: "5px", marginBottom: "14px",
              }}>
                <div style={{
                  fontFamily: "'Share Tech', monospace", fontSize: "11px",
                  color: status === "error" || status === "cooldown" ? "#ff4455" : "rgba(255,255,255,0.18)",
                  minHeight: "15px",
                }}>
                  {errMsg || "Ctrl+Enter to send"}
                </div>
                <div style={{
                  fontFamily: "'Share Tech', monospace", fontSize: "11px",
                  color: text.length > 900 ? "#ffcc00" : "rgba(255,255,255,0.18)",
                }}>{text.length}/1000</div>
              </div>

              {/* Submit */}
              <SendButton
                onClick={handleSubmit}
                disabled={status === "sending" || !text.trim()}
                sending={status === "sending"}
                labelDef={activeLabelDef}
                hasText={!!text.trim()}
              />
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes modalOut {
          from { opacity: 1; transform: scale(1)    translateY(0);    }
          to   { opacity: 0; transform: scale(0.92) translateY(12px); }
        }
        @keyframes backdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes backdropOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar({ satelliteCount, setSatelliteCount, satelliteNames = [], flyToRef }) {
  const [open, setOpen]               = useState(false);
  const [active, setActive]           = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey]         = useState("alpha");
  const [showFeedback, setShowFeedback] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => { setSearchQuery(""); }, [active]);

  const visibleNames = useMemo(() => satelliteNames.slice(
    0, satelliteCount >= satelliteNames.length ? undefined : satelliteCount
  ), [satelliteNames, satelliteCount]);

  // Sort is memoized independently — it only re-runs when visibleNames or
  // sortKey changes, not on every search keystroke.
  const sortedItems = useMemo(() => sortItems(visibleNames, sortKey), [visibleNames, sortKey]);

  // Filter runs on every keystroke but sorts are already done above.
  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) return sortedItems.slice(0, 120);
    const q = searchQuery.toUpperCase();
    return sortedItems
      .filter(item => {
        const n = getName(item).toUpperCase();
        return n.startsWith(q) || n.split(/[\s\-_]/).some(w => w.startsWith(q));
      })
      .slice(0, 120);
  }, [sortedItems, searchQuery]);

  const PANEL_WIDTH  = 268;
  const HANDLE_WIDTH = 30;

  return (
    <>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

      <div style={{
        position: "fixed",
        top: 0, left: open ? "0px" : `-${PANEL_WIDTH}px`,
        width: `${PANEL_WIDTH}px`,
        height: "100vh",
        background: "rgba(7,13,22,0.97)",
        backdropFilter: "blur(16px)",
        color: "white",
        fontFamily: "'Share Tech', 'Courier New', monospace",
        boxSizing: "border-box",
        zIndex: 999,
        transition: "left 0.3s cubic-bezier(0.4,0,0.2,1)",
        overflow: "visible",
        borderRight: "1px solid rgba(0,207,255,0.10)",
        display: "flex", flexDirection: "column",
      }}>

        {/* Toggle handle */}
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            position: "absolute",
            right: `-${HANDLE_WIDTH}px`, top: "50%", transform: "translateY(-50%)",
            width: `${HANDLE_WIDTH}px`, height: "72px",
            background: "rgba(7,13,22,0.95)",
            border: "1px solid rgba(0,207,255,0.15)", borderLeft: "none",
            color: "rgba(0,207,255,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            borderTopRightRadius: "8px", borderBottomRightRadius: "8px",
            fontSize: "13px", transition: "background 0.2s, color 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,207,255,0.08)"; e.currentTarget.style.color = "#00cfff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(7,13,22,0.95)"; e.currentTarget.style.color = "rgba(0,207,255,0.6)"; }}
        >
          {open ? "◀" : "▶"}
        </div>

        {/* Wordmark */}
        <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
          <div style={{
            fontSize: "10px", textTransform: "uppercase",
            letterSpacing: "4px", color: "rgba(0,207,255,0.35)", marginBottom: "2px",
          }}>Satmon: Orbital Tracker</div>
          <div style={{
            fontSize: "18px", textTransform: "uppercase",
            letterSpacing: "2px",
            color: active === null ? "rgba(0,207,255,0.9)" : "rgba(255,255,255,0.55)",
            cursor: active !== null ? "pointer" : "default", transition: "color 0.2s",
          }} onClick={() => active !== null && setActive(null)}>
            {active === null ? "Mission Control" : active === "settings" ? "↩ Settings" : "↩ Catalog"}
          </div>
          <div style={{
            height: "1px",
            background: "linear-gradient(90deg, rgba(0,207,255,0.4) 0%, transparent 100%)",
            marginTop: "14px",
          }} />
        </div>

        {/* Main menu */}
        {active === null && (
          <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
            <MenuButton
              icon="🛰" label="Satellite Catalog"
              sub={`${Math.min(satelliteCount, satelliteNames.length).toLocaleString()} loaded`}
              onClick={() => setActive("catalog")}
            />
            <MenuButton
              icon="⚙" label="Settings"
              sub="Display & filters"
              onClick={() => setActive("settings")}
            />
            <MenuButton
              icon="⌥" label="Repository"
              sub="github.com/Emkave/satmon"
              onClick={() => window.open("https://github.com/Emkave/satmon", "_blank", "noopener,noreferrer")}
              external
            />
          </div>
        )}

        {/* Settings */}
        {active === "settings" && (
          <SettingsPanel
            satelliteCount={satelliteCount}
            setSatelliteCount={setSatelliteCount}
            satelliteNames={satelliteNames}
            onBack={() => setActive(null)}
          />
        )}

        {/* Catalog */}
        {active === "catalog" && (
          <CatalogPanel
            displayItems={displayItems}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortKey={sortKey}
            setSortKey={setSortKey}
            searchInputRef={searchInputRef}
            satelliteCount={satelliteCount}
            satelliteNamesLength={satelliteNames.length}
            flyToRef={flyToRef}
          />
        )}

        {/* Bottom: feedback */}
        <div style={{
          marginTop: "auto", padding: "12px 20px 20px",
          borderTop: "1px solid rgba(0,207,255,0.07)", flexShrink: 0,
        }}>
          <button
            onClick={() => setShowFeedback(true)}
            style={{
              width: "100%", padding: "9px 14px",
              background: "rgba(0,207,255,0.04)",
              border: "1px solid rgba(0,207,255,0.14)",
              borderRadius: "7px", color: "rgba(0,207,255,0.5)",
              fontFamily: "'Share Tech', monospace",
              fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase",
              cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: "10px",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background    = "rgba(0,207,255,0.09)";
              e.currentTarget.style.borderColor   = "rgba(0,207,255,0.3)";
              e.currentTarget.style.color         = "#00cfff";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background    = "rgba(0,207,255,0.04)";
              e.currentTarget.style.borderColor   = "rgba(0,207,255,0.14)";
              e.currentTarget.style.color         = "rgba(0,207,255,0.5)";
            }}
          >
            <span style={{ fontSize: "14px", opacity: 0.8 }}>⚑</span>
            Report / Suggest
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Menu Button ──────────────────────────────────────────────────────────────
function MenuButton({ icon, label, sub, onClick, external }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        width: "100%", padding: "12px 14px", marginBottom: "8px",
        background: hovered ? "rgba(0,207,255,0.07)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${hovered ? "rgba(0,207,255,0.25)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "8px", cursor: "pointer",
        transition: "all 0.15s", textAlign: "left",
      }}
    >
      <span style={{ fontSize: "20px", lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{
          fontFamily: "'Share Tech', monospace", fontSize: "14px",
          color: hovered ? "#fff" : "rgba(255,255,255,0.75)",
          letterSpacing: "0.5px", lineHeight: "1.2", transition: "color 0.15s",
        }}>{label}</div>
        {sub && <div style={{
          fontFamily: "'Share Tech', monospace", fontSize: "11px",
          color: hovered ? "rgba(0,207,255,0.7)" : "rgba(255,255,255,0.25)",
          letterSpacing: "0.5px", marginTop: "2px", transition: "color 0.15s",
        }}>{sub}</div>}
      </div>
      <span style={{
        marginLeft: "auto", fontSize: external ? "14px" : "13px",
        transition: "color 0.15s",
        color: hovered ? "rgba(0,207,255,0.6)" : "rgba(255,255,255,0.15)",
      }}>{external ? "↗" : "▶"}</span>
    </button>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ satelliteCount, setSatelliteCount, satelliteNames }) {
  const total = satelliteNames.length;
  const isMax = satelliteCount >= total;

  const startHold = useCallback((dir) => {
    let step = 1, delay = 150;
    let timeoutId;
    const tick = () => {
      setSatelliteCount(c => Math.max(0, Math.min(total, c + dir * step)));
      step  = Math.min(step + Math.floor(step * 0.3) + 1, 500);
      delay = Math.max(30, delay * 0.85);
      timeoutId = setTimeout(tick, delay);
    };
    timeoutId = setTimeout(tick, 400);
    const stop = () => clearTimeout(timeoutId);
    window.addEventListener("mouseup",    stop, { once: true });
    window.addEventListener("mouseleave", stop, { once: true });
  }, [setSatelliteCount, total]);

  return (
    <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
      <label style={{
        display: "block", fontSize: "10px", textTransform: "uppercase",
        letterSpacing: "2px", color: "rgba(0,207,255,0.5)", marginBottom: "10px",
      }}>Displayed Satellites</label>

      <input
        type="number" min="0" max={total}
        value={isMax ? total : satelliteCount}
        onChange={e => {
          const raw = parseInt(e.target.value.replace(/,/g, ""), 10);
          if (!isNaN(raw)) setSatelliteCount(Math.max(0, Math.min(total, raw)));
        }}
        style={{
          width: "100%", padding: "10px 14px",
          background: "#0a0f1a",
          border: `1px solid ${isMax ? "rgba(0,207,255,0.4)" : "rgba(0,207,255,0.15)"}`,
          borderRadius: "7px", textAlign: "center",
          fontFamily: "'Share Tech', monospace", fontSize: "26px", fontWeight: "bold",
          color: isMax ? "#00cfff" : "#ffffff",
          letterSpacing: "2px",
          textShadow: isMax ? "0 0 16px rgba(0,207,255,0.45)" : "none",
          transition: "all 0.2s", boxSizing: "border-box", outline: "none",
        }}
      />

      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        {[{ label: "−", dir: -1, disabled: satelliteCount === 0 },
          { label: "+", dir:  1, disabled: isMax }].map(({ label, dir, disabled }) => (
          <button key={label}
            onClick={() => setSatelliteCount(c => Math.max(0, Math.min(total, c + dir)))}
            onMouseDown={() => !disabled && startHold(dir)}
            disabled={disabled}
            style={{
              flex: 1, padding: "10px 0",
              background: "#0d1420",
              color: disabled ? "rgba(255,255,255,0.15)" : "#ccc",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: "7px",
              fontFamily: "'Share Tech', monospace", fontSize: "20px", fontWeight: "bold",
              cursor: disabled ? "default" : "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = "rgba(0,207,255,0.08)"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.3)"; e.currentTarget.style.color = "#fff"; } }}
            onMouseLeave={e => { e.currentTarget.style.background = "#0d1420"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = disabled ? "rgba(255,255,255,0.15)" : "#ccc"; }}
          >{label}</button>
        ))}
        <button
          onClick={() => setSatelliteCount(total)}
          style={{
            flex: 1, padding: "10px 0",
            background: isMax ? "rgba(0,207,255,0.08)" : "#0d1420",
            color: isMax ? "#00cfff" : "#888",
            border: `1px solid ${isMax ? "rgba(0,207,255,0.35)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: "7px",
            fontFamily: "'Share Tech', monospace", fontSize: "10px",
            letterSpacing: "2px", textTransform: "uppercase",
            cursor: isMax ? "default" : "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={e => { if (!isMax) { e.currentTarget.style.background = "rgba(0,207,255,0.08)"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.3)"; e.currentTarget.style.color = "#00cfff"; } }}
          onMouseLeave={e => { if (!isMax) { e.currentTarget.style.background = "#0d1420"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#888"; } }}
        >MAX</button>
      </div>

      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        input[type=number]:focus { border-color: rgba(0,207,255,0.5) !important; }
      `}</style>
    </div>
  );
}

// ─── Catalog Panel ────────────────────────────────────────────────────────────
function CatalogPanel({
  displayItems, searchQuery, setSearchQuery, sortKey, setSortKey,
  searchInputRef, satelliteCount, satelliteNamesLength, flyToRef,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", padding: "12px 20px 0" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px",
      }}>
        <span style={{
          fontFamily: "'Share Tech', monospace", fontSize: "11px",
          color: "rgba(0,207,255,0.45)", textTransform: "uppercase", letterSpacing: "1.5px",
        }}>🛰 {Math.min(satelliteCount, satelliteNamesLength).toLocaleString()} objects</span>
        <span style={{
          fontFamily: "'Share Tech', monospace", fontSize: "11px",
          color: "rgba(255,255,255,0.18)", letterSpacing: "0.5px",
        }}>{displayItems.length} shown</span>
      </div>

      {/* Search */}
      <input
        ref={searchInputRef}
        type="text" value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search satellites..."
        style={{
          width: "100%", padding: "8px 11px", marginBottom: "8px",
          background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,207,255,0.18)",
          borderRadius: "7px", color: "#fff",
          fontFamily: "'Share Tech', monospace", fontSize: "13px",
          outline: "none", boxSizing: "border-box", letterSpacing: "0.5px",
          transition: "border-color 0.15s",
        }}
        onFocus={e => { e.target.style.borderColor = "rgba(0,207,255,0.55)"; }}
        onBlur={e =>  { e.target.style.borderColor = "rgba(0,207,255,0.18)"; }}
      />

      {/* Sort chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "10px" }}>
        {SORT_OPTIONS.map(opt => {
          const active = sortKey === opt.key;
          return (
            <button key={opt.key} onClick={() => setSortKey(opt.key)} style={{
              padding: "4px 9px",
              background: active ? "rgba(0,207,255,0.14)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${active ? "rgba(0,207,255,0.45)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "5px",
              color: active ? "#00cfff" : "rgba(255,255,255,0.35)",
              fontFamily: "'Share Tech', monospace", fontSize: "10.5px",
              letterSpacing: "1px", textTransform: "uppercase",
              cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: "4px",
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(0,207,255,0.07)"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.2)"; e.currentTarget.style.color = "rgba(0,207,255,0.7)"; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; } }}
            >
              <span style={{ opacity: 0.7 }}>{opt.icon}</span> {opt.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{
        flex: 1, overflowY: "auto", borderRadius: "8px",
        border: "1px solid rgba(0,207,255,0.10)",
        background: "rgba(0,0,0,0.25)", padding: "4px",
        scrollbarWidth: "thin", scrollbarColor: "rgba(0,207,255,0.15) transparent",
      }}>
        {displayItems.length === 0 ? (
          <div style={{
            color: "rgba(255,255,255,0.2)", fontFamily: "'Share Tech', monospace",
            fontSize: "13px", textAlign: "center", padding: "24px 0", letterSpacing: "0.5px",
          }}>No matches found</div>
        ) : displayItems.map((item) => (
          <SatRow key={typeof item === "string" ? item : (item.noradId || item.name)} item={item} flyToRef={flyToRef} />
        ))}
      </div>

      <style>{`
        div::-webkit-scrollbar { width: 4px; }
        div::-webkit-scrollbar-track { background: transparent; }
        div::-webkit-scrollbar-thumb { background: rgba(0,207,255,0.15); border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ─── Satellite row ────────────────────────────────────────────────────────────
function SatRow({ item, flyToRef }) {
  const [hovered, setHovered] = useState(false);
  const name = getName(item);
  const raw  = getRaw(item);
  return (
    <div
      onClick={() => flyToRef?.current?.(name)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "7px 10px", borderRadius: "6px",
        background: hovered ? "rgba(0,207,255,0.07)" : "transparent",
        border: `1px solid ${hovered ? "rgba(0,207,255,0.2)" : "transparent"}`,
        display: "flex", alignItems: "center", gap: "9px",
        cursor: "pointer", transition: "all 0.12s", marginBottom: "2px",
      }}
    >
      <span style={{
        color: statusDotColor(raw), fontSize: "8px", flexShrink: 0,
        filter: hovered ? `drop-shadow(0 0 4px ${statusDotColor(raw)})` : "none",
        transition: "filter 0.15s",
      }}>●</span>
      <span style={{
        fontFamily: "'Share Tech', monospace", fontSize: "12.5px",
        color: hovered ? "#fff" : "rgba(255,255,255,0.65)",
        letterSpacing: "0.3px", flex: 1,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        transition: "color 0.12s",
      }}>{name}</span>
      {hovered && (
        <span style={{
          fontFamily: "'Share Tech', monospace", fontSize: "9px",
          color: "rgba(0,207,255,0.5)", letterSpacing: "1px", flexShrink: 0,
        }}>{statusLabel(raw)}</span>
      )}
    </div>
  );
}