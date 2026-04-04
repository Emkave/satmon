import { useState, useCallback, useRef } from "react";
import Globe from "./components/Globe";
import Satellites from "./components/Satellite";
import Sidebar from "./components/Sidebar";
import SatelliteInfoPanel from "./components/Satelliteinfopanel";

export default function App() {
  const [satelliteCount, setSatelliteCount] = useState(500);
  const [satelliteNames, setSatelliteNames] = useState([]);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const handleLoaded = useCallback((names) => setSatelliteNames(names), []);
  const handleSatelliteClick = useCallback((data) => setSelectedSatellite(data), []);
  const flyToRef = useRef(null);

  return (
      <>
      <Globe>
        <Satellites
          maxSatellites={satelliteCount}
          onLoaded={handleLoaded}
          onSatelliteClick={handleSatelliteClick}
          flyToRef={flyToRef}
        />
      </Globe>
 
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
  );
}