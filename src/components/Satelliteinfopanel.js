import { useEffect, useState, useRef } from "react";

const FIELD_LABELS = {
  name: "Name",
  noradId: "NORAD ID",
  intlDesignator: "Intl. Designator",
  country: "Country",
  launchDate: "Launch Date",
  launchSite: "Launch Site",
  decayDate: "Decay Date",
  objectType: "Object Type",
  periodMin: "Orbital Period",
  inclination: "Inclination",
  apogeeKm: "Apogee",
  perigeeKm: "Perigee",
  tle1: "TLE Line 1",
  tle2: "TLE Line 2",
  rcsSize: "Radar Cross-Section",
  // UCS fields
  officialName: "Official Name",
  countryUCS: "Country (UCS)",
  owner: "Operator/Owner",
  users: "Users",
  purpose: "Purpose",
  detailedPurpose: "Detailed Purpose",
  orbitClass: "Orbit Class",
  orbitType: "Orbit Type",
  manufacturer: "Manufacturer",
  massKg: "Launch Mass (kg)",
  dryMassKg: "Dry Mass (kg)",
  powerW: "Power (W)",
  lifetime: "Expected Lifetime",
  contractor: "Launch Contractor",
  launchVehicle: "Launch Vehicle",
  sourceUCS: "Source (UCS)",
  sourceSatcat: "Source (SATCAT)",
};

function Row({label, value}) {
  if (!value || value === "" || value === "N/A") {
    return null;
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "120px 1fr",
      gap: "6px",
      padding: "5px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <span style={{
        color: "#00cfff",
        fontSize: "12px",
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
        fontSize: "12px",
        fontFamily: "'Share Tech', 'Courier New', monospace",
        lineHeight: "1.4",
        wordBreak: "break-word",
      }}>
        {value}
      </span>
    </div>
  );
}

function openDetailPage(satellite) {
  const params = new URLSearchParams();
  const fields = Object.keys(FIELD_LABELS);
  fields.forEach(key => {
    const val = satellite[key];
    if (val !== null && val !== undefined && val !== "" && val !== "N/A") {
      params.set(key, String(val));
    }
  });
  const url = `${process.env.PUBLIC_URL || ""}/info.html?${params.toString()}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function SatelliteInfoPanel({satellite, onClose}) {
  const [visible, setVisible] = useState(false);
  // Keep a snapshot of the last satellite so we can still render during exit animation
  const lastSatRef = useRef(null);
  const [displayedSat, setDisplayedSat] = useState(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    // Clear any pending close timer when satellite changes
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (satellite) {
      // New satellite selected — update displayed data immediately and animate in
      lastSatRef.current = satellite;
      setDisplayedSat(satellite);
      setVisible(false);
      const t = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(t);
    } else {
      // Satellite deselected — animate out first, then unmount
      setVisible(false);
      closeTimerRef.current = setTimeout(() => {
        setDisplayedSat(null);
        lastSatRef.current = null;
      }, 280); // slightly longer than the 0.25s CSS transition
      return () => {
        if (closeTimerRef.current) 
          clearTimeout(closeTimerRef.current);
      };
    }
  }, [satellite]);

  if (!displayedSat) {
    return null;
  }

  const d = displayedSat;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        width: "320px",
        maxHeight: "80vh",
        background: "rgba(8, 16, 28, 0.82)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(0, 207, 255, 0.25)",
        borderRadius: "10px",
        overflowY: "auto",
        zIndex: 1000,
        boxShadow: "0 0 40px rgba(0,207,255,0.08), 0 8px 32px rgba(0,0,0,0.6)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(30px)",
        transition: "opacity 0.25s ease, transform 0.25s ease",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(0,207,255,0.3) transparent",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "14px 16px 10px",
        borderBottom: "1px solid rgba(0,207,255,0.15)",
        position: "sticky",
        top: 0,
        background: "rgba(8, 16, 28, 0.95)",
        backdropFilter: "blur(12px)",
        zIndex: 1,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "8px",
      }}>
        <div>
          <div style={{
            fontSize: "20px",
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
            fontSize: "17px",
            fontWeight: "bold",
            color: "#ffffff",
            fontFamily: "'Share Tech', 'Courier New', monospace",
            lineHeight: "1.3",
          }}>
            {d.officialName || d.name}
          </div>
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
              fontSize: "14px",
            }}
          >
            ×
          </button>
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
              fontSize: "14px",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,207,255,0.18)"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.55)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,207,255,0.08)"; e.currentTarget.style.borderColor = "rgba(0,207,255,0.25)"; }}
          >
            ↗
          </button>
        </div>
      </div>

      <div style={{padding: "10px 16px 16px"}}>
        <SectionHeader label="Identity" />
        <Row label={FIELD_LABELS.name} value={d.name} />
        <Row label={FIELD_LABELS.noradId} value={d.noradId} />
        <Row label={FIELD_LABELS.intlDesignator} value={d.intlDesignator} />
        <Row label={FIELD_LABELS.objectType} value={d.objectType} />

        <SectionHeader label="Mission" />
        <Row label={FIELD_LABELS.purpose} value={d.purpose} />
        <Row label={FIELD_LABELS.detailedPurpose} value={d.detailedPurpose} />
        <Row label={FIELD_LABELS.users} value={d.users} />

        <SectionHeader label="Ownership" />
        <Row label={FIELD_LABELS.owner} value={d.owner} />
        <Row label={FIELD_LABELS.country} value={d.country} />
        <Row label={FIELD_LABELS.countryUCS} value={d.countryUCS !== d.country ? d.countryUCS : null} />
        <Row label={FIELD_LABELS.manufacturer} value={d.manufacturer} />
        <Row label={FIELD_LABELS.contractor} value={d.contractor} />

        <SectionHeader label="Launch" />
        <Row label={FIELD_LABELS.launchDate} value={d.launchDate} />
        <Row label={FIELD_LABELS.launchSite} value={d.launchSite} />
        <Row label={FIELD_LABELS.launchVehicle} value={d.launchVehicle} />
        <Row label={FIELD_LABELS.decayDate} value={d.decayDate} />

        <SectionHeader label="Physical" />
        <Row label={FIELD_LABELS.massKg} value={d.massKg} />
        <Row label={FIELD_LABELS.dryMassKg} value={d.dryMassKg} />
        <Row label={FIELD_LABELS.powerW} value={d.powerW} />
        <Row label={FIELD_LABELS.lifetime} value={d.lifetime} />
        <Row label={FIELD_LABELS.rcsSize} value={d.rcsSize} />

        <SectionHeader label="Orbit" />
        <Row label={FIELD_LABELS.orbitClass} value={d.orbitClass} />
        <Row label={FIELD_LABELS.orbitType} value={d.orbitType} />
        <Row label={FIELD_LABELS.periodMin} value={d.periodMin ? `${d.periodMin} min` : null} />
        <Row label={FIELD_LABELS.inclination} value={d.inclination ? `${d.inclination}°` : null} />
        <Row label={FIELD_LABELS.apogeeKm} value={d.apogeeKm ? `${d.apogeeKm} km` : null} />
        <Row label={FIELD_LABELS.perigeeKm} value={d.perigeeKm ? `${d.perigeeKm} km` : null} />


      </div>
    </div>
  );
}

function SectionHeader({ label }) {
  return (
    <div style={{
      marginTop: "12px",
      marginBottom: "4px",
      fontSize: "13px",
      color: "rgba(0,207,255,0.5)",
      fontFamily: "'Share Tech', 'Courier New', monospace",
      textTransform: "uppercase",
      letterSpacing: "2px",
      borderBottom: "1px solid rgba(0,207,255,0.1)",
      paddingBottom: "3px",
    }}>
      {label}
    </div>
  );
}