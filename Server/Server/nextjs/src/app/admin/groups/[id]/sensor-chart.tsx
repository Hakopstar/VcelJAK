"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fetchSensorHistory } from "../apis-detail"
import type { Sensor } from "../../types"
import { useSession } from "next-auth/react";

type SensorChartProps = {
  sensors: Sensor[]
}

export default function SensorChart({ sensors }: SensorChartProps) {
  const defaultSensorId = sensors && sensors.length > 0 ? sensors[0].id : ""
  const [selectedSensor, setSelectedSensor] = useState<string>(defaultSensorId)
  const [timeRange, setTimeRange] = useState<string>("day")
  const [chartData, setChartData] = useState<{ timestamp: string; value: number }[]>([])
  const [loading, setLoading] = useState(false)
  const { data: session, status } = useSession();

  const fetchData = useCallback(async () => {
    if (!selectedSensor) return

    setLoading(true)
    try {
      const historyData = await fetchSensorHistory(selectedSensor, timeRange, session)
      setChartData(historyData)
    } catch (error) {
      console.error("Error fetching sensor history:", error)
      // Use sensor's history data as fallback if API fails
      const sensor = sensors.find((s) => s.id === selectedSensor)
      if (sensor && sensor.history) {
        setChartData(sensor.history)
      } else {
        setChartData([])
      }
    } finally {
      setLoading(false)
    }
  }, [selectedSensor, timeRange, sensors])

  // Fetch sensor history data when sensor or time range changes
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle case when sensors array is empty
  if (!sensors || sensors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sensor Data</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">No sensor data available</p>
        </CardContent>
      </Card>
    )
  }

  const sensor = sensors.find((s) => s.id === selectedSensor)

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    if (timeRange === "hour") {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else if (timeRange === "day") {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else if (timeRange === "week") {
      return date.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" })
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" })
    }
  }

  const getChartColor = (sensorType: string) => {
    switch (sensorType) {
      case "Temperature":
        return "#ef4444"
      case "Humidity":
        return "#3b82f6"
      case "Weight":
        return "#10b981"
      case "Light":
        return "#f59e0b"
      case "Wind":
        return "#8b5cf6"
      default:
        return "#6b7280"
    }
  }

  const getUnit = (sensorType: string) => {
    switch (sensorType) {
      case "Temperature":
        return "°C"
      case "Humidity":
        return "%"
      case "Weight":
        return "kg"
      case "Light":
        return "lux"
      case "Wind":
        return "m/s"
      default:
        return ""
    }
  }

  if (!sensor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sensor Data</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">No sensor data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sensor Data</CardTitle>
        <div className="flex space-x-2">
          <Select value={selectedSensor} onValueChange={setSelectedSensor}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select sensor" />
            </SelectTrigger>
            <SelectContent>
              {sensors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Hour</SelectItem>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}${getUnit(sensor.type)}`}
                />
                <Tooltip
                  formatter={(value) => [`${value}${getUnit(sensor.type)}`, sensor.type]}
                  labelFormatter={(label) => formatTimestamp(label as string)}
                  contentStyle={{ backgroundColor: "rgba(0, 0, 0, 0.8)", border: "none" }}
                  labelStyle={{ color: "#fff" }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={getChartColor(sensor.type)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No data available for the selected time range</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
