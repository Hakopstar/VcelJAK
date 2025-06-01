"use client"

import { useState, useEffect } from "react" // Removed useMemo as it's no longer needed here
import Dashboard from "./components/Dashboard"
import EnvironmentPanel from "./components/EnvironmentPanel"
import Schematic, { type Beehive } from "./components/Schematic" // Beehive type is imported
import Graphs from "./components/Graphs"
import TipsPanel from "./components/TipsPanel"
// fetchBeehives is not directly used in Home if Schematic handles its own fetching
// import { fetchBeehives } from "~/lib/api"
import { SSEProvider } from "./components/SSEProvider";

export default function Home() {
  const [selectedBeehive, setSelectedBeehive] = useState<Beehive | null>(null)

  const handleBeehiveClick = (beehive: Beehive | null) => {
    // console.log("Home: Setting selected beehive:", beehive);
    setSelectedBeehive(beehive)
  }

  // The logic for sensorIdForGraph is now handled within Graphs.tsx
  // const sensorIdForGraph = useMemo(() => {
  //   return selectedBeehive?.sensors?.[0].id ?? null;
  // }, [selectedBeehive]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <SSEProvider>
          <div className="lg:col-span-1 space-y-8">
            <Dashboard />
            <EnvironmentPanel />
            <TipsPanel />
          </div>
          <div className="lg:col-span-2 space-y-8">
            <Schematic
              selectedBeehive={selectedBeehive}
              onBeehiveClick={handleBeehiveClick}
            />
            {/* Pass the entire selectedBeehive object to Graphs */}
            <Graphs selectedBeehive={selectedBeehive} />
          </div>
        </SSEProvider>
      </div>
    </div>
  )
}