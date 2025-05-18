import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Thermometer, Droplets, Wind } from "lucide-react"
import { useSSE } from "./SSEProvider";


export default function EnvironmentPanel() {
  const { humidity, temperature, windSpeed } = useSSE();
  return (
    <Card className="bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/50 hover:border-2 hover:border-primary">
      <CardHeader>
        <CardTitle className="text-xl">Environment Data</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          <li className="flex items-center justify-between">
            <div className="flex items-center">
              <Thermometer className="mr-2 text-red-400" />
              <span>Temperature</span>
            </div>
            <span className="text-lg font-semibold">{temperature}°C</span>
          </li>
          <li className="flex items-center justify-between">
            <div className="flex items-center">
              <Droplets className="mr-2 text-blue-400" />
              <span>Humidity</span>
            </div>
            <span className="text-lg font-semibold">{humidity}%</span>
          </li>
          <li className="flex items-center justify-between">
            <div className="flex items-center">
              <Wind className="mr-2 text-green-400" />
              <span>Wind Speed</span>
            </div>
            <span className="text-lg font-semibold">{windSpeed} m/s</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  )
}

