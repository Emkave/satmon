import { useState } from "react";
import Globe from "./components/Globe";
import Satellites from "./components/Satellite";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [satelliteCount, setSatelliteCount] = useState(1024);

  return (
    <>
    <Sidebar 
      satelliteCount={satelliteCount}
      setSatelliteCount={setSatelliteCount}
    />
    <Globe satelliteCount={satelliteCount}>
      <Satellites />
    </Globe>
    </>
  );
}