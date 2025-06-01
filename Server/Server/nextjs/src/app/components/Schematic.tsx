"use client"

import { useEffect, useState } from "react"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { X, ChevronRight } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { fetchBeehives } from "../../lib/api"

// Sensor type for detailed sensor data (if fetched from a dedicated endpoint in the future)
export type Sensor = {
  id: string
  value: number
  measurement: string // Typically a string like "°C", "%"
  last_update: string
  timestamp: string
  [key: string]: number | string
}

// Type for sensor data as embedded within the Beehive object from the API
export type EmbeddedSensor = {
  id: string;
  value: number;
  measurement: string;
  last_update: string; // Formatted time string from API (e.g., "HH:MM:SS")
};

export type Tag = {
  tag_id: string
  tag_name: string // Name of the tag (e.g., "Normal", "Swarm Alert")
  tag_type: string // Type of the tag (e.g., "mode", "status", "observation")
}

export type Beehive = {
  id: string
  name: string
  type: "beehive"
  location: string
  health: number
  lastInspection: string
  sensors: EmbeddedSensor[]
  subgroups?: string[]
  tags: Tag[]
  timestamp: string
}

export type Hive = {
  id: string
  name: string
  type: "hive"
  parentId: string
  description: string
  sensors: string[]
}

type FetchedData = {
  beehives: Beehive[]
  hives: Hive[]
}

type SchematicProps = {
  selectedBeehive: Beehive | null
  onBeehiveClick: (beehive: Beehive | null) => void
}

const formatTimeToReadableString = (isoString: string | undefined): string => {
  if (!isoString) return "N/A";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (error) {
    return "Error";
  }
};

const formatDateTimeReadable = (isoString: string | undefined): string => {
    if (!isoString) return "N/A";
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return "Invalid Date";
        return date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return "Error";
    }
};

// Helper function to extract mode from tags
const getBeehiveMode = (tags: Tag[] | undefined): string | undefined => {
  if (!tags) return undefined;
  const modeTag = tags.find(tag => tag.tag_type?.toLowerCase() === "mode"); // Added toLowerCase for robustness
  return modeTag?.tag_name;
};


export default function Schematic({ selectedBeehive, onBeehiveClick }: SchematicProps) {
  const [beehives, setBeehives] = useState<Beehive[]>([])
  const [hives, setHives] = useState<Hive[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const data = await fetchBeehives()
        setBeehives(data.beehives || [])
        setHives(data.hives || [])
        setError(null)
      } catch (err) {
        console.error("Failed to fetch data:", err)
        setError("Failed to load data. Please try again later.")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleBeehiveClick = (beehive: Beehive) => {
    if (selectedBeehive?.id === beehive.id) {
      onBeehiveClick(null)
    } else {
      onBeehiveClick(beehive)
    }
  }

  const closeDetails = () => {
    onBeehiveClick(null)
  }

  const getHealthColor = (health: number) => {
    if (health >= 80) return "text-green-500"
    if (health >= 60) return "text-yellow-500"
    return "text-red-500"
  }

  // getModeBadge now expects the mode string directly
  const getModeBadge = (mode: string | undefined) => {
    if (!mode) return <Badge variant="outline">Unknown</Badge>;
    switch (mode.toLowerCase()) {
      case "normal":
        return <Badge variant="default">Normal</Badge>
      case "curing":
        return <Badge variant="destructive">Curing</Badge>
      case "winter":
        return <Badge variant="secondary">Winter</Badge>
      default:
        // If mode is something else from a tag, display it as is
        return <Badge variant="outline">{mode.charAt(0).toUpperCase() + mode.slice(1)}</Badge>
    }
  }

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/50 hover:border-2 hover:border-primary">
        <CardHeader><CardTitle>Beehive Schematic</CardTitle></CardHeader>
        <CardContent><div className="flex justify-center items-center h-40"><div className="animate-pulse text-primary">Loading beehive data...</div></div></CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/50 hover:border-2 hover:border-primary">
        <CardHeader><CardTitle>Beehive Schematic</CardTitle></CardHeader>
        <CardContent><div className="flex justify-center items-center h-40"><div className="text-red-500">{error}</div></div></CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/50 hover:border-2 hover:border-primary">
      <CardHeader><CardTitle>Beehive Schematic</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {beehives.map((beehive) => {
            const mode = getBeehiveMode(beehive.tags); // Get mode from tags
            return (
              <button
                key={beehive.id}
                className={`relative bg-muted/20 rounded-lg flex flex-col items-center justify-center transition-all p-4 ${
                  selectedBeehive?.id === beehive.id
                    ? "border-2 border-primary ring-2 ring-primary/30"
                    : "border-2 border-border hover:border-primary/50"
                }`}
                style={{ minHeight: "150px" }}
                onClick={() => handleBeehiveClick(beehive)}
              >
                <span className="text-2xl mb-2">🐝</span>
                <span className={`text-lg font-medium ${selectedBeehive?.id === beehive.id ? "text-primary" : "text-foreground"}`}>
                  {beehive.name}
                </span>
                <span className="text-sm text-muted-foreground">{beehive.location}</span>
                <div className="mt-2 flex items-center space-x-2">
                  <span className={`text-sm font-medium ${getHealthColor(beehive.health ?? 0)}`}>
                    {(beehive.health ?? 0)}% Health
                  </span>
                  <span className="text-muted-foreground">•</span>
                  {getModeBadge(mode)} {/* Pass derived mode to badge function */}
                </div>
              </button>
            );
          })}
        </div>

        {selectedBeehive && (
          <div className="p-4 border border-border rounded-lg bg-muted/20">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold flex items-center">
                <span className="text-primary mr-2">🐝</span>
                {selectedBeehive.name}
              </h3>
              <button onClick={closeDetails} className="text-muted-foreground hover:text-primary">
                <X size={18} />
              </button>
            </div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <div>{selectedBeehive.location}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Health:</span>
                    <div className={getHealthColor(selectedBeehive.health ?? 0)}>{(selectedBeehive.health ?? 0)}%</div>
                  </div>
                 
                  <div>
                    <span className="text-muted-foreground">Mode:</span>
                    {/* Get mode from tags for the selected beehive details */}
                    <div>{getModeBadge(getBeehiveMode(selectedBeehive.tags))}</div>
                  </div>
                   <div>
                    <span className="text-muted-foreground">Data Timestamp:</span>
                    <div>{formatDateTimeReadable(selectedBeehive.timestamp)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(selectedBeehive.tags ?? []).length > 0 ? (
                        selectedBeehive.tags.map((tag) => (
                          // Display all tags, including the one that might be used for mode
                          <Badge key={tag.tag_id} variant="secondary">
                            {tag.tag_name} ({tag.tag_type}) {/* Displaying both name and type for clarity */}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {selectedBeehive.subgroups && selectedBeehive.subgroups.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Hive Components:</h4>
                    <div className="space-y-2">
                      {selectedBeehive.subgroups.map((subgroupId) => {
                        const hive = hives.find((h) => h.id === subgroupId)
                        return hive ? (
                          <div key={hive.id} className="p-2 border bg-background/30 rounded-md flex justify-between items-center text-sm">
                            <div>
                              <div className="font-medium">{hive.name}</div>
                              <div className="text-xs text-muted-foreground">{hive.description}</div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                )}

                {selectedBeehive.sensors && selectedBeehive.sensors.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Sensor Data:</h4>
                    <div className="space-y-3">
                      {selectedBeehive.sensors.map((sensor) => {
                        const excludedKeys = ['id', 'value', 'measurement', 'last_update'];
                        const dynamicReadingKeys = Object.keys(sensor).filter(
                          key => !excludedKeys.includes(key as keyof EmbeddedSensor)
                        );

                        return (
                          <div key={sensor.id} className="p-3 border bg-background/30 rounded-md space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground font-medium">Sensor: {sensor.id}</span>
                                <span className="text-xs text-muted-foreground">
                                  Updated: {sensor.last_update || "N/A"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Value:</span>
                              <span>{sensor.value} {sensor.measurement && `(${sensor.measurement})`}</span>
                            </div>

                            {dynamicReadingKeys.length > 0 ? (
                              dynamicReadingKeys.map(key => {
                                const displayName = key.charAt(0).toUpperCase() + key.slice(1);
                                return (
                                  <div key={key} className="flex justify-between">
                                    <span className="text-muted-foreground">{displayName}:</span>
                                    <span>{String(sensor[key as keyof EmbeddedSensor])}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-muted-foreground text-xs">No additional specific readings.</div>
                            )}
                          </div>
                        );
                      })}
                       {selectedBeehive.sensors.length === 0 && (
                            <p className="text-sm text-muted-foreground">No sensor data available for this beehive.</p>
                       )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  )
}