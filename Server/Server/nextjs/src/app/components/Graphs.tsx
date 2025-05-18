"use client"

import { useState, useMemo, useEffect} from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Switch } from "~/components/ui/switch"
import { Label } from "~/components/ui/label"
import type { Sensor } from "./Schematic"


type GraphsProps = {
  selectedSensor: Sensor | null
}

type TimeSpan = "hour" | "day" | "week" | "month" | "year"

const colors = [
  "#ffcc00",
  "#00ccff",
  "#ff00cc",
  "#4ade80",
  "#f472b6",
  "#60a5fa",
  "#c084fc",
  "#fbbf24",
  "#34d399",
  "#fb7185",
]


const formatTimestamp = (timestamp: string, timeSpan: TimeSpan) => {
  const date = new Date(timestamp)
  switch (timeSpan) {
    case "hour":
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    case "day":
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    case "week":
      return date.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" })
    case "month":
      return date.toLocaleDateString([], { month: "short", day: "numeric" })
    case "year":
        return date.toLocaleDateString([], { month: "short"})
  }
}


const fetchSensorData = async (sensorId: string, timeScale: string) => {
  const response = await fetch(`/sapi/beehive?beehiveId=${sensorId}&timeScale=${timeScale}`);
  if (!response.ok) throw new Error("Failed to fetch data");
  return response.json();
};


export default function Graphs({ selectedSensor }: { selectedSensor: Sensor | null }) {
  const [timeSpan, setTimeSpan] = useState<TimeSpan>("day")
  const [visibleMeasurements, setVisibleMeasurements] = useState<Record<string, boolean>>({})




  const { data, isLoading, isError } = useQuery({
    queryKey: ["sensorData", selectedSensor?.id, timeSpan],
    queryFn: () => (selectedSensor ? fetchSensorData(selectedSensor.id, timeSpan) : Promise.resolve(null)),
    enabled: !!selectedSensor,
  })



  const measurements = useMemo(
    () => (selectedSensor ? Object.keys(selectedSensor).filter((key) => key !== "id" && key !== "timestamp" && key !== "name") : []),
    [selectedSensor],
  )

  useEffect(() => {
    if (selectedSensor) {
      const initialVisibility = Object.fromEntries(measurements.map((measurement) => [measurement, true]))
      setVisibleMeasurements(initialVisibility)
    }
  }, [selectedSensor, measurements])

  
  const toggleMeasurement = (measurement: string) => {
    setVisibleMeasurements((prev) => ({ ...prev, [measurement]: !prev[measurement] }))
  }

  
  if (!selectedSensor) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/50 hover:border-2 hover:border-primary">
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Select a sensor from the schematic to view its data.</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/50 hover:border-2 hover:border-primary">
    <CardHeader className="flex flex-row items-center justify-between">
      <CardTitle>Sensor Data (Section {selectedSensor.id})</CardTitle>
      <Select value={timeSpan} onValueChange={(value: TimeSpan) => setTimeSpan(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time span" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hour">Last Hour</SelectItem>
            <SelectItem value="day">Last 24 Hours</SelectItem>
            <SelectItem value="week">Last Week</SelectItem>
            <SelectItem value="month">Last Month</SelectItem>
            <SelectItem value="year">Last Year</SelectItem>
          </SelectContent>
        </Select>
    </CardHeader>
    <CardContent>
    <div className="mb-4 flex flex-wrap gap-4">
          {measurements.map((measurement, index) => (
            <div key={measurement} className="flex items-center space-x-2">
              <Switch
                id={`show-${measurement}`}
                checked={visibleMeasurements[measurement] !== false}
                onCheckedChange={() => toggleMeasurement(measurement)}
              />
              <Label htmlFor={`show-${measurement}`} className="capitalize">
                {measurement}
              </Label>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <XAxis
              dataKey="timestamp"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatTimestamp(value, timeSpan)}
            />
            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: "rgba(0, 0, 0, 0.8)", border: "none" }}
              labelStyle={{ color: "#fff" }}
              labelFormatter={(value) => formatTimestamp(value, timeSpan)}
            />
            <Legend />
            {measurements.map(
              (measurement, index) =>
                visibleMeasurements[measurement] !== false && (
                  <Line
                    key={measurement}
                    type="monotone"
                    dataKey={measurement}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    name={measurement.charAt(0).toUpperCase() + measurement.slice(1)}
                  />
                ),
            )}
          </LineChart>
        </ResponsiveContainer>
    </CardContent>
  </Card>
  )
}
