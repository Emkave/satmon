import { useState, useCallback, useRef } from "react";
import Globe from "./components/Globe";
import Satellites from "./components/Satellite";
import Sidebar from "./components/Sidebar";
import SatelliteInfoPanel from "./components/Satelliteinfopanel";
import LoadingScreen from "./components/Loadingscreen";

export default function App() {
  const [satelliteCount, setSatelliteCount] = useState(500);
  const [satelliteNames, setSatelliteNames] = useState([]);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState("Initializing...");
  const [isLoaded, setIsLoaded] = useState(false);
  const flyToRef = useRef(null);

  const handleLoaded = useCallback((names) => {
    setSatelliteNames(names);
    setIsLoaded(true);
  }, []);

  const handleSatelliteClick = useCallback((data) => setSelectedSatellite(data), []);
  const handleStatusUpdate = useCallback((status) => setLoadingStatus(status), []);

  return (
    <>
      <Globe>
        <Satellites
          maxSatellites={satelliteCount}
          onLoaded={handleLoaded}
          onSatelliteClick={handleSatelliteClick}
          onStatusUpdate={handleStatusUpdate}
          flyToRef={flyToRef}
        />
      </Globe>

      <LoadingScreen status={loadingStatus} isLoaded={isLoaded} />

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
            onClose={() => {
              setSelectedSatellite(null);
              flyToRef._deselect?.();
            }}
          />
        </>
      )}
    </>
  );
}