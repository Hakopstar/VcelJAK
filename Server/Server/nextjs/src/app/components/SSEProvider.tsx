// context/SSEContext.js
"use client"
import { createContext, useContext, useEffect, useState } from "react";


interface SSEData {
  healthValue: number | null;
  humidity: number | null;
  temperature: number | null;
  windSpeed: number | null;
  tips: string[];
}
const SSEContext = createContext<SSEData | undefined>(undefined);
// Create SSE Context


// SSE Provider Component
export const SSEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [healthValue, setHealthValue] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [windSpeed, setWindSpeed] = useState<number | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const AUTH_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    const connect = () => {
      console.log(process.env.NEXT_PUBLIC_API_BASE_URL)
        eventSource = new EventSource(`${AUTH_BASE}/sse/stream`); 

        eventSource.onmessage = (event) => {
            try {
                const newData = JSON.parse(event.data);
                console.log("Received Data:", newData);

                if (newData.health_value !== undefined) setHealthValue(newData.health_value);
                if (newData.humidity !== undefined) setHumidity(newData.humidity);
                if (newData.temperature !== undefined) setTemperature(newData.temperature);
                if (newData.wind_speed !== undefined) setWindSpeed(newData.wind_speed);
                if (Array.isArray(newData.tips)) setTips(newData.tips);

                setError(null); // Reset error when data is received
            } catch (err) {
                setError("Error parsing SSE data");
            }
        };

        eventSource.onerror = () => {
            setError("SSE connection lost. Retrying in 5 seconds...");
            eventSource?.close();

            // Retry connection after 5 seconds
            retryTimeout = setTimeout(connect, 5000);
        };
    };

    connect(); // Initial connection

    return () => {
        eventSource?.close(); // Cleanup SSE on unmount
        if (retryTimeout) clearTimeout(retryTimeout); // Clear any pending reconnection attempts
    };
}, []);

  return (
    <SSEContext.Provider value={{ healthValue, humidity, temperature, windSpeed, tips }}>
      {children}
    </SSEContext.Provider>
  );
};

// Custom Hook to Access SSE Data
export const useSSE = () => useContext(SSEContext);
