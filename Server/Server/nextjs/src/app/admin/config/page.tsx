"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Switch } from "~/components/ui/switch"
import { useSession } from "next-auth/react";
import { 
  Save, 
  RotateCcw, 
  Plus,
  MoreHorizontal,
  Trash,
  Edit,
  LinkIcon,
  Link2OffIcon as LinkOff,
  Calendar,
  RefreshCw,
  AlertCircle, 
  ArrowLeft} from "lucide-react"
import { toast } from "~/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { undefined } from "zod"
// Initial configuration


export default function ConfigPage() {
  const [config, setConfig] = useState()
  const [hasChanges, setHasChanges] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newUser, setnewUser] = useState({ name: "", location: "" })
  const [isLoading, setIsLoading] = useState(false)
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      fetchConfig();
    }
  }, [status, session]);
  
  const handleMeasurementChange = (measurement: string, property: string, value: string | number | boolean) => {
    setConfig({
      ...config,
      measurements: {
        ...config.measurements,
        [measurement]: {
          ...config.measurements[measurement as keyof typeof config.measurements],
          [property]: value,
        },
      },
    })
    setHasChanges(true)
  }
  

  const fetchConfig = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/access/get_config`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session?.accessToken}`
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch configuration: ${response.status}`)
      }

      const data = await response.json()
      setConfig(data)
      setHasChanges(false)
      
    } catch (err) {
      console.error("Error fetching configuration:", err)
      setError("Failed to load configuration. Using default values.")
      toast({
        title: "Error",
        description: "Failed to load configuration. Using default values.",
        variant: "destructive",
      })
      // Use initial config as fallback\
    } finally {
      setIsLoading(false)
    }
  }

  const handleSystemChange = (property: string, value: string | number | boolean) => {
    setConfig({
      ...config,
      system: {
        ...config.system,
        [property]: value,
      },
    })
    setHasChanges(true)
  }


  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/access/update_config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify(config),
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to save configuration: ${response.status}`)
      }

      setHasChanges(false)
      toast({
        title: "Configuration saved",
        description: "Your configuration changes have been saved successfully.",
      })
      fetchConfig()
    } catch (err) {
      console.error("Error saving configuration:", err)
      setError("Failed to save configuration. Please try again.")
      toast({
        title: "Error",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
      fetchConfig()
    }
  }

  const handleReset = async () => {
   
      setIsSaving(true)
      setError(null)
      
      try {
        const response = await fetch(`/access/update_config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.accessToken}`,
            "X-CSRF-TOKEN": session?.csrftoken
          },
          body: JSON.stringify({
            system: {
              config_reset: "True",
            },
          }),
        })
        if (response.status === 401) {
          signOut();
        }
        if (!response.ok) {
          throw new Error(`Failed to save configuration: ${response.status}`)
        }
  
        setHasChanges(false)
        toast({
          title: "Configuration reset",
          description: "Your configuration has been reset to default values.",
        })
      } catch (err) {
        console.error("Error saving configuration:", err)
        setError("Failed to save configuration. Please try again.")
        toast({
          title: "Error",
          description: "Failed to save configuration. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
        fetchConfig()
        setHasChanges(false)
      }
  }
  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      "new_password": newPassword,
      "old_password": password,
      "user": session?.user?.name,
    };

    try {
      const response = await fetch(`/access/change_password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        setLoginError('Invalid Credentials!')
        
      } else if (!response.ok) {
        setLoginError('Error when changing password')
        
      } else {
        alert("Password changed successfully!");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      setLoginError('Error when changing password')
      
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Server Configuration</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>
      {config === undefined ? (
          <div className="text-center py-8 text-muted-foreground">
          Failed to load config
          </div>
        ) : config && (
          <Tabs defaultValue="measurements">
            <TabsList>
              <TabsTrigger value="measurements">Measurement Units</TabsTrigger>
              <TabsTrigger value="system">System Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="measurements">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
                {Object.entries(config.measurements).map(([key, measurement]) => (
                  <Card key={key} className="bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="capitalize">{key}</CardTitle>
                      <CardDescription>Configure {key} measurement settings</CardDescription>
                    </CardHeader>
          
                    <CardContent className="space-y-4">
                    { !["humidity"].includes(key)&& (
                      <div className="space-y-2">
                        <Label htmlFor={`${key}-unit`}>Unit</Label>
                        <Select
                          defaultValue={measurement.unit}
                          onValueChange={(value) => handleMeasurementChange(key, "unit", value)}
                        >
                          <SelectTrigger id={`${key}-unit`}>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {key === "temperature" && (
                              <>
                                <SelectItem value="degC">Celsius (°C)</SelectItem>
                                <SelectItem value="degF">Fahrenheit (°F)</SelectItem>
                              </>
                            )}
                            {key === "weight" && (
                              <>
                                <SelectItem value="gram">Grams (g)</SelectItem>
                                <SelectItem value="kg">Kilograms (kg)</SelectItem>
                                <SelectItem value="lb">Pounds (lb)</SelectItem>
                              </>
                            )}
                            {key === "sound" && <SelectItem value="dB">Decibels (dB)</SelectItem>}
                            {key === "light" && (
                              <>
                                <SelectItem value="lux">Lux (lux)</SelectItem>
                                <SelectItem value="fc">Foot-candles (fc)</SelectItem>
                              </>
                            )}
                            {key === "speed" && (
                              <>
                                <SelectItem value="m/s">Meters per second (m/s)</SelectItem>
                                <SelectItem value="km/h">Kilometer per hour (km/h)</SelectItem>
                                <SelectItem value="mph">Miles per hour (mph)</SelectItem>
                              </>
                            )}
                            {key === "pressure" && (
                              <>
                                <SelectItem value="Pa">Pascal (Pa)</SelectItem>
                                <SelectItem value="hPa">Hectopascal (hPa)</SelectItem>
                                <SelectItem value="kPa">Kilopascal (kPa)</SelectItem>
                                <SelectItem value="mbar">Millibar (mbar)</SelectItem>
                                <SelectItem value="bar">Bar (bar)</SelectItem>
                                <SelectItem value="atm">Atmosphere (atm)</SelectItem>
                                <SelectItem value="psi">Pound per square inch (psi)</SelectItem>
                              </>
                            )}
                            {key === "voltage" && (
                              <>
                                <SelectItem value="mV">Milivolts (mV)</SelectItem>
                                <SelectItem value="V">Volt (V)</SelectItem>
                              </>
                            )}
                            {key === "wattage" && (
                              <>
                                <SelectItem value="mW">Miliwatt (mW)</SelectItem>
                                <SelectItem value="W">Watt (W)</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                        )}
                    
                      <div className="space-y-2">
                        <Label htmlFor={`${key}-decimal`}>Decimal Places</Label>
                        <Select
                          defaultValue={measurement.decimalPlaces.toString()}
                          onValueChange={(value) => handleMeasurementChange(key, "decimalPlaces", Number.parseInt(value))}
                        >
                          <SelectTrigger id={`${key}-decimal`}>
                            <SelectValue placeholder="Select decimal places" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0</SelectItem>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-min`}>Lowest</Label>
                          <Input
                            id={`${key}-min`}
                            type="number"
                            value={String(measurement.lowest)}
                            onChange={(e) => handleMeasurementChange(key, "lowest", Number.parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-max`}>Highest</Label>
                          <Input
                            id={`${key}-max`}
                            type="number"
                            value={String(measurement.highest)}
                            onChange={(e) => handleMeasurementChange(key, "highest", Number.parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="system">
              <Card className="bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>Configure general system settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Backup Settings</h3>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="auto-backup">Automatic Backup</Label>
                        <p className="text-xs text-muted-foreground">Automatically backup system data</p>
                      </div>
                      <Switch
                        id="auto-backup"
                        checked={config.system.autoBackup}
                        onCheckedChange={(checked) => handleSystemChange("autoBackup", checked)}
                      />
                    </div>

                    {config.system.autoBackup && (
                      <div className="space-y-2">
                        <Label htmlFor="backup-frequency">Backup Frequency</Label>
                        <Select
                          defaultValue={config.system.backupFrequency}
                          onValueChange={(value) => handleSystemChange("backupFrequency", value)}
                        >
                          <SelectTrigger id="backup-frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  {loginError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{loginError}</AlertDescription>
                    </Alert>
                  )}
                  <form onSubmit={handleChangePassword}>
                    <div className="space-y-4">
          
                      <div className="space-y-2">
                        <Label htmlFor="oldPassword">Old Password</Label>
                        <Input
                          id="oldPassword"
                          type="oldPassword"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="newPassword"
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex items-center justify-between">
                      </div>
                    </div>
                    <Button effect="ringHover" type="submit" className="w-half mt-6" disabled={isLoading}>
                      {isLoading ? "Setting new password in..." : "Set new password"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          
          </Tabs>
      )}
    </div>
  )
}

