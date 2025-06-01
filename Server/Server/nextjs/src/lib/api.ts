import type { Beehive, Hive } from "../app/components/Schematic"; // Assuming Sensor type is no longer needed here

// Define TimeSpan type if not already defined globally
export type TimeSpan = "hour" | "day" | "week" | "month";

// Define the structure of the history data point
export type SensorHistoryPoint = {
  timestamp: string; // ISO string format
  value: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

// Fetch beehives data - CORRECTED URL
export async function fetchBeehives(): Promise<{ beehives: Beehive[]; hives: Hive[] }> {
  // Use the correct /api/ prefix
  const response = await fetch(`${API_BASE_URL}/sapi/beehives`);
  if (!response.ok) {
    const errorData = await response.text(); // Get more error details
    console.error("Failed to fetch beehives:", response.status, errorData);
    throw new Error(`Failed to fetch beehives: ${response.statusText}`);
  }
  try {
    return await response.json();
  } catch (e) {
     console.error("Failed to parse beehives JSON:", e);
     throw new Error("Received invalid data format for beehives.");
  }
}


export async function fetchSensorHistory(
  sensorId: string,
  timeRange: TimeSpan
): Promise<{ history: SensorHistoryPoint[] }> {
    if (!sensorId) {
        // Avoid making a request if no sensorId is provided
        return { history: [] };
    }
  // Use the correct /api/sensor-history endpoint and query parameters
  const response = await fetch(`${API_BASE_URL}/sapi/sensor-history?sensorId=${sensorId}&timeRange=${timeRange}`);
  if (!response.ok) {
     const errorData = await response.text();
     console.error("Failed to fetch sensor history:", response.status, errorData);
    throw new Error(`Failed to fetch sensor history for ${sensorId}: ${response.statusText}`);
  }
   try {
    return await response.json();
  } catch (e) {
     console.error("Failed to parse sensor history JSON:", e);
     throw new Error("Received invalid data format for sensor history.");
  }
}
