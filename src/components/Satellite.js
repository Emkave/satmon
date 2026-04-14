import { useCallback, useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import * as satellite from "satellite.js";

// ─── CSV helper ───────────────────────────────────────────────────────────────
function splitCSVLine(line) {
  const result = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// ─── Country codes ────────────────────────────────────────────────────────────
const SATCAT_COUNTRY_CODES = {
  AB:"Arab Satellite Communications Organization",ABS:"Asia Broadcast Satellite",
  AC:"Asia Satellite Telecommunications (ASIASAT)",ALG:"Algeria",ANG:"Angola",
  ARGN:"Argentina",ARM:"Armenia",ASRA:"Austria",AUS:"Australia",AZER:"Azerbaijan",
  BEL:"Belgium",BELA:"Belarus",BERM:"Bermuda",BGD:"Bangladesh",BHR:"Bahrain",
  BHUT:"Bhutan",BOL:"Bolivia",BRAZ:"Brazil",BUL:"Bulgaria",BWA:"Botswana",
  CA:"Canada",CHBZ:"China / Brazil",CHTU:"China / Turkey",CHLE:"Chile",
  CIS:"Russia / Commonwealth of Independent States",COL:"Colombia",CRI:"Costa Rica",
  CZCH:"Czechia",DEN:"Denmark",DJI:"Djibouti",ECU:"Ecuador",EGYP:"Egypt",
  ESA:"European Space Agency",ESRO:"European Space Research Organization",EST:"Estonia",
  ETH:"Ethiopia",EUME:"EUMETSAT",EUTE:"EUTELSAT",FGER:"France / Germany",FIN:"Finland",
  FR:"France",FRIT:"France / Italy",GER:"Germany",GHA:"Ghana",GLOB:"Globalstar",
  GREC:"Greece",GRSA:"Greece / Saudi Arabia",GUAT:"Guatemala",HRV:"Croatia",
  HUN:"Hungary",IM:"INMARSAT",IND:"India",INDO:"Indonesia",IRAN:"Iran",IRAQ:"Iraq",
  IRID:"Iridium",IRL:"Ireland",ISRA:"Israel",ISRO:"Indian Space Research Organisation",
  ISS:"International Space Station",IT:"Italy",ITSO:"INTELSAT",JPN:"Japan",
  KAZ:"Kazakhstan",KEN:"Kenya",LAOS:"Laos",LKA:"Sri Lanka",LTU:"Lithuania",
  LUXE:"Luxembourg",MA:"Morocco",MALA:"Malaysia",MCO:"Monaco",MDA:"Moldova",
  MEX:"Mexico",MMR:"Myanmar",MNE:"Montenegro",MNG:"Mongolia",MUS:"Mauritius",
  NATO:"NATO",NETH:"Netherlands",NICO:"New ICO",NIG:"Nigeria",NKOR:"North Korea",
  NOR:"Norway",NPL:"Nepal",NZ:"New Zealand",O3B:"O3b Networks",ORB:"ORBCOMM",
  PAKI:"Pakistan",PERU:"Peru",POL:"Poland",POR:"Portugal",PRC:"People's Republic of China",
  PRY:"Paraguay",PRES:"China / European Space Agency",QAT:"Qatar",
  RASC:"RascomStar-QAF",ROC:"Taiwan",ROM:"Romania",RP:"Philippines",RWA:"Rwanda",
  SAFR:"South Africa",SAUD:"Saudi Arabia",SDN:"Sudan",SEAL:"Sea Launch",SEN:"Senegal",
  SES:"SES",SGJP:"Singapore / Japan",SING:"Singapore",SKOR:"South Korea",
  SLB:"Solomon Islands",SPN:"Spain",STCT:"Singapore / Taiwan",SVN:"Slovenia",
  SWED:"Sweden",SWTZ:"Switzerland",TBD:"To Be Determined",THAI:"Thailand",
  TMMC:"Turkmenistan / Monaco",TUN:"Tunisia",TURK:"Turkey",UAE:"United Arab Emirates",
  UK:"United Kingdom",UKR:"Ukraine",UNK:"Unknown",URY:"Uruguay",US:"United States",
  USBZ:"United States / Brazil",VAT:"Vatican City",VENZ:"Venezuela",VTNM:"Vietnam",
  ZWE:"Zimbabwe",
};

function resolveCountry(code) {
  if (!code) return "";
  return SATCAT_COUNTRY_CODES[code.trim().toUpperCase()] || code;
}

// ─── Operational status codes ─────────────────────────────────────────────────
const OPS_STATUS_CODES = {
  "+": "Operational",
  "-": "Non-operational",
  "P": "Partially operational",
  "B": "Backup / standby",
  "S": "Spare",
  "X": "Extended mission",
  "D": "Decayed",
  "?": "Unknown",
};

function resolveOpsStatus(code) {
  if (!code) return "";
  const t = code.trim();
  return OPS_STATUS_CODES[t] ? OPS_STATUS_CODES[t] : t;
}

// ─── TLE-derived Keplerian parameters ────────────────────────────────────────
export function computeTleDerived(satrec) {
  if (!satrec) return {};
  try {
    const R2D = 180 / Math.PI;
    const GM  = 398600.4418; // km³/s²
    const Re  = 6378.137;    // km

    const epochYear = satrec.epochyr < 57 ? 2000 + satrec.epochyr : 1900 + satrec.epochyr;
    const epochMs   = Date.UTC(epochYear, 0, 1) + (satrec.epochdays - 1) * 86_400_000;
    const epochDate = new Date(epochMs).toISOString().replace("T", " ").slice(0, 19) + " UTC";

    const mmRevDay  = satrec.no * 60 * 24 / (2 * Math.PI);
    const periodMin = mmRevDay > 0 ? (1440 / mmRevDay) : null;

    const n_rad_s   = satrec.no / 60;
    const smaKm     = Math.pow(GM / (n_rad_s * n_rad_s), 1 / 3);
    const apogeeKm  = smaKm * (1 + satrec.ecco) - Re;
    const perigeeKm = smaKm * (1 - satrec.ecco) - Re;

    // Live position snapshot
    const now = new Date();
    const pv  = satellite.propagate(satrec, now);
    let altKm = null, latDeg = null, lonDeg = null, velocityKms = null;
    if (pv?.position) {
      const gmst = satellite.gstime(now);
      const geo  = satellite.eciToGeodetic(pv.position, gmst);
      latDeg = geo.latitude  * R2D;
      lonDeg = geo.longitude * R2D;
      altKm  = geo.height;
      if (pv.velocity) {
        const v = pv.velocity;
        velocityKms = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
      }
    }

    return {
      tleEpochDate:     epochDate,
      tleEpochDay:      satrec.epochdays?.toFixed(8),
      meanMotionRevDay: mmRevDay.toFixed(8) + " rev/day",
      meanMotionDegMin: (satrec.no * R2D * 60).toFixed(8) + " °/min",
      periodMin:        periodMin ? periodMin.toFixed(4) + " min" : null,
      inclinationTle:   (satrec.inclo * R2D).toFixed(6) + "°",
      eccentricity:     satrec.ecco.toFixed(7),
      raan:             (satrec.nodeo * R2D).toFixed(4) + "°",
      argPerigee:       (satrec.argpo * R2D).toFixed(4) + "°",
      meanAnomaly:      (satrec.mo    * R2D).toFixed(4) + "°",
      smaKm:            smaKm.toFixed(3) + " km",
      apogeeTle:        apogeeKm.toFixed(2) + " km",
      perigeeTle:       perigeeKm.toFixed(2) + " km",
      bstar:            satrec.bstar?.toExponential(5),
      elsetNum:         satrec.elnum  ? String(satrec.elnum)  : null,
      revNum:           satrec.revnum ? String(satrec.revnum) : null,
      ephemerisType:    satrec.ephtype != null ? String(satrec.ephtype) : null,
      liveAltKm:        altKm != null ? altKm.toFixed(2) + " km" : null,
      liveLatDeg:       latDeg != null ? latDeg.toFixed(4) + "°" : null,
      liveLonDeg:       lonDeg != null ? lonDeg.toFixed(4) + "°" : null,
      liveVelocityKms:  velocityKms != null ? velocityKms.toFixed(4) + " km/s" : null,
      _satrec: satrec,
    };
  } catch {
    return {};
  }
}

// ─── Database merge ───────────────────────────────────────────────────────────
function mergeDatabases(satcatMap, ucsMap) {
  const merged = {};
  Object.entries(satcatMap).forEach(([norad, sc]) => {
    const norm = String(parseInt(norad, 10));
    const ucs = ucsMap[norm] || ucsMap[norad] || ucsMap[sc.name?.trim().toUpperCase()] || null;
    merged[norm] = { ...sc, noradId: norm, ...(ucs || {}) };
  });
  return merged;
}

async function fetchSatcat(onStatus) {
  onStatus?.("Fetching satellite catalog (SATCAT)...");
  const res = await fetch("https://celestrak.org/pub/satcat.csv");
  const text = await res.text();
  onStatus?.("Parsing satellite catalog...");
  const lines = text.split("\n");
  const map = {};
  const firstCols = splitCSVLine(lines[0]);
  const startIdx = isNaN(parseInt(firstCols[2], 10)) ? 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 3) continue;
    const col = idx => cols[idx]?.trim().replace(/^"|"$/g, "") ?? "";
    const noradRaw = col(2);
    const norad = noradRaw ? String(parseInt(noradRaw, 10)) : "";
    if (!norad || norad === "NaN") continue;
    map[norad] = {
      noradId:      norad,
      name:         col(0),
      intlDesignator: col(1),
      objectType:   col(3),
      opsStatus:    resolveOpsStatus(col(4)),
      opsStatusRaw: col(4).trim(),
      country:      resolveCountry(col(5)),
      countryCode:  col(5).trim(),
      launchDate:   col(6),
      launchSite:   col(7),
      decayDate:    col(8),
      periodMin:    col(9),
      inclination:  col(10),
      apogeeKm:     col(11),
      perigeeKm:    col(12),
      rcsM2:        col(13),
      dataStatus:   col(14),
      orbitCenter:  col(15),
      orbitTypeSat: col(16),
      sourceSatcat: "Celestrak SATCAT",
    };
  }
  return map;
}

async function fetchUCS(onStatus) {
  onStatus?.("Fetching UCS satellite database...");
  const UCS_URL = "https://raw.githubusercontent.com/Emkave/satmon/main/public/UCS_Satellite_Database.csv";
  let text = "";
  try {
    const res = await fetch(UCS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch {
    onStatus?.("UCS database unavailable, continuing...");
    return {};
  }
  onStatus?.("Parsing UCS database...");
  const lines = text.split("\n");
  const header = splitCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ""));
  const byNorad = {}, byName = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 2) continue;
    const row = {};
    header.forEach((h, idx) => { row[h] = cols[idx]?.trim().replace(/^"|"$/g, "") ?? ""; });
    const entry = {
      officialName:      row["Name of Satellite, Alternate Names"] || row["Current Official Name of Satellite"] || "",
      countryUCS:        row["Country/Org of UN Registry"] || row["Country"] || "",
      countryOperator:   row["Country of Operator/Owner"] || "",
      countryContractor: row["Country of Contractor"] || "",
      owner:             row["Operator/Owner"] || row["Operator"] || "",
      users:             row["Users"] || "",
      purpose:           row["Purpose"] || "",
      detailedPurpose:   row["Detailed Purpose"] || "",
      comments:          row["Comments"] || "",
      orbitClass:        row["Class of Orbit"] || "",
      orbitType:         row["Type of Orbit"] || "",
      lonGEO:            row["Longitude of GEO (degrees)"] || row["Longitude of GEO"] || "",
      apogeeUCS:         row["Apogee (km)"] || "",
      perigeeUCS:        row["Perigee (km)"] || "",
      inclinationUCS:    row["Inclination (degrees)"] || "",
      periodUCS:         row["Period (minutes)"] || "",
      manufacturer:      row["Contractor"] || row["Manufacturer"] || "",
      massKg:            row["Launch Mass (kg.)"] || row["Launch Mass"] || "",
      dryMassKg:         row["Dry Mass (kg.)"] || row["Dry Mass"] || "",
      powerW:            row["Power (watts)"] || row["Power"] || "",
      lifetime:          row["Expected Lifetime (yrs.)"] || row["Expected Lifetime"] || "",
      dateOfEOL:         row["Date of Expected Lifetime"] || row["Date of EOL"] || "",
      contractor:        row["Launch Contractor"] || "",
      launchVehicle:     row["Launch Vehicle"] || "",
      launchSiteUCS:     row["Launch Site"] || "",
      launchDateUCS:     row["Date of Launch"] || "",
      cosparID:          row["COSPAR Number"] || row["COSPAR ID"] || "",
      sourceUCS:         "UCS Satellite Database",
    };
    const noradRaw = (row["NORAD Number"] || row["Norad Number"] || "").trim();
    const noradInt = parseInt(noradRaw, 10);
    const norad = !isNaN(noradInt) ? String(noradInt) : "";
    if (norad) byNorad[norad] = entry;
    if (entry.officialName) byName[entry.officialName.trim().toUpperCase()] = entry;
  }
  return Object.assign({}, byName, byNorad);
}

async function fetchWithProxies() {
  const sources = [
    { url: "https://raw.githubusercontent.com/Emkave/satmon/main/public/tle.txt", direct: true },
  ];
  for (const source of sources) {
    try {
      const res = await fetch(source.url, source.direct ? {} : { headers: { "x-requested-with": "XMLHttpRequest" } });
      if (!res.ok) continue;
      const text = await res.text();
      const tleCount = (text.match(/^1 \d/mg) || []).length;
      if (tleCount < 100) continue;
      return text;
    } catch (e) {
      console.warn("TLE source failed:", source.url, e.message);
    }
  }
  throw new Error("All TLE sources failed");
}

// ─── Orbit path (main thread, on demand) ─────────────────────────────────────
function computeOrbitPositions(satrec, steps = 360) {
  const meanMotionRadPerMin = satrec.no;
  const periodMin = meanMotionRadPerMin > 0 ? (2 * Math.PI) / meanMotionRadPerMin : 90;
  const now = new Date();
  const fixedGmst = satellite.gstime(now);
  const positions = [];
  for (let i = 0; i <= steps; i++) {
    const t = new Date(now.getTime() + (i / steps) * periodMin * 60 * 1000);
    const pv = satellite.propagate(satrec, t);
    if (!pv.position) continue;
    const ecef = satellite.eciToEcf(pv.position, fixedGmst);
    const x = ecef.x * 1000, y = ecef.y * 1000, z = ecef.z * 1000;
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
    positions.push(new Cesium.Cartesian3(x, y, z));
  }
  return positions;
}

// ─── Web Worker (inlined as a Blob URL) ──────────────────────────────────────
const WORKER_INTERVAL_MS = 1;

const WORKER_SOURCE = `
importScripts("https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js");

let satrecs = [];
let buf = null;

self.onmessage = (e) => {
  const { type } = e.data;

  if (type === "init") {
    satrecs = e.data.satrecs;
    buf = new Float64Array(satrecs.length * 3);
    setInterval(propagateAll, ${WORKER_INTERVAL_MS});
    propagateAll();
    return;
  }

  if (type === "buffer-return") {
    buf = new Float64Array(e.data.buffer);
    return;
  }
};

function propagateAll() {
  if (!satrecs.length || !buf) return;

  const now = new Date();
  const gmst = satellite.gstime(now);

  for (let i = 0; i < satrecs.length; i++) {
    const pv = satellite.propagate(satrecs[i], now);
    const base = i * 3;

    if (!pv || !pv.position) {
      buf[base] = NaN;
      continue;
    }

    const gd = satellite.eciToGeodetic(pv.position, gmst);
    buf[base]     = gd.longitude * (180 / Math.PI);
    buf[base + 1] = gd.latitude  * (180 / Math.PI);
    buf[base + 2] = gd.height * 1000;
  }

  const transfer = buf.buffer;
  buf = null;
  self.postMessage({ type: "positions", buffer: transfer }, [transfer]);
}
`;

function createPropagatorWorker() {
  const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
  const url  = URL.createObjectURL(blob);
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  return worker;
}

// ─── Orbit draw animation (PolylineCollection primitive, postRender-driven) ────
// Bypasses the entity system entirely — PolylineCollection gives direct GPU access
// with no entity dirty-tracking that can silently drop geometry on Windows/Chromium.
function animateOrbit(viewer, positions, orbitRef, animRef) {
  if (animRef.current) {
    viewer.scene.postRender.removeEventListener(animRef.current);
    animRef.current = null;
  }

  if (positions.length < 2) return;

  const TOTAL_FRAMES = 50;
  const step = Math.max(1, Math.ceil(positions.length / TOTAL_FRAMES));
  let revealed = Math.max(10, step);

  const collection = new Cesium.PolylineCollection();
  const line = collection.add({
    positions: positions.slice(0, revealed),
    width: 1,
    material: Cesium.Material.fromType("Color", {
      color: Cesium.Color.fromCssColorString("#505560").withAlpha(0.8),
    }),
  });
  viewer.scene.primitives.add(collection);

  // Store the collection so clearOrbit removes it from primitives (not entities)
  orbitRef.current = collection;

  const onFrame = () => {
    if (collection.isDestroyed()) { animRef.current = null; return; }
    if (revealed >= positions.length) {
      viewer.scene.postRender.removeEventListener(onFrame);
      animRef.current = null;
      return;
    }
    revealed = Math.min(revealed + step, positions.length);
    line.positions = positions.slice(0, revealed);
  };

  animRef.current = onFrame;
  viewer.scene.postRender.addEventListener(onFrame);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Satellite({
  viewer, maxSatellites, onLoaded, onSatelliteClick, onStatusUpdate, flyToRef,
}) {
  const satellitesRef = useRef([]);
  const collectionRef = useRef(null);
  const workerRef     = useRef(null);
  const metaRef       = useRef({});
  const orbitRef      = useRef(null);
  const orbitAnimRef  = useRef(null); // postRender listener handle for orbit draw animation
  const handlerRef    = useRef(null);
  const [loaded, setLoaded] = useState(false);

  // ── Orbit helpers ──────────────────────────────────────────────────────────
  const clearOrbit = useCallback(v => {
    if (orbitAnimRef.current) {
      v.scene.postRender.removeEventListener(orbitAnimRef.current);
      orbitAnimRef.current = null;
    }
    if (orbitRef.current) {
      if (!v.scene.primitives.isDestroyed()) {
        v.scene.primitives.remove(orbitRef.current);
      }
      orbitRef.current = null;
    }
  }, []);

  const drawOrbit = useCallback((v, sat) => {
    clearOrbit(v);
    const positions = computeOrbitPositions(sat.satrec);
    animateOrbit(v, positions, orbitRef, orbitAnimRef);
  }, [clearOrbit]);

  // ── Load TLE + metadata ────────────────────────────────────────────────────
  useEffect(() => {
    if (loaded) return;
    let cancelled = false;

    async function load() {
      onStatusUpdate?.("Fetching TLE orbital elements...");
      let tleText = null;
      try { tleText = await fetchWithProxies(); } catch (e) { console.warn(e); }
      if (!tleText || cancelled) { onStatusUpdate?.("All TLE sources failed."); return; }

      onStatusUpdate?.("Parsing orbital elements...");
      const lines = tleText.split("\n").map(l => l.trim()).filter(Boolean);
      const sats = [];
      for (let i = 0; i < lines.length; i++) {
        const tle1 = lines[i], tle2 = lines[i + 1];
        if (!tle1?.startsWith("1 ") || !tle2?.startsWith("2 ")) continue;
        const name = (i > 0 ? lines[i - 1] : "").replace(/^0 /, "").trim() || "UNKNOWN";
        try {
          const satrec  = satellite.twoline2satrec(tle1, tle2);
          const noradId = tle1.substring(2, 7).trim();
          sats.push({ name, satrec, noradId, tle1, tle2 });
          i += 1;
        } catch { continue; }
      }

      if (cancelled) return;
      onStatusUpdate?.(`Parsed ${sats.length.toLocaleString()} satellites. Loading metadata...`);

      let satcatMap = {}, ucsList = {};
      try { satcatMap = await fetchSatcat(onStatusUpdate); } catch (e) { console.warn(e); }
      if (cancelled) return;
      try { ucsList = await fetchUCS(onStatusUpdate); } catch { ucsList = {}; }
      if (cancelled) return;

      onStatusUpdate?.("Merging databases...");
      const mergedMeta = mergeDatabases(satcatMap, ucsList);

      onStatusUpdate?.("Computing orbital parameters...");
      sats.forEach(sat => {
        const norm = String(parseInt(sat.noradId, 10));
        if (mergedMeta[norm]) {
          mergedMeta[norm].tle1 = sat.tle1;
          mergedMeta[norm].tle2 = sat.tle2;
          mergedMeta[norm].tleDerived = computeTleDerived(sat.satrec);
        }
      });

      metaRef.current = mergedMeta;
      satellitesRef.current = sats;
      onLoaded?.(sats.map(s => {
        const norm = String(parseInt(s.noradId, 10));
        const raw  = mergedMeta[norm]?.opsStatusRaw?.trim() || "";
        return { name: s.name, opsStatusRaw: raw };
      }));
      setLoaded(true);
    }

    load();
    return () => { cancelled = true; };
  }, [loaded, onLoaded, onStatusUpdate]);

  // ── Build PointPrimitiveCollection + start Web Worker ─────────────────────
  useEffect(() => {
    if (!viewer || !loaded) return;

    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    if (collectionRef.current && !viewer.isDestroyed()) {
      viewer.scene.primitives.remove(collectionRef.current);
      collectionRef.current = null;
    }

    const sats = satellitesRef.current.slice(0, maxSatellites);
    if (!sats.length) return;

    const collection = new Cesium.PointPrimitiveCollection();
    viewer.scene.primitives.add(collection);
    collectionRef.current = collection;

    const DEFAULT_COLOR  = Cesium.Color.CYAN.withAlpha(0.75);
    const DECAYED_COLOR  = Cesium.Color.fromCssColorString("#ff4455").withAlpha(0.75);
    const PARTIAL_COLOR  = Cesium.Color.fromCssColorString("#ffcc00").withAlpha(0.75);

    function satColor(sat) {
      const norm = String(parseInt(sat.noradId, 10));
      const meta = metaRef.current[norm];
      const raw  = meta?.opsStatusRaw?.trim();
      if (!raw || raw === "+" ) return DEFAULT_COLOR;
      if (raw === "D")          return DECAYED_COLOR;
      return PARTIAL_COLOR;
    }

    sats.forEach(sat => {
      const pt = collection.add({
        position: Cesium.Cartesian3.ZERO,
        color:    satColor(sat),
        pixelSize: 1.5,
      });
      pt._satData = sat;
    });

    const worker = createPropagatorWorker();
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, buffer } = e.data;
      if (type !== "positions") return;

      const col = collectionRef.current;
      if (!col || col.isDestroyed()) {
        worker.postMessage({ type: "buffer-return", buffer }, [buffer]);
        return;
      }

      const positions = new Float64Array(buffer);
      const count = Math.min(positions.length / 3, col.length);

      for (let i = 0; i < count; i++) {
        const base = i * 3;
        const lon  = positions[base];
        const lat  = positions[base + 1];
        const alt  = positions[base + 2];
        if (isFinite(lon) && isFinite(lat) && isFinite(alt)) {
          col.get(i).position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
        }
      }

      worker.postMessage({ type: "buffer-return", buffer }, [buffer]);
    };

    worker.postMessage({
      type: "init",
      satrecs: sats.map(s => s.satrec),
    });

    return () => {
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
      if (collectionRef.current && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(collectionRef.current);
      }
      collectionRef.current = null;
    };
  }, [viewer, loaded, maxSatellites]);

  // ── Interaction: hover + click ─────────────────────────────────────────────
  useEffect(() => {
    if (!viewer || !loaded) return;

    const HOVER_COLOR  = Cesium.Color.WHITE;
    const HOVER_SIZE   = 5;
    const SELECT_SIZE  = 6;

    const getStatusColor = pt => {
      const norm = String(parseInt(pt._satData?.noradId, 10));
      const raw  = metaRef.current[norm]?.opsStatusRaw?.trim();
      if (!raw || raw === "+") return Cesium.Color.CYAN.withAlpha(0.75);
      if (raw === "D")         return Cesium.Color.fromCssColorString("#ff4455").withAlpha(0.75);
      return Cesium.Color.fromCssColorString("#ffcc00").withAlpha(0.75);
    };
    const getStatusHex = pt => {
      const norm = String(parseInt(pt._satData?.noradId, 10));
      const raw  = metaRef.current[norm]?.opsStatusRaw?.trim();
      if (!raw || raw === "+") return "#00cfff";
      if (raw === "D")         return "#ff4455";
      return "#ffcc00";
    };

    let hoveredPt  = null;
    let selectedPt = null;
    let strobeOn = false;
    let strobeTimer = null;
    let strokeBillboards = null;
    let strobeSprite = null;
    const STROBE_DELAYS = [1000, 70, 70, 70];

    function makeGlowCanvas(size, hex) {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      const cx = size / 2;
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      const grd = ctx.createRadialGradient(cx,cx,0,cx,cx,cx);
      grd.addColorStop(0,    `rgba(255,255,255,1.0)`);
      grd.addColorStop(0.08, `rgba(${r},${g},${b},0.95)`);
      grd.addColorStop(0.25, `rgba(${r},${g},${b},0.55)`);
      grd.addColorStop(0.55, `rgba(${r},${g},${b},0.15)`);
      grd.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.fillRect(0,0,size,size);
      return c;
    }

    function clearStrobe() {
      strobeOn = false;
      clearTimeout(strobeTimer);
      strobeTimer = null;
      if (strobeSprite) { strobeSprite.width = 0; strobeSprite.height = 0; }
    }

    function startStrobe(hex) {
      clearStrobe();
      if (!strokeBillboards) {
        strokeBillboards = new Cesium.BillboardCollection();
        viewer.scene.primitives.add(strokeBillboards);
      }
      if (strobeSprite) { strokeBillboards.remove(strobeSprite); }
      strobeSprite = strokeBillboards.add({
        position: Cesium.Cartesian3.ZERO,
        image: makeGlowCanvas(80, hex),
        width: 0, height: 0,
        color: Cesium.Color.WHITE,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      });

      function step(phase) {
        strobeOn = (phase === 1 || phase === 3);
        strobeTimer = setTimeout(() => step((phase + 1) % 4), STROBE_DELAYS[phase]);
      }
      step(0);
    }

    const REF_ALT = 1_500_000;
    const getCamAlt = () => {
      const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(viewer.camera.position);
      return (carto && isFinite(carto.height)) ? carto.height : REF_ALT;
    };

    const strobeInterval = setInterval(() => {
      if (!strobeSprite || !selectedPt || viewer.isDestroyed()) return;
      const pos = selectedPt.position;
      if (!pos || Cesium.Cartesian3.equals(pos, Cesium.Cartesian3.ZERO)) return;
      strobeSprite.position = pos;
      const scale = Math.max(0.4, Math.min(2.0, REF_ALT / getCamAlt()));
      if (strobeOn) {
        strobeSprite.width  = Math.round(90 * scale);
        strobeSprite.height = Math.round(90 * scale);
      } else {
        strobeSprite.width  = 0;
        strobeSprite.height = 0;
      }
    }, 50);

    const applyDefault  = pt => { pt.color = getStatusColor(pt); pt.pixelSize = 1.5; };
    const applyHover    = pt => { pt.color = HOVER_COLOR; pt.pixelSize = HOVER_SIZE; };
    const applySelected = pt => {
      pt.color = getStatusColor(pt);
      pt.pixelSize = SELECT_SIZE;
      startStrobe(getStatusHex(pt));
    };

    if (flyToRef) {
      flyToRef._deselect = () => {
        if (selectedPt) { applyDefault(selectedPt); selectedPt = null; }
        clearStrobe();
        clearOrbit(viewer);
      };
      flyToRef._setSelected = pt => {
        selectedPt = pt;
        applySelected(pt);
        drawOrbit(viewer, pt._satData);
      };
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    handler.setInputAction(movement => {
      if (hoveredPt) {
        hoveredPt === selectedPt ? applySelected(hoveredPt) : applyDefault(hoveredPt);
        hoveredPt = null;
        viewer.scene.canvas.style.cursor = "default";
      }
      const pt = viewer.scene.pick(movement.endPosition)?.primitive;
      if (pt?._satData) {
        hoveredPt = pt;
        if (pt !== selectedPt) applyHover(pt);
        viewer.scene.canvas.style.cursor = "pointer";
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(click => {
      if (selectedPt) { applyDefault(selectedPt); selectedPt = null; clearStrobe(); clearOrbit(viewer); }
      const pt = viewer.scene.pick(click.position)?.primitive;
      if (pt?._satData) {
        const sat  = pt._satData;
        const meta = metaRef.current[sat.noradId] || {};
        selectedPt = pt;
        applySelected(pt);
        drawOrbit(viewer, sat);
        onSatelliteClick?.({ name: sat.name, noradId: sat.noradId, tle1: sat.tle1, tle2: sat.tle2, ...meta });
      } else {
        onSatelliteClick?.(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      clearStrobe();
      clearInterval(strobeInterval);
      if (strokeBillboards && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(strokeBillboards);
      }
    };
  }, [viewer, loaded, onSatelliteClick, flyToRef, drawOrbit, clearOrbit]);

  // ── flyTo ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer || !loaded || !flyToRef) return;

    flyToRef.current = satName => {
      const collection = collectionRef.current;
      if (!collection) return;

      let targetPt = null;
      for (let i = 0; i < collection.length; i++) {
        const pt = collection.get(i);
        if (pt._satData?.name === satName) { targetPt = pt; break; }
      }
      if (!targetPt) return;

      const sat  = targetPt._satData;
      const meta = metaRef.current[sat.noradId] || {};
      flyToRef._deselect?.();
      flyToRef._setSelected?.(targetPt);
      onSatelliteClick?.({ name: sat.name, noradId: sat.noradId, tle1: sat.tle1, tle2: sat.tle2, ...meta });

      const pos = targetPt.position;
      if (!pos || Cesium.Cartesian3.equals(pos, Cesium.Cartesian3.ZERO)) return;

      const carto   = Cesium.Cartographic.fromCartesian(pos);
      const viewAlt = Math.max(carto.height * 2.0, 800_000);

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, viewAlt),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
        duration: 2,
      });
    };
  }, [viewer, loaded, flyToRef, onSatelliteClick, clearOrbit, drawOrbit]);

  return null;
}