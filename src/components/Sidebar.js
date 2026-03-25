import { useState } from "react";

export default function Sidebar({ satelliteCount, setSatelliteCount, satelliteNames = []}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

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

      <h2>{titles[active]}</h2>

      {active === null && (
        <div style={{ marginTop: "20px" }}>
          <button style={btn} onClick={() => setActive("catalog")}>🛰 Satellite Catalog</button>
          <button style={btn}>🔍 Search</button>
          <button style={btn} onClick={() => setActive("settings")}>⚙ Settings</button>
        </div>
      )}

      {active === "settings" && (
        <div style={{ marginTop: "20px" }}>
          <label>Number of Satellites:</label>
          <input
            type="number"
            min="0"
            value={satelliteCount > 10000 ? "" : satelliteCount}
            placeholder={satelliteCount > 10000 ? "max" : ""}
            onChange={(e) => {
              let value = parseInt(e.target.value);
              if (isNaN(value)) {
                setSatelliteCount(10000);
                return;
              }
              if (value < 0) value = 0;
              setSatelliteCount(value);
            }}
            style={{
              width: "100%",
              padding: "8px",
              marginTop: "10px",
              borderRadius: "6px",
              border: "1px solid #444",
              background: "#222",
              color: satelliteCount > 10000 ? "#666" : "white",
            }}
          />
          <button
            style={{ ...btn, marginTop: "20px", background: "#333" }}
            onClick={() => setActive(null)}
          >
            ⬅ Back
          </button>
        </div>
      )}

      {active === "catalog" && (
        <div style={{ marginTop: "20px" }}>
          <div style={{
            background: "#1a1a1a",
            borderRadius: "8px",
            padding: "8px 12px",
            marginBottom: "12px",
            color: "#00cfff",
            fontSize: "13px",
            fontWeight: "bold",
            letterSpacing: "0.5px",
          }}>
            🛰 {satelliteCount > 10000 ? "All" : satelliteCount} satellites loaded
          </div>

          <div style={{
            maxHeight: "calc(100vh - 180px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}>
            {satelliteNames.slice(0, satelliteCount > 10000 ? undefined : satelliteCount).map((name, i) => (
              <div key={i} style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                padding: "8px 12px",
                fontSize: "12px",
                color: "#ccc",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
                <span style={{ color: "#00cfff" }}>●</span>
                {name}
              </div>
            ))}
          </div>

          <button
            style={{ ...btn, marginTop: "16px", background: "#333" }}
            onClick={() => setActive(null)}
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
  padding: "10px",
  background: "#222",
  color: "white",
  border: "none",
  cursor: "pointer",
  borderRadius: "5px",
};