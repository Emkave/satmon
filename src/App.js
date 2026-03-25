import { useState, useCallback } from "react";
import Globe from "./components/Globe";
import Satellites from "./components/Satellite";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [satelliteCount, setSatelliteCount] = useState(1024);
  const [satelliteNames, setSatelliteNames] = useState([]);
  const handleLoaded = useCallback((names) => setSatelliteNames(names), []);

  return (
    <>
      <Sidebar 
        satelliteCount={satelliteCount}
        setSatelliteCount={setSatelliteCount}
        satelliteNames={satelliteNames}
      />
      <Globe>
        <Satellites maxSatellites={satelliteCount} onLoaded={handleLoaded} />
      </Globe>
    </>
  );
}