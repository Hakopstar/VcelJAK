"use client"

import { useState } from "react"
import Dashboard from "./components/Dashboard"
import EnvironmentPanel from "./components/EnvironmentPanel"
import Schematic, { type Sensor } from "./components/Schematic"
import Graphs from "./components/Graphs"
import TipsPanel from "./components/TipsPanel"




export default function Home() {
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null)  
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <EnvironmentPanel />
          <TipsPanel />
        </div>
        <div className="lg:col-span-2 space-y-8">
        <Schematic onSensorClick={setSelectedSensor} />
        <Graphs selectedSensor={selectedSensor} />
        </div>
      </div>
      
    </div>
  )
}

