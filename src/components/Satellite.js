import { useEffect } from "react";
import * as Cesium from "cesium";
import * as satellite from "satellite.js";

export default function Satellite({ viewer }) {
  useEffect(() => {
    if (!viewer) return;

    let entities = [];

    fetch("https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle")
      .then((res) => res.text())
      .then((text) => {
        const lines = text.split("\n");

        const satellites = [];
        for (let i = 0; i < lines.length; i += 3) {
          const name = lines[i]?.trim();
          const tle1 = lines[i + 1]?.trim();
          const tle2 = lines[i + 2]?.trim();

          if (!name || !tle1 || !tle2) continue;

          try {
            const satrec = satellite.twoline2satrec(tle1, tle2);
            satellites.push({ name, satrec });
          } catch (e) {
            continue;
          }
        }

        console.log("Total satellites:", satellites.length);


        const MAX = 200;

        satellites.slice(0, MAX).forEach((sat) => {
          const entity = viewer.entities.add({
            name: sat.name,

            position: new Cesium.CallbackProperty(() => {
              const now = new Date();

              const pv = satellite.propagate(sat.satrec, now);
              if (!pv.position) return Cesium.Cartesian3.ZERO;

              const gmst = satellite.gstime(now);

              const gd = satellite.eciToGeodetic(pv.position, gmst);

              const lon = Cesium.Math.toDegrees(gd.longitude);
              const lat = Cesium.Math.toDegrees(gd.latitude);
              const height = gd.height * 1000;

              return Cesium.Cartesian3.fromDegrees(lon, lat, height);
            }, false),

            point: {
              pixelSize: 5,
              color: Cesium.Color.CYAN.withAlpha(0.7),
            },
          });

          entities.push(entity);
        });
      });

    return () => {
      entities.forEach((e) => viewer.entities.remove(e));
    };
  }, [viewer]);

  return null;
}