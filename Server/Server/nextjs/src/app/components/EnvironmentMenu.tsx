"use client"

import { useState } from "react"
import { Card, CardContent } from "~/components/ui/card"
import { ChevronDown, ChevronUp, Thermometer, Droplets, Wind } from "lucide-react"

const environmentData = {
  temperature: 25,
  humidity: 60,
  windSpeed: 5,
}

export default function EnvironmentMenu() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-full bg-primary text-primary-foreground px-4 py-2 rounded-t-md shadow-md hover:bg-primary/90 transition-colors duration-200"
      >
        Environment Data {isOpen ? <ChevronUp className="ml-2" /> : <ChevronDown className="ml-2" />}
      </button>
      {isOpen && (
        <Card className="rounded-t-none bg-card/95 backdrop-blur-sm">
          <CardContent className="p-4">
            <ul className="space-y-3">
              <li className="flex items-center justify-between">
                <div className="flex items-center">
                  <Thermometer className="mr-2 text-red-400" />
                  <span>Temperature</span>
                </div>
                <span>{environmentData.temperature}°C</span>
              </li>
              <li className="flex items-center justify-between">
                <div className="flex items-center">
                  <Droplets className="mr-2 text-blue-400" />
                  <span>Humidity</span>
                </div>
                <span>{environmentData.humidity}%</span>
              </li>
              <li className="flex items-center justify-between">
                <div className="flex items-center">
                  <Wind className="mr-2 text-green-400" />
                  <span>Wind Speed</span>
                </div>
                <span>{environmentData.windSpeed} m/s</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

