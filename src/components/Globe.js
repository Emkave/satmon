import React, { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";

Cesium.Ion.defaultAccessToken = process.env.REACT_APP_CESIUM_TOKEN;

export default function Globe({ children }) {
  const viewerRef = useRef(null);
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    const v = new Cesium.Viewer(viewerRef.current, {
      timeline: false,
      animation: false,
      shouldAnimate: true,
      terrain: Cesium.Terrain.fromWorldTerrain(),
      baseLayer: Cesium.ImageryLayer.fromWorldImagery(),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
    });

    v.scene.globe.enableLighting = true;
    v.scene.skyAtmosphere.show = true;

    const resize = () => {
      v.scene.canvas.style.width = "100%";
      v.scene.canvas.style.height = "100%";
    };

    v.scene.postRender.addEventListener(function once() {
      resize();
      v.scene.postRender.removeEventListener(once);
    });

    setViewer(v);

    return () => v.destroy();
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div ref={viewerRef} style={{ width: "100%", height: "100%" }} />

      {viewer &&
        children &&
        (Array.isArray(children)
          ? children.map((child, i) =>
              child
                ? React.cloneElement(child, { key: i, viewer })
                : null
            )
          : React.cloneElement(children, { viewer }))}
    </div>
  );
}