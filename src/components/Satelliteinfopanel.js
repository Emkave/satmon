import { useEffect, useState, useRef } from "react";

function openDetailPage(d) {
  const params = new URLSearchParams();

  const TOP_FIELDS = [
    "name","noradId","intlDesignator","cosparID","officialName","objectType",
    "opsStatus","opsStatusRaw","dataStatus","orbitCenter","orbitTypeSat",
    "country","countryCode","countryUCS","countryOperator","countryContractor",
    "owner","manufacturer","contractor","users","purpose","detailedPurpose","comments",
    "launchDate","launchDateUCS","launchSite","launchSiteUCS","launchVehicle","decayDate",
    "massKg","dryMassKg","powerW","lifetime","dateOfEOL","rcsM2",
    "orbitClass","orbitType","lonGEO","periodMin","inclination","apogeeKm","perigeeKm",
    "apogeeUCS","perigeeUCS","inclinationUCS","periodUCS",
    "tle1","tle2","sourceSatcat","sourceUCS",
  ];

  TOP_FIELDS.forEach(key => {
    const v = d[key];
    if (v != null && v !== "" && v !== "N/A") params.set(key, String(v));
  });

  if (d.tleDerived) {
    Object.entries(d.tleDerived).forEach(([k, v]) => {
      if (k === "_satrec") return;
      if (v != null && v !== "" && v !== "N/A") params.set(k, String(v));
    });
  }

  const url = `${process.env.PUBLIC_URL || ""}/info.html?${params.toString()}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function Row({ label, value }) {
  if (!value || value === "" || value === "N/A") return null;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "120px 1fr",
      gap: "6px",
      padding: "6px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <span style={{
        color: "#00cfff",
        fontSize: "13.8px",
        fontFamily: "'Share Tech', 'Courier New', monospace",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        lineHeight: "1.4",
        paddingTop: "1px",
      }}>
        {label}
      </span>
      <span style={{
        color: "#e8e8e8",
        fontSize: "13.8px",
        fontFamily: "'Share Tech', 'Courier New', monospace",
        lineHeight: "1.4",
        wordBreak: "break-word",
      }}>
        {value}
      </span>
    </div>
  );
}

export default function SatelliteInfoPanel({ satellite, onClose }) {
  const [visible, setVisible] = useState(false);
  const lastSatRef = useRef(null);
  const [displayedSat, setDisplayedSat] = useState(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (satellite) {
      lastSatRef.current = satellite;
      setDisplayedSat(satellite);
      setVisible(false);
      const t = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      closeTimerRef.current = setTimeout(() => {
        setDisplayedSat(null);
        lastSatRef.current = null;
      }, 280);
      return () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      };
    }
  }, [satellite]);

  if (!displayedSat) return null;

  const d = displayedSat;
  const td = d.tleDerived || {};
  const displayName = d.officialName || d.name;

  return (
    <div style={{
      position: "fixed",
      top: "20px",
      right: "20px",
      width: "320px",
      background: "rgba(8, 16, 28, 0.82)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(0, 207, 255, 0.25)",
      borderRadius: "10px",
      zIndex: 1000,
      boxShadow: "0 0 40px rgba(0,207,255,0.08), 0 8px 32px rgba(0,0,0,0.6)",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateX(0)" : "translateX(30px)",
      transition: "opacity 0.25s ease, transform 0.25s ease",
    }}>

      {/* Header */}
      <div style={{
        padding: "14px 16px 10px",
        borderBottom: "1px solid rgba(0,207,255,0.15)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "8px",
      }}>
        <div>
          <div style={{
            fontSize: "23px",
            color: "#00cfff",
            fontFamily: "'Share Tech', 'Courier New', monospace",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            marginBottom: "4px",
            opacity: 0.7,
          }}>
            🛰 Satellite Info
          </div>
          <div style={{
            fontSize: "19.6px",
            fontWeight: "bold",
            color: "#ffffff",
            fontFamily: "'Share Tech', 'Courier New', monospace",
            lineHeight: "1.3",
          }}>
            {displayName}
          </div>
          {d.name && d.name !== displayName && (
            <div style={{
              fontSize: "12.7px",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "'Share Tech', 'Courier New', monospace",
              marginTop: "2px",
            }}>
              {d.name}
            </div>
          )}
          {d.opsStatus && (
            <div style={{
              display: "inline-block",
              marginTop: "6px",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "11.5px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              fontFamily: "'Share Tech', 'Courier New', monospace",
              background: d.opsStatusRaw === "+" ? "rgba(57,255,20,0.12)" :
                          d.opsStatusRaw === "D" ? "rgba(255,60,60,0.12)" :
                                                   "rgba(255,200,0,0.10)",
              color: d.opsStatusRaw === "+" ? "#39ff14" :
                     d.opsStatusRaw === "D" ? "#ff4455" : "#ffcc00",
              border: `1px solid ${d.opsStatusRaw === "+" ? "rgba(57,255,20,0.3)" :
                                   d.opsStatusRaw === "D" ? "rgba(255,60,60,0.3)" :
                                                            "rgba(255,200,0,0.25)"}`,
            }}>
              {d.opsStatus}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0, marginTop: "2px" }}>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#aaa",
              borderRadius: "6px",
              width: "26px",
              height: "26px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "16.1px",
            }}
          >×</button>
          <button
            onClick={() => openDetailPage(d)}
            title="Open full detail page"
            style={{
              background: "rgba(0,207,255,0.08)",
              border: "1px solid rgba(0,207,255,0.25)",
              color: "#00cfff",
              borderRadius: "6px",
              width: "26px",
              height: "26px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "16.1px",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,207,255,0.18)"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.55)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,207,255,0.08)"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.25)"; }}
          >↗</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "10px 16px 16px" }}>
        <Row label="NORAD ID"    value={d.noradId} />
        <Row label="Country"     value={d.country} />
        <Row label="Launch Date" value={d.launchDate} />
        <Row label="Period"      value={d.periodMin ? d.periodMin + " min" : td.periodMin} />
        <Row label="Altitude"    value={td.liveAltKm} />
      </div>
    </div>
  );
}