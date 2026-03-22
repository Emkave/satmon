import { useState } from "react";

export default function Sidebar() {
  const [open, setOpen] = useState(false);

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
        <button style={btn}>⚙ Settings</button>
      </div>
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