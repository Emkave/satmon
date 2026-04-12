export default function VersionBadge({ version }) {
  if (!version) 
    return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "12px",
      left: "12px",
      fontFamily: "'Courier New', monospace",
      fontSize: "10px",
      color: "rgba(255,255,255,0.5)",
      letterSpacing: "1.5px",
      textTransform: "uppercase",
      zIndex: 500,
      pointerEvents: "none",
      userSelect: "none",
    }}>
      v{version}
    </div>
  );
}