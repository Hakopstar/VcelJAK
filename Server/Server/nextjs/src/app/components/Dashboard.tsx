"use client"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { useState, useEffect } from 'react';
import { Progress } from "~/components/ui/progress"
import { useSSE } from "./SSEProvider";



export default function Dashboard() {
  /*
  const { data } = useSSE();
  if (data == null) {
    var healthPercentage = 0
  }
  else {
    var healthPercentage = data.health_value
  }
    */
  /*
  const [healthPercentage, sethealthPercentage] = useState(0);
  const [humidity, setHumidity] = useState(null);
  const [temperature, setTemperature] = useState(null);
  const [tips, setTips] = useState([]);

  useEffect(() => {
    const eventSource = new EventSource("http://localhost:5012/api/sse"); // Change to your SSE URL

    eventSource.onmessage = (event) => {
      const newData = JSON.parse(event.data);

      console.log("Received Data:", newData);

      if (newData.health_value !== undefined) sethealthPercentage(newData.health_value);
      if (newData.humidity !== undefined) setHumidity(newData.humidity);
      if (newData.temperature !== undefined) setTemperature(newData.temperature);
      if (Array.isArray(newData.tips)) setTips(newData.tips);
    };

    eventSource.onerror = () => {
      console.error("SSE connection error");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);
  */
  
  const { healthValue } = useSSE();



  const getHealthColor = (health: number) => {
    if (health >= 70) return "bg-green-500"
    if (health >= 20) return "bg-yellow-500"
    if (health >= 5) return "bg-red-500"
    return "bg-gray-900"
  }

  const getHealthText = (health: number) => {
    if (health >= 70) return "text-green-500"
    if (health >= 20) return "text-yellow-500"
    if (health >= 5) return "text-red-500"
    return "text-gray-900"
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/50 hover:border-2 hover:border-primary">
      <CardHeader className="pb-2">
        <CardTitle>Health Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Overall Health</span>
              <div className={`text-lg font-bold ${getHealthText(healthValue)}`}>{healthValue}%</div>
            </div>
            <Progress value={healthValue} className={`w-full ${getHealthColor(healthValue)}`} />
          </div>

        </div>
      </CardContent>
    </Card>
  )
}