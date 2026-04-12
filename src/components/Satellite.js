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


function mergeDatabases(satcatMap, ucsMap) {
  const merged = {};
  Object.entries(satcatMap).forEach(([norad, sc]) => {
    const ucs = ucsMap[norad] || ucsMap[sc.name?.trim().toUpperCase()] || null;
    merged[norad] = { ...sc, ...(ucs || {}) };
  });
 
  return merged;
}


async function fetchSatcat(onStatus) {
  onStatus?.("Fetching satellite catalog (SATCAT)...");
  const res = await fetch("https://celestrak.org/pub/satcat.csv");
  const text = await res.text();
  onStatus?.("Parsing satellite catalog...");
  const lines = text.split("\n");
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const map = {};

  for (let i=1; i<lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    
    if (cols.length < 2) {
      continue;
    }

    const row = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx]?.trim().replace(/^"|"$/g, "") ?? "";
    });

    const norad = row["NORAD_CAT_ID"] || row["SAT_NUM"] || row["SATNUM"];

    if (!norad) {
      continue;
    }

    map[norad] = {
      noradId: norad,
      name: row["SATNAME"] || row["OBJECT_NAME"] || "",
      country: row["COUNTRY"] || "",
      launchDate: row["LAUNCH"] || row["LAUNCH_DATE"] || "",
      launchSite: row["SITE"] || row["LAUNCH_SITE"] || "",
      decayDate: row["DECAY"] || row["DECAY_DATE"] || "",
      objectType: row["OBJECT_TYPE"] || "",
      periodMin: row["PERIOD"] || "",
      inclination: row["INCLINATION"] || "",
      apogeeKm: row["APOGEE"] || "",
      perigeeKm: row["PERIGEE"] || "",
      rcsSize: row["RCS_SIZE"] || row["RCS"] || "",
      sourceSatcat: "Celestrak SATCAT",
    };
  }

  return map;
}


async function fetchUCS(onStatus) {
  onStatus?.("Fetching UCS satellite database...");
  const UCS_URL = "https://www.ucsusa.org/media/11490";
  const PROXY_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(UCS_URL)}`;
  let text = "";

  try {
    const res = await fetch(PROXY_URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    } 
    text = await res.text();
  } catch (e) {
    console.warn("UCS fetch via proxy failed:", e);
    onStatus?.("UCS database unavailable, continuing...");
    return {};
  }

  onStatus?.("Parsing UCS database...");
  const lines = text.split("\n");
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const byNorad = {};
  const byName = {};

  for (let i=1; i<lines.length; i++) {
    const cols = splitCSVLine(lines[i]);

    if (cols.length < 2) {
      continue;
    }

    const row = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx]?.trim().replace(/^"|"$/g, "") ?? "";
    });

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

    const norad = (row["NORAD Number"] || row["Norad Number"] || "").trim();
    if (norad) {
      byNorad[norad] = entry;
    }
    if (entry.officialName) {
      byName[entry.officialName.trim().toUpperCase()] = entry;
    }
  }

  return { ...byNorad, ...byName };
}


async function fetchWithProxies(url) {
  const proxies = [
    `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://proxy.cors.sh/${url}`,
    `https://thingproxy.freeboard.io/fetch/${url}`,
    `https://crossorigin.me/${url}`,
  ];

  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy, {
        headers: { "x-requested-with": "XMLHttpRequest" }
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 100) return text;
      }
    } catch (e) {
      console.warn("Proxy failed:", proxy, e);
    }
  }
  throw new Error("All proxies failed");
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

      const TLE_URLS = [
        "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
        "https://celestrak.org/NORAD/elements/active.txt",
      ];
      let tleText = null;
      for (const url of TLE_URLS) {
        try {
          tleText = await fetchWithProxies(url);
          if (tleText && tleText.includes("1 ")) break;
        } catch (e) {
          console.warn("TLE URL failed:", url, e);
        }
      }

      if (!tleText) 
        throw new Error("All TLE sources failed");



      onStatusUpdate?.("Parsing orbital elements...");
      const lines = tleText.split("\n");
      const sats = [];

      for (let i=0; i<lines.length; i+=3) {
        const name = lines[i]?.trim();
        const tle1 = lines[i+1]?.trim();
        const tle2 = lines[i+2]?.trim();

        if (!name || !tle1 || !tle2) {
          continue;
        }

        if (!tle1.startsWith("1 ") || !tle2.startsWith("2 ")) {
          continue;
        }

        try {
          const satrec = satellite.twoline2satrec(tle1, tle2);
          const noradId = tle1.substring(2, 7).trim();
          sats.push({name, satrec, noradId});
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