"use client"

import { useState, useEffect, useMemo } from "react" // Added useMemo
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"

import type { Beehive, EmbeddedSensor } from "../Schematic" // Adjust path as necessary
import { fetchSensorHistory, type TimeSpan, type SensorHistoryPoint } from "../../lib/api"

// Define a list of colors for the lines
const LINE_COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#387908",
  "#00C49F", "#FFBB28", "#FF8042", "#A28DFF", "#FFD700",
  "#E91E63", "#673AB7", "#2196F3", "#4CAF50", "#FF9800"
];

type GraphsProps = {
  selectedBeehive: Beehive | null
}

// Loosen SensorHistoryPoint to allow for additional keys beyond 'value'
// This makes the component ready for a richer data structure from the API in the future.
type FlexibleSensorHistoryPoint = {
  timestamp: string;
  value?: number; // Still support the original 'value' key
  [key: string]: any; // Allow other keys for different measurements
};

const formatTimestamp = (timestamp: string, timeSpan: TimeSpan) => {
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return "Invalid Date"; // Handle invalid date strings
  switch (timeSpan) {
    case "hour":
    case "day":
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    case "week":
    case "month":
      return date.toLocaleDateString([], { month: "numeric", day: "numeric" })
    default:
        return date.toISOString();
  }
}

// Helper to capitalize measurement names for the legend
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Graphs({ selectedBeehive }: GraphsProps) {
  const [timeSpan, setTimeSpan] = useState<TimeSpan>("day")
  const [graphedSensorId, setGraphedSensorId] = useState<string | null>(null)
  // Store history data with the flexible type
  const [historyData, setHistoryData] = useState<FlexibleSensorHistoryPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Determine available measurement keys from the fetched data
  const measurementKeys = useMemo(() => {
    if (historyData.length === 0) return [];
    // Get all keys from the first data point, excluding 'timestamp'
    const keys = Object.keys(historyData[0]).filter(key => key !== 'timestamp');
    // If only 'value' is present and it's null/undefined in most points,
    // it might indicate no actual measurements. For now, we assume any non-timestamp key is a measurement.
    return keys;
  }, [historyData]);

  useEffect(() => {
    if (selectedBeehive && selectedBeehive.sensors && selectedBeehive.sensors.length > 0) {
      setGraphedSensorId(selectedBeehive.sensors[0].id)
    } else {
      setGraphedSensorId(null)
    }
  }, [selectedBeehive])

  // TODO: NEED TO OPTION TO FETCH MORE SENSORS, and better graphs. - little bit future proof
  useEffect(() => {
    async function loadSensorHistory() {
      if (graphedSensorId) {
        try {
          setLoading(true)
          setError(null);
          // fetchSensorHistory currently returns SensorHistoryPoint[]
          // We cast it to FlexibleSensorHistoryPoint[] to prepare for future API enhancements
          const data = await fetchSensorHistory(graphedSensorId, timeSpan) as { history: FlexibleSensorHistoryPoint[] };
          setHistoryData(data.history || [])
        } catch (err: any) {
          console.error("Graphs: Failed to fetch sensor data:", err)
          setError(err.message || "Failed to load sensor history.")
          setHistoryData([])
        } finally {
          setLoading(false)
        }
      } else {
        setHistoryData([])
        setError(null);
        setLoading(false);
      }
    }
    loadSensorHistory()
  }, [graphedSensorId, timeSpan])

  const availableSensors = selectedBeehive?.sensors || [];

  if (!selectedBeehive) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6 flex items-center justify-center min-h-[400px]">
          <p className="text-center text-muted-foreground">Select a beehive to view its sensor data.</p>
        </CardContent>
      </Card>
    )
  }

  if (availableSensors.length === 0 && !loading) {
     return (
      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader><CardTitle>Sensor Data for {selectedBeehive.name}</CardTitle></CardHeader>
        <CardContent className="p-6 flex items-center justify-center min-h-[328px]">
          <p className="text-center text-muted-foreground">{selectedBeehive.name} has no sensors.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <CardTitle className="truncate max-w-xs md:max-w-md lg:max-w-lg">
          {selectedBeehive.name} - {graphedSensorId ? `Sensor: ${graphedSensorId}`: "No Sensor Selected"}
        </CardTitle>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {availableSensors.length > 0 && (
            <Select
              value={graphedSensorId ?? ""}
              onValueChange={(sensorId: string) => setGraphedSensorId(sensorId)}
              disabled={availableSensors.length === 0}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select sensor" />
              </SelectTrigger>
              <SelectContent>
                {availableSensors.map((sensor: EmbeddedSensor) => (
                  <SelectItem key={sensor.id} value={sensor.id}>Sensor {sensor.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={timeSpan} onValueChange={(value: TimeSpan) => setTimeSpan(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Time span" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Last Hour</SelectItem>
              <SelectItem value="day">Last 24 Hours</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="min-h-[400px]">
        {loading && (
          <div className="flex justify-center items-center h-full min-h-[350px]">
            <div className="animate-pulse text-primary">Loading sensor data...</div>
          </div>
        )}
        {!loading && error && (
             <div className="flex justify-center items-center h-full min-h-[350px]">
                <p className="text-red-500 px-4 text-center">{error}</p>
             </div>
        )}
        {!loading && !error && historyData.length === 0 && graphedSensorId && (
            <div className="flex justify-center items-center h-full min-h-[350px]">
                <p className="text-center text-muted-foreground px-4">No historical data for sensor {graphedSensorId} in this time range.</p>
             </div>
        )}
        {!loading && !error && historyData.length > 0 && measurementKeys.length === 0 && graphedSensorId && (
             <div className="flex justify-center items-center h-full min-h-[350px]">
                <p className="text-center text-muted-foreground px-4">Sensor {graphedSensorId} provided data, but no measurable values found.</p>
             </div>
        )}
        {!loading && !error && historyData.length > 0 && measurementKeys.length > 0 && (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
              <XAxis
                dataKey="timestamp"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatTimestamp(value, timeSpan)}
              />
              <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  // Allow Y axis to adjust, or you might need multiple Y axes if scales differ vastly
                  // domain={['auto', 'auto']}
               />
              <Tooltip
                contentStyle={{ backgroundColor: "rgba(20, 20, 20, 0.9)", border: "1px solid #555", borderRadius: "0.5rem" }}
                labelStyle={{ color: "#fff", fontWeight: "bold", marginBottom: "0.25rem" }}
                itemStyle={{color: "#eee"}}
                formatter={(value: number, name: string) => [value != null ? value.toFixed(2) : "N/A", capitalize(name)]}
                labelFormatter={(label: string) => `Time: ${formatTimestamp(label, timeSpan)}`}
              />
              <Legend wrapperStyle={{paddingTop: "20px"}} formatter={(value) => capitalize(value)} />
              {measurementKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={LINE_COLORS[index % LINE_COLORS.length]} // Cycle through colors
                  strokeWidth={2}
                  dot={false}
                  name={capitalize(key)} // Use the key as the name for the legend
                  activeDot={{ r: 6 }}
                  connectNulls={true} // Optional: connect lines even if there are null values
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
         {!loading && !error && !graphedSensorId && (
            <div className="flex justify-center items-center h-full min-h-[350px]">
              <p className="text-center text-muted-foreground">Please select a sensor to display its data.</p>
            </div>
        )}
      </CardContent>
    </Card>
  )
}