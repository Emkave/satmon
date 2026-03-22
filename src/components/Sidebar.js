import { useState } from "react";

export default function Sidebar({satelliteCount, setSatelliteCount}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  const PANEL_WIDTH = 260;
  const HANDLE_WIDTH = 30;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: open
          ? "0px"
          : `-${PANEL_WIDTH}px`,
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

      <h2>Menu</h2>

      <div style={{ marginTop: "20px" }}>
        <button style={btn}>🛰 Satellite Catalog</button>
        <button style={btn}>🔍 Search</button>
        <button style={btn} onClick={() => setActive("settings")}>
          ⚙ Settings
        </button>
      </div>

      {active === "settings" && (
        <div style={{ marginTop: "20px" }}>
          <label>Number of Satellites:</label>

          <input
            type="number"
            min="0"
            max="10000"
            value={satelliteCount}
            onChange={(e) => {
              let value = parseInt(e.target.value) || 0;

              if (value > 10000) value = 10000;
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
              color: "white"
            }}
          />
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