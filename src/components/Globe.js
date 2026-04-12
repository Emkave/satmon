import React, { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";

Cesium.Ion.defaultAccessToken = process.env.REACT_APP_CESIUM_TOKEN;

const COUNTRIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const LAND_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson";

const OCEAN_COLOR  = Cesium.Color.fromCssColorString("#050607");
const LAND_COLOR   = Cesium.Color.fromCssColorString("#020202");
const BORDER_COLOR = Cesium.Color.fromCssColorString("#4a5568");
const GRID_COLOR   = Cesium.Color.fromCssColorString("#1e2228").withAlpha(0.7);

const LABEL_FADE_IN_ALT = 3_000_000;
const LABEL_FULL_ALT    = 1_000_000;

const GRID_STEP     = 15;
const GRID_SEGMENTS = 360;
const GRID_ALT      = 1500;

// How many consecutive postRender frames with everything settled before we
// consider the globe truly drawn. At 60 fps, 60 frames ≈ 1 second of settling.
const STABLE_FRAMES_REQUIRED = 60;

function styleEntities(dataSource, fillColor, outlineColor, outlineWidth) {
  dataSource.entities.values.forEach((entity) => {
    if (entity.polygon) {
      entity.polygon.material           = new Cesium.ColorMaterialProperty(fillColor);
      entity.polygon.outline            = new Cesium.ConstantProperty(outlineWidth > 0);
      entity.polygon.outlineColor       = new Cesium.ConstantProperty(outlineColor);
      entity.polygon.outlineWidth       = new Cesium.ConstantProperty(outlineWidth);
      entity.polygon.clampToGround      = new Cesium.ConstantProperty(true);
      entity.polygon.classificationType = new Cesium.ConstantProperty(Cesium.ClassificationType.TERRAIN);
    }
    if (entity.polyline) {
      entity.polyline.material      = new Cesium.ColorMaterialProperty(outlineColor);
      entity.polyline.width         = new Cesium.ConstantProperty(outlineWidth);
      entity.polyline.clampToGround = new Cesium.ConstantProperty(true);
    }
  });
}

function addCountryLabels(viewer, geojson) {
  geojson.features.forEach((feature) => {
    const props = feature.properties;
    const name  = props.NAME || props.ADMIN || props.name || "";
    if (!name || !feature.geometry) return;

    let lon = props.LABEL_X ?? props.label_x;
    let lat = props.LABEL_Y ?? props.label_y;

    if (lon == null || lat == null) {
      const coords = [];
      const collect = (c) => {
        if (typeof c[0] === "number") coords.push(c);
        else c.forEach(collect);
      };
      try { collect(feature.geometry.coordinates); } catch { return; }
      if (!coords.length) return;
      lon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
      lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    }

    const area     = props.AREA || props.area || 50;
    const fontSize = area > 200 ? 14 : area > 50 ? 12 : 11;

    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 4000),
      label: {
        text: name.toUpperCase(),
        font: `${fontSize}px 'Share Tech', 'Courier New', monospace`,
        fillColor: Cesium.Color.fromCssColorString("#e9eaeb"),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        translucencyByDistance: new Cesium.NearFarScalar(LABEL_FULL_ALT, 1.0, LABEL_FADE_IN_ALT, 0.0),
        scaleByDistance: new Cesium.NearFarScalar(500_000, 1.2, LABEL_FULL_ALT, 0.85),
        showBackground: false,
      },
    });
  });
}

function addGraticule(viewer) {
  const primitives = viewer.scene.primitives;
  const lines = new Cesium.PolylineCollection();

  for (let lat = -90 + GRID_STEP; lat < 90; lat += GRID_STEP) {
    const positions = [];
    for (let i = 0; i <= GRID_SEGMENTS; i++) {
      const lon = -180 + (360 / GRID_SEGMENTS) * i;
      positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, GRID_ALT));
    }
    lines.add({ positions, width: 0.6, material: Cesium.Material.fromType("Color", { color: GRID_COLOR }) });
  }

  for (let lon = -180; lon < 180; lon += GRID_STEP) {
    const positions = [];
    for (let i = 0; i <= GRID_SEGMENTS; i++) {
      const lat = -90 + (180 / GRID_SEGMENTS) * i;
      positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, GRID_ALT));
    }
    lines.add({ positions, width: 0.6, material: Cesium.Material.fromType("Color", { color: GRID_COLOR }) });
  }

  primitives.add(lines);
  return lines;
}

// Counts postRender frames where both tiles and all dataSources are fully loaded.
// Resolves once STABLE_FRAMES_REQUIRED consecutive settled frames have passed.
// The globe is rendering the whole time under the loading screen — we're just
// waiting until it's genuinely drawn before revealing it.
function waitUntilRendered(v, alive, onStatusUpdate) {
  return new Promise((resolve) => {
    let stableCount = 0;
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      try { v.scene.postRender.removeEventListener(onFrame); } catch {}
      clearTimeout(hardTimeout);
      resolve();
    };

    const hardTimeout = setTimeout(finish, 10_000);

    const onFrame = () => {
      if (!alive()) { finish(); return; }

      const tilesLoaded   = v.scene.globe.tilesLoaded;
      const sourcesLoaded = Array.from({ length: v.dataSources.length }, (_, i) => v.dataSources.get(i))
                              .every((ds) => !ds.loading);

      if (tilesLoaded && sourcesLoaded) {
        stableCount++;
        // Show a progress hint so the loading screen doesn't look frozen
        if (stableCount % 10 === 0) {
          const pct = Math.min(99, Math.round((stableCount / STABLE_FRAMES_REQUIRED) * 100));
          onStatusUpdate?.(`Rendering globe surface... ${pct}%`);
        }
        if (stableCount >= STABLE_FRAMES_REQUIRED) finish();
      } else {
        stableCount = 0; // reset — still something pending
      }
    };

    v.scene.postRender.addEventListener(onFrame);
  });
}

export default function Globe({ children, onStatusUpdate, onReady }) {
  const viewerRef    = useRef(null);
  const viewerObjRef = useRef(null);
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    const v = new Cesium.Viewer(viewerRef.current, {
      timeline: false,
      animation: false,
      shouldAnimate: true,
      terrain: Cesium.Terrain.fromWorldTerrain(),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      skyBox: false,
      skyAtmosphere: false,
    });

    viewerObjRef.current = v;

    v.imageryLayers.removeAll();
    v.scene.globe.baseColor            = OCEAN_COLOR;
    v.scene.globe.enableLighting       = false;
    v.scene.globe.showGroundAtmosphere = false;
    v.scene.backgroundColor            = Cesium.Color.BLACK;
    if (v.scene.sun)  v.scene.sun.show  = false;
    if (v.scene.moon) v.scene.moon.show = false;

    const alive   = () => viewerObjRef.current !== null && !v.isDestroyed();
    const safeAdd = (ds) => { if (alive()) v.dataSources.add(ds); };

    // Graticule is synchronous — add immediately while scene is fresh
    addGraticule(v);

    async function loadGlobeAssets() {
      // ── 1. Land polygons ─────────────────────────────────────────────────────
      onStatusUpdate?.("Loading terrain data...");
      await Cesium.GeoJsonDataSource.load(LAND_URL)
        .then((ds) => { styleEntities(ds, LAND_COLOR, Cesium.Color.TRANSPARENT, 0); safeAdd(ds); })
        .catch(console.error);
      if (!alive()) return;

      // ── 2. Country borders + labels ──────────────────────────────────────────
      onStatusUpdate?.("Loading country borders...");
      const geojson = await fetch(COUNTRIES_URL).then((r) => r.json()).catch(() => null);
      if (!alive() || !geojson) return;

      onStatusUpdate?.("Rendering country borders...");
      await Cesium.GeoJsonDataSource.load(geojson)
        .then((ds) => { styleEntities(ds, Cesium.Color.TRANSPARENT, BORDER_COLOR, 1.5); safeAdd(ds); })
        .catch(console.error);
      if (!alive()) return;

      onStatusUpdate?.("Placing country labels...");
      addCountryLabels(v, geojson);
      if (!alive()) return;

      // ── 3. Let the scene render fully under the loading screen ───────────────
      // Everything is being drawn right now behind the loading overlay.
      // We wait for STABLE_FRAMES_REQUIRED consecutive settled frames before
      // declaring the globe ready and removing the loading screen.
      onStatusUpdate?.("Rendering globe surface...");
      await waitUntilRendered(v, alive, onStatusUpdate);
      if (!alive()) return;

      // Globe is fully rendered — loading screen can now fade out
      onReady?.();
    }

    loadGlobeAssets();

    const resize = () => {
      v.scene.canvas.style.width  = "100%";
      v.scene.canvas.style.height = "100%";
    };
    v.scene.postRender.addEventListener(function once() {
      resize();
      v.scene.postRender.removeEventListener(once);
    });

    setViewer(v);

    return () => {
      viewerObjRef.current = null;
      v.destroy();
    };
  }, []);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0,
      width: "100vw", height: "100vh",
      margin: 0, padding: 0, overflow: "hidden",
      background: "#000000",
    }}>
      <div ref={viewerRef} style={{ width: "100%", height: "100%" }} />
      {viewer && children && (
        Array.isArray(children)
          ? children.map((child, i) => child ? React.cloneElement(child, { key: i, viewer }) : null)
          : React.cloneElement(children, { viewer })
      )}
    </div>
  );
}