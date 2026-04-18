import { useState, useCallback, useRef, useEffect } from "react";
import Globe from "./components/Globe";
import Satellites from "./components/Satellite";
import Sidebar from "./components/Sidebar";
import SatelliteInfoPanel from "./components/Satelliteinfopanel";
import LoadingScreen from "./components/Loadingscreen";
import VersionBadge from "./components/VersionBadge";

export default function App() {
  const [satelliteCount, setSatelliteCount] = useState(500);
  const [satelliteNames, setSatelliteNames] = useState([]);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState("Initializing...");
  const [isLoaded, setIsLoaded] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [version, setVersion] = useState("");
  const flyToRef = useRef(null);

  // Fetch version once at startup so it's ready before the loading screen needs it
  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL || ""}/version.txt`)
      .then((r) => r.text())
      .then((t) => setVersion(t.trim()))
      .catch(() => {});
  }, []);

  const handleGlobeReady = useCallback(() => {
    setGlobeReady(true);
  }, []);

  const handleLoaded = useCallback((names) => {
    setSatelliteNames(names);
    setIsLoaded(true);
  }, []);

  const handleSatelliteClick = useCallback((data) => setSelectedSatellite(data), []);
  const handleStatusUpdate   = useCallback((status) => setLoadingStatus(status), []);
  const handleClose          = useCallback(() => {
    setSelectedSatellite(null);
    flyToRef._deselect?.();
  }, []);

  return (
    <>
      <Globe onStatusUpdate={handleStatusUpdate} onReady={handleGlobeReady}>
        {globeReady && (
          <Satellites
            maxSatellites={satelliteCount}
            onLoaded={handleLoaded}
            onSatelliteClick={handleSatelliteClick}
            onStatusUpdate={handleStatusUpdate}
            flyToRef={flyToRef}
          />
        )}
      </Globe>

      <LoadingScreen status={loadingStatus} isLoaded={isLoaded} version={version} />

      {isLoaded && (
        <>
          <Sidebar
            satelliteCount={satelliteCount}
            setSatelliteCount={setSatelliteCount}
            satelliteNames={satelliteNames}
            flyToRef={flyToRef}
          />

          <SatelliteInfoPanel
            satellite={selectedSatellite}
            onClose={handleClose}
          />

          <VersionBadge version={version} />
        </>
      )}
    </>
  );
}