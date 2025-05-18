"use client";

import { useState } from "react"
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { ScrollArea } from "~/components/ui/scroll-area"
import { X, RefreshCw, Clock} from "lucide-react"

export type Sensor = {
  id: string
  name: string
  timestamp: string
  [key: string]: number | string
}

async function fetchSensor(): Promise<Sensor[]> {
  const response = await fetch(`/sapi/sensors`);
  if (!response.ok) {
    throw new Error("Network reponse failed")
  }
  return response.json();
}


type SchematicProps = {
  selectedSensor: Sensor | null
  onSensorClick: (sensor: Sensor) => void;
};

export default function Schematic({ onSensorClick }: SchematicProps) {
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);

  const { data, error, isLoading, isError } = useQuery({
    queryKey: ["sensors"],
    queryFn: fetchSensor,
  });

  const handleSensorClick = (sensor: Sensor) => {
    // Toggle selection if clicking the same sensor
    if (selectedSensor?.id === sensor.id) {
      setSelectedSensor(null);
      onSensorClick(null)
    
    } else {
      onSensorClick(sensor)
      setSelectedSensor(sensor);

      
    }
  }

  const closeDetails = () => {
    onSensorClick(null);
    setSelectedSensor(null);
  }
  

  

  

    return (
      <Card className="bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/50 hover:border-2 hover:border-primary">
        <CardHeader>
          <CardTitle>Beehive Schematic</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? ( 
              <div className="flex justify-center items-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
             </div>
            ) : isError ? (
              <div className="text-center py-8 text-muted-foreground">Failed to connect beehives</div> 
            ) : data && data.length > 0 ? (
              <div className="aspect-square w-full max-w-md mx-auto grid grid-cols-2 gap-4">
                {data?.map((sensor) => (
                  <button
                    key={sensor.id}
                    className={`relative bg-muted/20 rounded-lg flex items-center justify-center transition-all ${
                      selectedSensor?.id === sensor.id
                        ? "border-2 border-primary ring-2 ring-primary/30"
                        : "border-2 border-border hover:border-primary/50"
                    }`}
                    style={{ aspectRatio: "1" }}
                    onClick={() => handleSensorClick(sensor)}
                  >
                    <span
                      className={`text-lg font-medium ${
                        selectedSensor?.id === sensor.id ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {sensor.name}
                    </span>
                  </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No Beehives connected
            </div>
          )}
          
            
          
          
          {selectedSensor && (
            <div className="p-4 border border-border rounded-lg bg-muted/20">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">
                  Beehive Details <span className="text-primary">ID: {selectedSensor.id}</span>
                </h3>
                <button onClick={closeDetails} className="text-muted-foreground hover:text-primary">
                  <X size={18} />
                </button>
              </div>
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span>{selectedSensor.name}</span>
                  </div>
                  {Object.entries(selectedSensor)
                    .filter(([key]) => key !== "id" && key !== "timestamp" && key !== "name")
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key}:</span>
                        <span>{value}</span>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    )
}
