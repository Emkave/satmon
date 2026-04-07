import { useState, useRef, useEffect } from "react";

export default function Sidebar({ satelliteCount, setSatelliteCount, satelliteNames = [], flyToRef }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  useEffect(() => {
    setSearchQuery("");
  }, [active]);

  const visibleNames = satelliteNames.slice(0, satelliteCount >= satelliteNames.length ? undefined : satelliteCount);
  const filteredNames = searchQuery.trim().length === 0
    ? visibleNames
    : visibleNames.filter(name => {
        const q = searchQuery.toUpperCase();
        const n = name.toUpperCase();
        return n.startsWith(q) || n.split(/[\s\-_]/).some(w => w.startsWith(q));
      }).slice(0, 80);

  const PANEL_WIDTH = 260;
  const HANDLE_WIDTH = 30;

  const titles = {
    null: "Menu",
    settings: "Settings",
    catalog: "Satellite Catalog",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: open ? "0px" : `-${PANEL_WIDTH}px`,
        width: `${PANEL_WIDTH}px`,
        height: "100vh",
        background: "#111",
        color: "white",
        padding: "20px",
        fontFamily: "'Courier New', monospace",
        boxSizing: "border-box",
        zIndex: 999,
        transition: "left 0.3s ease",
        overflow: "visible",
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        style={{
          position: "absolute",
          right: `-${HANDLE_WIDTH}px`,
          top: "50%",
          transform: "translateY(-50%)",
          width: `${HANDLE_WIDTH}px`,
          height: "80px",
          background: "#222",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          borderTopRightRadius: "8px",
          borderBottomRightRadius: "8px",
        }}
      >
        {open ? "◀" : "▶"}
      </div>

      <h2 style={{
        fontFamily: "'Courier New', monospace",
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "2px",
        color: "#00cfff",
        marginTop: "4px",
        marginBottom: "0",
        opacity: 0.85,
      }}>{titles[active]}</h2>

      {active === null && (
        <div style={{ marginTop: "20px" }}>
          <button style={btn} onClick={() => setActive("catalog")}
            onMouseEnter={e => { e.currentTarget.style.background = "#222"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.borderColor = "#2a2a2a"; }}
          >🛰 Satellite Catalog</button>

          <button style={btn} onClick={() => setActive("settings")}
            onMouseEnter={e => { e.currentTarget.style.background = "#222"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.borderColor = "#2a2a2a"; }}
          >⚙ Settings</button>
        </div>
      )}

      {active === "settings" && (() => {
        const total = satelliteNames.length;
        const isMax = satelliteCount >= total;
        const setMax = () => setSatelliteCount(total);
        const handleDisplayEdit = (e) => {
          const raw = parseInt(e.target.value.replace(/,/g, ""));
          if (isNaN(raw)) return;
          setSatelliteCount(Math.max(0, Math.min(total, raw)));
        };

        const startHold = (dir) => {
          let step = 1;
          let delay = 150;
          let timeoutId;

          const tick = () => {
            setSatelliteCount(c => Math.max(0, Math.min(total, c + dir * step)));
            step = Math.min(step + Math.floor(step * 0.3) + 1, 500);
            delay = Math.max(30, delay * 0.85);
            timeoutId = setTimeout(tick, delay);
          };

          timeoutId = setTimeout(tick, 400); // initial delay before ramp starts

          const stop = () => clearTimeout(timeoutId);
          window.addEventListener("mouseup", stop, { once: true });
          window.addEventListener("mouseleave", stop, { once: true });
        };

        return (
          <div style={{ marginTop: "20px" }}>
            <label style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#00cfff" }}>
              Number of Satellites:
            </label>

            {/* Value display — editable */}
            <input
              type="number"
              min="0"
              max={total}
              value={isMax ? total : satelliteCount}
              onChange={handleDisplayEdit}
              style={{
                marginTop: "10px",
                width: "100%",
                padding: "10px 14px",
                background: "#0d0d0d",
                border: `1px solid ${isMax ? "rgba(0,207,255,0.4)" : "rgba(0,207,255,0.2)"}`,
                borderRadius: "6px",
                textAlign: "center",
                fontFamily: "'Courier New', monospace",
                fontSize: "22px",
                fontWeight: "bold",
                color: isMax ? "#00cfff" : "#ffffff",
                letterSpacing: "2px",
                textShadow: isMax ? "0 0 12px rgba(0,207,255,0.5)" : "none",
                transition: "color 0.2s, text-shadow 0.2s, border-color 0.2s",
                boxSizing: "border-box",
                outline: "none",
                MozAppearance: "textfield",
              }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button
                onClick={() => setSatelliteCount(c => Math.max(0, c - 1))}
                onMouseDown={() => startHold(-1)}
                disabled={satelliteCount === 0}
                style={{ ...ctrlBtn, opacity: satelliteCount === 0 ? 0.3 : 1, cursor: satelliteCount === 0 ? "default" : "pointer" }}
                onMouseEnter={e => { if (satelliteCount > 0) { e.currentTarget.style.background = "#222"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.3)"; e.currentTarget.style.color = "#fff"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#ccc"; }}
              >−</button>

              <button
                onClick={() => setSatelliteCount(c => Math.min(total, c + 1))}
                onMouseDown={() => startHold(1)}
                disabled={isMax}
                style={{ ...ctrlBtn, opacity: isMax ? 0.3 : 1, cursor: isMax ? "default" : "pointer" }}
                onMouseEnter={e => { if (!isMax) { e.currentTarget.style.background = "#222"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.3)"; e.currentTarget.style.color = "#fff"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#ccc"; }}
              >+</button>

              <button
                onClick={setMax}
                style={{
                  ...ctrlBtn,
                  flex: 1,
                  fontSize: "10px",
                  letterSpacing: "2px",
                  background: isMax ? "rgba(0,207,255,0.08)" : "#1a1a1a",
                  borderColor: isMax ? "rgba(0,207,255,0.4)" : "#2a2a2a",
                  color: isMax ? "#00cfff" : "#ccc",
                  cursor: isMax ? "default" : "pointer",
                  textShadow: isMax ? "0 0 8px rgba(0,207,255,0.4)" : "none",
                }}
                onMouseEnter={e => { if (!isMax) { e.currentTarget.style.background = "#222"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.3)"; e.currentTarget.style.color = "#fff"; } }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isMax ? "rgba(0,207,255,0.08)" : "#1a1a1a";
                  e.currentTarget.style.borderColor = isMax ? "rgba(0,207,255,0.4)" : "#2a2a2a";
                  e.currentTarget.style.color = isMax ? "#00cfff" : "#ccc";
                }}
              >MAX</button>
            </div>

            <style>{`
              input[type=number]::-webkit-inner-spin-button,
              input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
              input[type=number] { -moz-appearance: textfield; }
              input[type=number]:focus { border-color: rgba(0,207,255,0.5) !important; box-shadow: 0 0 0 2px rgba(0,207,255,0.08); }
            `}</style>

            <button
              style={{ ...btn, marginTop: "20px" }}
              onClick={() => setActive(null)}
              onMouseEnter={e => { e.currentTarget.style.background = "#222"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.borderColor = "#2a2a2a"; }}
            >
              ⬅ Back
            </button>
          </div>
        );
      })()}

      {active === "catalog" && (
        <div style={{ marginTop: "20px" }}>
          {/* Count badge */}
          <div style={{
            background: "#1a1a1a",
            borderRadius: "8px",
            padding: "8px 12px",
            marginBottom: "10px",
            color: "#00cfff",
            fontSize: "11px",
            fontWeight: "bold",
            letterSpacing: "1px",
            fontFamily: "'Courier New', monospace",
            textTransform: "uppercase",
          }}>
            🛰 {satelliteCount >= satelliteNames.length ? "All" : satelliteCount} loaded
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter satellites..."
            style={{
              width: "100%",
              padding: "7px 10px",
              marginBottom: "10px",
              background: "#0d0d0d",
              border: "1px solid rgba(0,207,255,0.2)",
              borderRadius: "6px",
              color: "#fff",
              fontFamily: "'Courier New', monospace",
              fontSize: "11px",
              outline: "none",
              boxSizing: "border-box",
              letterSpacing: "0.5px",
              transition: "border-color 0.15s",
            }}
            onFocus={e => { e.target.style.borderColor = "rgba(0,207,255,0.6)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(0,207,255,0.2)"; }}
          />

          <div style={{
            border: "1px solid rgba(0,207,255,0.18)",
            borderRadius: "8px",
            background: "rgba(0,207,255,0.03)",
            boxShadow: "inset 0 0 20px rgba(0,207,255,0.04), 0 0 0 1px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}>

          <div style={{
            maxHeight: "calc(100vh - 230px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "6px",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0,207,255,0.2) transparent",
          }}>
            {searchQuery.trim().length > 0 && filteredNames.length === 0 ? (
              <div style={{
                color: "rgba(255,255,255,0.25)",
                fontFamily: "'Courier New', monospace",
                fontSize: "11px",
                textAlign: "center",
                padding: "20px 0",
                letterSpacing: "0.5px",
              }}>No matches found</div>
            ) : filteredNames.map((name, i) => (
              <div key={i}
                onClick={() => flyToRef?.current?.(name)}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "11px",
                  color: "#ccc",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: "0.3px",
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "#222";
                  e.currentTarget.style.borderColor = "rgba(0,207,255,0.3)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "#1a1a1a";
                  e.currentTarget.style.borderColor = "#2a2a2a";
                }}
              >
                <span style={{ color: "#00cfff" }}>●</span>
                {name}
              </div>
            ))}
          </div>
          </div>

          <button
            style={{ ...btn, marginTop: "16px" }}
            onClick={() => setActive(null)}
            onMouseEnter={e => { e.currentTarget.style.background = "#222"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.borderColor = "#2a2a2a"; }}
          >
            ⬅ Back
          </button>
        </div>
      )}
    </div>
  );
}

const btn = {
  display: "block",
  width: "100%",
  margin: "10px 0",
  padding: "10px 12px",
  background: "#1a1a1a",
  color: "#ccc",
  border: "1px solid #2a2a2a",
  cursor: "pointer",
  borderRadius: "6px",
  fontFamily: "'Courier New', monospace",
  fontSize: "12px",
  textAlign: "left",
  letterSpacing: "0.5px",
  transition: "background 0.15s, border-color 0.15s",
};

const ctrlBtn = {
  flex: 1,
  padding: "10px 0",
  background: "#1a1a1a",
  color: "#ccc",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  fontFamily: "'Courier New', monospace",
  fontSize: "16px",
  fontWeight: "bold",
  textAlign: "center",
  transition: "background 0.15s, border-color 0.15s, color 0.15s",
};