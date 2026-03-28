import { useState, useCallback } from "react";
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
  
  return (
      <>
      <Globe>
        <Satellites
          maxSatellites={satelliteCount}
          onLoaded={handleLoaded}
          onSatelliteClick={handleSatelliteClick}
        />
      </Globe>
 
      <Sidebar
        satelliteCount={satelliteCount}
        setSatelliteCount={setSatelliteCount}
        satelliteNames={satelliteNames}
      />
 
      <SatelliteInfoPanel
        satellite={selectedSatellite}
        onClose={() => setSelectedSatellite(null)}
      />
    </>
  );
}