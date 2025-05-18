"use client"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { useState, useEffect } from 'react';
import { Progress } from "~/components/ui/progress"
import { useSSE } from "./SSEProvider";



export default function Dashboard() {
  
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
        <CardTitle>Hive Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className={`text-2xl font-bold ${getHealthText(healthValue)}`}>{healthValue}%</div>
          <Progress value={healthValue} className={`w-full ${getHealthColor(healthValue)}`} />
          <div className="text-xs text-muted-foreground">Overall hive health status</div>
        </div>
      </CardContent>
    </Card>
  )
}

