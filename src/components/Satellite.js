import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import * as satellite from "satellite.js";


function splitCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i=0; i<line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    }
    else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    }
    else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}


const SATCAT_COUNTRY_CODES = {
  AB:   "Arab Satellite Communications Organization",
  ABS:  "Asia Broadcast Satellite",
  AC:   "Asia Satellite Telecommunications (ASIASAT)",
  ALG:  "Algeria",
  ANG:  "Angola",
  ARGN: "Argentina",
  ARM:  "Armenia",
  ASRA: "Austria",
  AUS:  "Australia",
  AZER: "Azerbaijan",
  BEL:  "Belgium",
  BELA: "Belarus",
  BERM: "Bermuda",
  BGD:  "Bangladesh",
  BHR:  "Bahrain",
  BHUT: "Bhutan",
  BOL:  "Bolivia",
  BRAZ: "Brazil",
  BUL:  "Bulgaria",
  BWA:  "Botswana",
  CA:   "Canada",
  CHBZ: "China / Brazil",
  CHTU: "China / Turkey",
  CHLE: "Chile",
  CIS:  "Russia / Commonwealth of Independent States",
  COL:  "Colombia",
  CRI:  "Costa Rica",
  CZCH: "Czechia",
  DEN:  "Denmark",
  DJI:  "Djibouti",
  ECU:  "Ecuador",
  EGYP: "Egypt",
  ESA:  "European Space Agency",
  ESRO: "European Space Research Organization",
  EST:  "Estonia",
  ETH:  "Ethiopia",
  EUME: "EUMETSAT",
  EUTE: "EUTELSAT",
  FGER: "France / Germany",
  FIN:  "Finland",
  FR:   "France",
  FRIT: "France / Italy",
  GER:  "Germany",
  GHA:  "Ghana",
  GLOB: "Globalstar",
  GREC: "Greece",
  GRSA: "Greece / Saudi Arabia",
  GUAT: "Guatemala",
  HRV:  "Croatia",
  HUN:  "Hungary",
  IM:   "INMARSAT",
  IND:  "India",
  INDO: "Indonesia",
  IRAN: "Iran",
  IRAQ: "Iraq",
  IRID: "Iridium",
  IRL:  "Ireland",
  ISRA: "Israel",
  ISRO: "Indian Space Research Organisation",
  ISS:  "International Space Station",
  IT:   "Italy",
  ITSO: "INTELSAT",
  JPN:  "Japan",
  KAZ:  "Kazakhstan",
  KEN:  "Kenya",
  LAOS: "Laos",
  LKA:  "Sri Lanka",
  LTU:  "Lithuania",
  LUXE: "Luxembourg",
  MA:   "Morocco",
  MALA: "Malaysia",
  MCO:  "Monaco",
  MDA:  "Moldova",
  MEX:  "Mexico",
  MMR:  "Myanmar",
  MNE:  "Montenegro",
  MNG:  "Mongolia",
  MUS:  "Mauritius",
  NATO: "NATO",
  NETH: "Netherlands",
  NICO: "New ICO",
  NIG:  "Nigeria",
  NKOR: "North Korea",
  NOR:  "Norway",
  NPL:  "Nepal",
  NZ:   "New Zealand",
  O3B:  "O3b Networks",
  ORB:  "ORBCOMM",
  PAKI: "Pakistan",
  PERU: "Peru",
  POL:  "Poland",
  POR:  "Portugal",
  PRC:  "People's Republic of China",
  PRY:  "Paraguay",
  PRES: "China / European Space Agency",
  QAT:  "Qatar",
  RASC: "RascomStar-QAF",
  ROC:  "Taiwan",
  ROM:  "Romania",
  RP:   "Philippines",
  RWA:  "Rwanda",
  SAFR: "South Africa",
  SAUD: "Saudi Arabia",
  SDN:  "Sudan",
  SEAL: "Sea Launch",
  SEN:  "Senegal",
  SES:  "SES",
  SGJP: "Singapore / Japan",
  SING: "Singapore",
  SKOR: "South Korea",
  SLB:  "Solomon Islands",
  SPN:  "Spain",
  STCT: "Singapore / Taiwan",
  SVN:  "Slovenia",
  SWED: "Sweden",
  SWTZ: "Switzerland",
  TBD:  "To Be Determined",
  THAI: "Thailand",
  TMMC: "Turkmenistan / Monaco",
  TUN:  "Tunisia",
  TURK: "Turkey",
  UAE:  "United Arab Emirates",
  UK:   "United Kingdom",
  UKR:  "Ukraine",
  UNK:  "Unknown",
  URY:  "Uruguay",
  US:   "United States",
  USBZ: "United States / Brazil",
  VAT:  "Vatican City",
  VENZ: "Venezuela",
  VTNM: "Vietnam",
  ZWE:  "Zimbabwe",
};


function resolveCountry(code) {
  if (!code) return "";
  return SATCAT_COUNTRY_CODES[code.trim().toUpperCase()] || code;
}


function mergeDatabases(satcatMap, ucsMap) {
  const merged = {};
  Object.entries(satcatMap).forEach(([norad, sc]) => {
    const normNorad = String(parseInt(norad, 10));
    const ucs = ucsMap[normNorad] || ucsMap[norad] || ucsMap[sc.name?.trim().toUpperCase()] || null;
    merged[normNorad] = { ...sc, noradId: normNorad, ...(ucs || {}) };
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

    if (cols.length < 3) {
      continue;
    }

    const col = (idx) => cols[idx]?.trim().replace(/^"|"$/g, "") ?? "";
    const noradRaw = col(2);
    const norad = noradRaw ? String(parseInt(noradRaw, 10)) : "";

    if (!norad || norad === "NaN") {
      continue;
    }

    map[norad] = {
      noradId: norad,
      name: col(0),
      intlDesignator: col(1),
      objectType: col(3),
      country: resolveCountry(col(5)),
      launchDate: col(6),
      launchSite: col(7),
      decayDate: col(8),
      periodMin: col(9),
      inclination: col(10),
      apogeeKm: col(11),
      perigeeKm: col(12),
      sourceSatcat: "Celestrak SATCAT",
    };
  }

  return map;
}


async function fetchUCS(onStatus) {
  console.log("Fetching UCS satellite database...");
  onStatus?.("Fetching UCS satellite database...");
  const UCS_URL = "https://raw.githubusercontent.com/Emkave/satmon/main/public/UCS_Satellite_Database.csv";
  let text = "";
 
  try {
    const res = await fetch(UCS_URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    text = await res.text();
  } catch (e) {
    console.error("UCS fetch failed:", e);
    onStatus?.("UCS database unavailable, continuing...");
    return {};
  }
 
  console.log("Parsing UCS database...");
  onStatus?.("Parsing UCS database...");
  const lines = text.split("\n");
  const header = splitCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  const byNorad = {};
  const byName = {};
 
  for (let i=1; i<lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
 
    if (cols.length < 2) {
      continue;
    }
 
    const row = {};
    header.forEach((h, idx) => {row[h] = cols[idx]?.trim().replace(/^"|"$/g, "") ?? "";});
 
    const entry = {
      officialName: row["Name of Satellite, Alternate Names"] || row["Current Official Name of Satellite"] || "",
      countryUCS: row["Country/Org of UN Registry"] || row["Country"] || "",
      owner: row["Operator/Owner"] || row["Operator"] || "",
      users: row["Users"] || "",
      purpose: row["Purpose"] || "",
      detailedPurpose: row["Detailed Purpose"] || "",
      orbitClass: row["Class of Orbit"] || "",
      orbitType: row["Type of Orbit"] || "",
      manufacturer: row["Contractor"] || row["Manufacturer"] || "",
      massKg: row["Launch Mass (kg.)"] || row["Launch Mass"] || "",
      dryMassKg: row["Dry Mass (kg.)"] || row["Dry Mass"] || "",
      powerW: row["Power (watts)"] || row["Power"] || "",
      lifetime: row["Expected Lifetime (yrs.)"] || row["Expected Lifetime"] || "",
      contractor: row["Launch Contractor"] || "",
      launchVehicle: row["Launch Vehicle"] || "",
      sourceUCS: "UCS Satellite Database",
    };
 
    const noradRaw = (row["NORAD Number"] || row["Norad Number"] || "").trim();
    const noradInt = parseInt(noradRaw, 10);
    const norad = !isNaN(noradInt) ? String(noradInt) : "";
    if (norad) {
      byNorad[norad] = entry;
    }
    if (entry.officialName) {
      byName[entry.officialName.trim().toUpperCase()] = entry;
    }
  }
 
  console.log("UCS parsed.");
  return { ...byNorad, ...byName };
}


async function fetchWithProxies() {
  const sources = [
    { url: "https://raw.githubusercontent.com/Emkave/satmon/main/public/tle.txt", direct: true  }
  ];

  for (const source of sources) {
    console.log("Trying proxy: ", source);
    try {
      const res = await fetch(source.url, source.direct ? {} : { headers: { "x-requested-with": "XMLHttpRequest" } });
      if (!res.ok) 
        continue;
      const text = await res.text();
      const tleCount = (text.match(/^1 \d/mg) || []).length;
      if (tleCount < 100) {
        console.warn(`TLE source returned only ${tleCount} satellites, skipping:`, source.url);
        continue;
      }
      console.log(`TLE fetched from: ${source.url} (${tleCount} satellites)`);
      return text;
    } catch (e) {
      console.warn("TLE source failed:", source.url, e.message);
    }
  }
  throw new Error("All TLE sources failed");
}


export default function Satellite({ viewer, maxSatellites, onLoaded, onSatelliteClick, onStatusUpdate, flyToRef }) {
  const satellitesRef = useRef([]);
  const entitiesRef = useRef([]);
  const [loaded, setLoaded] = useState(false);
  const metaRef = useRef({});
  const handlerRef = useRef(null);
  const isLoadingRef = useRef(false);


  useEffect(() => {
    if (loaded || isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
  }, [loaded, onLoaded]);


  useEffect(() => {
    if (loaded) { 
      return;
    }


    async function load() {
      onStatusUpdate?.("Fetching TLE orbital elements...");

      let tleText = null;

      try {
        tleText = await fetchWithProxies();
      } catch (e) {
        console.warn("TLE URL failed:", e);
      }

      if (!tleText) {
        onStatusUpdate?.("All TLE sources failed.");
        throw new Error("All TLE sources failed");
      }

      onStatusUpdate?.("Parsing orbital elements...");
      const lines = tleText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      const sats = [];

      for (let i = 0; i < lines.length; i++) {
        const tle1 = lines[i];
        const tle2 = lines[i + 1];

        if (!tle1?.startsWith("1 ") || !tle2?.startsWith("2 ")) {
          continue;
        }

        const name = (i > 0 ? lines[i - 1] : "").replace(/^0 /, "").trim() || "UNKNOWN";

        try {
          const satrec = satellite.twoline2satrec(tle1, tle2);
          const noradId = tle1.substring(2, 7).trim();
          sats.push({name, satrec, noradId});
          i += 1;
        } catch {
          continue;
        }
      }

      onStatusUpdate?.(`Parsed ${sats.length.toLocaleString()} satellites. Loading metadata...`);

      let satcatMap = {};
      let ucsList = {};

      try {
        satcatMap = await fetchSatcat(onStatusUpdate);
      } catch (e) {
        console.warn("SATCAT FETCH FAILED.", e);
        onStatusUpdate?.("SATCAT unavailable, continuing...");
      }

      try {
        ucsList = await fetchUCS(onStatusUpdate);
      } catch (e) {
        console.warn("UCS fetch failed.", e);
        ucsList = {};
      }

      onStatusUpdate?.("Merging databases...");
      metaRef.current = mergeDatabases(satcatMap, ucsList);

      onStatusUpdate?.("Placing satellites on globe...");
      satellitesRef.current = sats;
      console.log("Parsed satellites:", sats.length, "| Metadata Entries:", Object.keys(metaRef.current).length);
      onLoaded?.(sats.map((s) => s.name));
      setLoaded(true);
    }

    load();
  }, [loaded, onLoaded, onStatusUpdate]);


  useEffect(() => {
    if (!viewer || !loaded) {
      return;
    }

    entitiesRef.current.forEach((e) => viewer.entities.remove(e));
    entitiesRef.current = [];

    satellitesRef.current.slice(0, maxSatellites).forEach((sat) => {
      const entity = viewer.entities.add({
        name: sat.name,
        description: sat.noradId,

        position: new Cesium.CallbackProperty(() => {
          const now = new Date();
          const pv = satellite.propagate(sat.satrec, now);

          if (!pv.position) {
            return null;
          }

          const gmst = satellite.gstime(now);
          const gd = satellite.eciToGeodetic(pv.position, gmst);

          const lon = Cesium.Math.toDegrees(gd.longitude);
          const lat = Cesium.Math.toDegrees(gd.latitude);
          const alt = gd.height * 1000;

          if (!isFinite(lon) || !isFinite(lat) || !isFinite(alt)) {
            return null;
          }
          
          return Cesium.Cartesian3.fromDegrees(lon, lat, alt);
        }, false),
        point: {
          pixelSize: 4,
          color: Cesium.Color.CYAN.withAlpha(0.75),
          outlineColor: Cesium.Color.TRANSPARENT,
          outlineWidth: 0,
        },
      });

      entity._satData = sat;
      entitiesRef.current.push(entity);
    });
  }, [viewer, maxSatellites, loaded]);


  useEffect(() => {
    if (!viewer || !loaded) {
      return;
    }

    let hoveredEntity = null;
    let selectedEntity = null;

    const SELECT_COLOR = Cesium.Color.LIME;
    const SELECT_SIZE = 10;
    const DEFAULT_COLOR = Cesium.Color.CYAN.withAlpha(0.75);
    const DEFAULT_SIZE = 4;
    const HOVER_COLOR = Cesium.Color.WHITE;
    const HOVER_SIZE = 10;

    const applySelected = (entity) => {
      entity.point.pixelSize = SELECT_SIZE;
      entity.point.color = SELECT_COLOR;
    };
    const applyHover = (entity) => {
      entity.point.pixelSize = HOVER_SIZE;
      entity.point.color = HOVER_COLOR;
    };
    const applyDefault = (entity) => {
      entity.point.pixelSize = DEFAULT_SIZE;
      entity.point.color = DEFAULT_COLOR;
    };

    if (flyToRef) {
      flyToRef._deselect = () => {
        if (selectedEntity) {
          applyDefault(selectedEntity);
          selectedEntity = null;
        }
      };
      flyToRef._setSelected = (entity) => {
        selectedEntity = entity;
        applySelected(entity);
      };
    }

    handlerRef.current = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    const handler = handlerRef.current;

    handler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.endPosition);

      if (hoveredEntity) {
        if (hoveredEntity === selectedEntity) {
          applySelected(hoveredEntity);
        } else {
          applyDefault(hoveredEntity);
        }
        hoveredEntity = null;
        viewer.scene.canvas.style.cursor = "default";
      }

      if (Cesium.defined(picked) && picked.id && picked.id._satData) {
        hoveredEntity = picked.id;
        if (hoveredEntity !== selectedEntity) applyHover(hoveredEntity);
        viewer.scene.canvas.style.cursor = "pointer";
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction((click) => {
      const picked = viewer.scene.pick(click.position);

      if (selectedEntity) {
        applyDefault(selectedEntity);
        selectedEntity = null;
      }

      if (Cesium.defined(picked) && picked.id && picked.id._satData) {
        const sat = picked.id._satData;
        const noradId = sat.noradId;
        const meta = metaRef.current[noradId] || {};

        selectedEntity = picked.id;
        applySelected(selectedEntity);
        onSatelliteClick?.({ name: sat.name, noradId, ...meta });
      } else {
        onSatelliteClick?.(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [viewer, loaded, onSatelliteClick, flyToRef]);


  useEffect(() => {
    if (!viewer || !loaded || !flyToRef) return;

    flyToRef.current = (satName) => {
      const entity = entitiesRef.current.find(
        (e) => e._satData?.name === satName
      );
      if (!entity) return;

      const sat = entity._satData;
      const noradId = sat.noradId;
      const meta = metaRef.current[noradId] || {};

      flyToRef._deselect?.();
      flyToRef._setSelected?.(entity);

      onSatelliteClick?.({ name: sat.name, noradId, ...meta });

      const pos = entity.position.getValue(Cesium.JulianDate.now());
      const altitudeAboveGround = pos
        ? Cesium.Cartographic.fromCartesian(pos).height
        : 500000;

      viewer.flyTo(entity, {
        duration: 2,
        offset: new Cesium.HeadingPitchRange(
          0,
          Cesium.Math.toRadians(-90),
          altitudeAboveGround * 1.5,
        ),
      });
    };
  }, [viewer, loaded, flyToRef, onSatelliteClick]);


  return null;
}