"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { Search, RefreshCw, AlertCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { toast } from "~/hooks/use-toast"
import { useSession, signOut } from "next-auth/react";

// Define types for sensors and hubs
type Sensor = {
  id: string
  name: string
  type: string
  hubId: string
  hubName: string
  lastReading: string
  lastUpdate: string
}

type Hub = {
  id: string
  name: string
  connectedSensors: number
  lastUpdate: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';



export default function SensorsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [hubs, setHubs] = useState<Hub[]>([])
  const { data: session, status } = useSession();

  // Fetch sensors and hubs on component mount
  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, session]);


  const fetchData = async () => {
    
    setIsLoading(true)
    setError(null)
    try {
      // Fetch sensors
      const sensorsResponse = await fetch(`${API_BASE_URL}/access/sensors_hubs/get_info_sensors`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session?.accessToken}`
        },
      })
      if (sensorsResponse.status === 401) {
        signOut();
      }
      if (!sensorsResponse.ok) {
        throw new Error(`Failed to fetch sensors: ${sensorsResponse.status}`)
      }

      const sensorsData = await sensorsResponse.json()
      setSensors(sensorsData)

      // Fetch hubs
      const hubsResponse = await fetch(`${API_BASE_URL}/access/sensors_hubs/get_hub_info`,{
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session?.accessToken}`
        },
      })
      if (hubsResponse.status === 401) {
        signOut();
      }
      if (!hubsResponse.ok) {
        throw new Error(`Failed to fetch hubs: ${hubsResponse.status}`)
      }

      const hubsData = await hubsResponse.json()
      setHubs(hubsData)
    } catch (err) {
      console.error("Error fetching data:", err)
      setError("Failed to load data. Please try again later.")
      toast({
        title: "Error",
        description: "Failed to load data. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData()
    setIsRefreshing(false)
    toast({
      title: "Data refreshed",
      description: "Sensor and hub data has been updated.",
    })
  }

  const filteredSensors = sensors.filter(
    (sensor) =>
      sensor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sensor.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sensor.hubName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredHubs = hubs.filter((hub) => hub.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sensors & Hubs</h1>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sensors or hubs..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Tabs defaultValue="sensors">
        <TabsList>
          <TabsTrigger value="sensors">Sensors</TabsTrigger>
          <TabsTrigger value="hubs">Hardware Hubs</TabsTrigger>
        </TabsList>
        <TabsContent value="sensors">
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Sensor Status</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredSensors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "No sensors match your search." : "No sensors found."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Hub</TableHead>
                      <TableHead>Last Reading</TableHead>
                      <TableHead>Last Update</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSensors.map((sensor) => (
                      <TableRow key={sensor.id}>
                        <TableCell className="font-medium">{sensor.name}</TableCell>
                        <TableCell>{sensor.type}</TableCell>
                        <TableCell>{sensor.hubName}</TableCell>
                        <TableCell>{sensor.lastReading}</TableCell>
                        <TableCell>{sensor.lastUpdate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="hubs">
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Hardware Hubs</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredHubs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "No hubs match your search." : "No hubs found."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Connected Sensors</TableHead>
                      <TableHead>Last Update</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHubs.map((hub) => (
                      <TableRow key={hub.id}>
                        <TableCell className="font-medium">{hub.name}</TableCell>
                        <TableCell>{hub.connectedSensors}</TableCell>
                        <TableCell>{hub.lastUpdate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

