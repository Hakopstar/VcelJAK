"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Switch } from "~/components/ui/switch"
import { useSession, signOut } from "next-auth/react"; // Added signOut
import { 
  Save, 
  RotateCcw,
  AlertCircle,
  RefreshCw 
  
} from "lucide-react"
import { toast } from "~/hooks/use-toast" 
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// Helper to format backend keys (e.g., "sound_pressure_level" to "Sound Pressure Level")
const formatKeyToLabel = (key: string): string => {
  if (!key) return "";
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

// Define comprehensive unit options for known measurement types
const measurementUnitOptions: Record<string, Array<{ value: string; label: string }>> = {
  temperature: [
    { value: "degC", label: "Celsius (°C)" },
    { value: "degF", label: "Fahrenheit (°F)" },
    { value: "K", label: "Kelvin (K)" },
  ],
  weight: [
    { value: "gram", label: "Grams (g)" },
    { value: "kg", label: "Kilograms (kg)" },
    { value: "lb", label: "Pounds (lb)" },
    { value: "oz", label: "Ounces (oz)" },
  ],
  sound: [ // Assuming 'sound' is the key for 'sound_pressure_level' after backend processing
    { value: "dB", label: "Decibels (dB)" },
    { value: "dBA", label: "Decibels A-weighted (dBA)" },
  ],
  light: [
    { value: "lux", label: "Lux (lx)" },
    { value: "fc", label: "Foot-candles (fc)" },
  ],
  speed: [
    { value: "m/s", label: "Meters per second (m/s)" },
    { value: "km/h", label: "Kilometers per hour (km/h)" },
    { value: "mph", label: "Miles per hour (mph)" },
    { value: "knot", label: "Knots (kn)" },
  ],
  pressure: [
    { value: "Pa", label: "Pascal (Pa)" },
    { value: "hPa", label: "Hectopascal (hPa)" },
    { value: "kPa", label: "Kilopascal (kPa)" },
    { value: "mbar", label: "Millibar (mbar)" },
    { value: "bar", label: "Bar (bar)" },
    { value: "atm", label: "Atmosphere (atm)" },
    { value: "psi", label: "Pounds per square inch (psi)" },
    { value: "mmHg", label: "Millimeters of mercury (mmHg)" },
  ],
  voltage: [
    { value: "mV", label: "Millivolts (mV)" },
    { value: "V", label: "Volts (V)" },
  ],
  wattage: [
    { value: "mW", label: "Milliwatts (mW)" },
    { value: "W", label: "Watts (W)" },
    { value: "kW", label: "Kilowatts (kW)" },
  ],
  memory: [ // Added Memory
    { value: "bytes", label: "Bytes (B)" },
    { value: "KB", label: "Kilobytes (KB)" },
    { value: "MB", label: "Megabytes (MB)" },
    { value: "GB", label: "Gigabytes (GB)" },
  ],
  network_strength: [ // Added Network Strength
    { value: "dBm", label: "Decibel-milliwatts (dBm)" },
    { value: "RSSI", label: "Received Signal Strength Ind. (RSSI)" },
    { value: "%", label: "Percentage (%)" },
  ],
  system_time: [ // Example for system_time if it were a configurable unit
    { value: "ms", label: "Milliseconds (ms)" },
    { value: "s", label: "Seconds (s)" },
  ],
  // Add other known measurement types and their units here
  // e.g. wind_vane: [{value: "deg", label: "Degrees (°)"}]
};

const systemSettingSelectOptions: Record<string, Array<{ value: string; label: string }>> = {
  backupFrequency: [ // Corresponds to 'backup_interval' in your DB image
    { value: "hourly", label: "Hourly" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ],
  // Add other system settings that should use a Select dropdown
  // e.g., theme: [{value: "light", label: "Light Mode"}, {value: "dark", label: "Dark Mode"}]
};


// Define the expected shape of your config object
interface MeasurementSetting {
  unit?: string;
  decimalPlaces?: number;
  lowest?: number | string; // Allow string for initial input
  highest?: number | string; // Allow string for initial input
  [key: string]: any; // For any other properties
}

interface SystemSettings {
  autoBackup?: boolean; // Corresponds to 'automatic' in your DB image
  backupFrequency?: string; // Corresponds to 'backup_interval'
  numberPrecision?: number; // Corresponds to 'number_precision'
  hardwareSessionExpire?: number; // Corresponds to 'hardware_session_expire'
  firstInit?: boolean | number; // Corresponds to 'first_init'
  [key: string]: any; // For other dynamic system settings
}
interface AppConfig {
  measurements: Record<string, MeasurementSetting>;
  system: SystemSettings;
}


export default function ConfigPage() {
  const [config, setConfig] = useState<AppConfig | undefined>(undefined);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.accessToken) {
      fetchConfig();
    } else if (status === "unauthenticated") {
      // Handle case where user is not logged in, e.g., redirect or show message
      setIsLoading(false);
      setError("Please log in to view the configuration.");
    }
    
  }, [status, session?.accessToken]); // Depend on accessToken to refetch if it changes
  
  const handleMeasurementChange = (measurementKey: string, property: string, value: string | number | boolean) => {
    if (!config) return;
    setConfig(prevConfig => ({
      ...prevConfig!,
      measurements: {
        ...prevConfig!.measurements,
        [measurementKey]: {
          ...prevConfig!.measurements[measurementKey],
          [property]: value,
        },
      },
    }));
    setHasChanges(true);
  };
  
  const fetchConfig = async () => {
    if (!session?.accessToken) {
      setError("Authentication token not available.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/access/config/get_config`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.accessToken}`
        },
      });

      if (!response.ok) {
        if (response.status === 401) signOut();
        throw new Error(`Failed to fetch configuration: ${response.status} ${response.statusText}`);
      }

      const data: AppConfig = await response.json();
      setConfig(data);
      setHasChanges(false);
      
    } catch (err: any) {
      console.error("Error fetching configuration:", err);
      setError(err.message || "Failed to load configuration. Please try again.");
      toast({
        title: "Error Fetching Config",
        description: err.message || "Failed to load configuration. Using default values or try refreshing.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSystemChange = (propertyKey: string, value: string | number | boolean) => {
    if (!config) return;
    setConfig(prevConfig => ({
      ...prevConfig!,
      system: {
        ...prevConfig!.system,
        [propertyKey]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    console.log("Saving")
    if (!session?.accessToken) {
      toast({ title: "Error", description: "Authentication details missing.", variant: "destructive" });

      return;
    }
    console.log("Well");
    setIsSaving(true);
    setError(null);
    try {
      console.log(`${API_BASE_URL}/access/config/update_config`)
      const response = await fetch(`${API_BASE_URL}/access/config/update_config`, { // Ensure API_BASE_URL is used
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`,
          "X-CSRF-TOKEN": session.csrftoken 
        },
        body: JSON.stringify(config),
      });
      if (response.status === 401) {
        signOut();
        return;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Try to get error message from body
        throw new Error(`Failed to save configuration: ${response.status} ${response.statusText}. ${errorData.detail || ''}`);
      }

      setHasChanges(false);
      toast({
        title: "Configuration Saved",
        description: "Your configuration changes have been saved successfully.",
      });
      fetchConfig(); // Refetch to confirm changes and get any backend-processed values
    } catch (err: any) {
      console.error("Error saving configuration:", err);
      setError(err.message || "Failed to save configuration. Please try again.");
      toast({
        title: "Error Saving Config",
        description: err.message || "Failed to save configuration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!session?.accessToken) {
      toast({ title: "Error", description: "Authentication details missing.", variant: "destructive" });
      return;
    }
    setIsSaving(true); // Use isSaving to disable buttons during reset
    setError(null);
      
    try {
      const response = await fetch(`${API_BASE_URL}/access/config/update_config`, { 
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`,
          "X-CSRF-TOKEN": session.csrftoken 
        },
        body: JSON.stringify({
          system: { 
            config_reset: true, // Or "True" if backend expects string
          },
        }),
      });
      if (response.status === 401) {
        signOut();
        return;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to reset configuration: ${response.status} ${response.statusText}. ${errorData.detail || ''}`);
      }
  
      setHasChanges(false); // Changes are gone after reset
      toast({
        title: "Configuration Reset",
        description: "Configuration has been requested to reset to defaults.",
      });
      fetchConfig(); // Fetch the new default configuration
    } catch (err: any) {
      console.error("Error resetting configuration:", err);
      setError(err.message || "Failed to reset configuration. Please try again.");
      toast({
        title: "Error Resetting Config",
        description: err.message || "Failed to reset configuration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session?.user?.name || !session?.accessToken) {
      setPasswordChangeError('User details or token not available.');
      return;
    }
    setIsChangingPassword(true);
    setPasswordChangeError(null);

    const payload = {
      new_password: newPassword,
      old_password: oldPassword, // Ensure this state variable is named oldPassword
      user: session.user.name,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/access/auth/change_password`, { // Check endpoint, was /access/change_password
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`,
          "X-CSRF-TOKEN": session.csrftoken
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => null);

      if (response.status === 401) {
        setPasswordChangeError(responseData?.detail || 'Invalid current password.');
      } else if (response.status === 400) {
        setPasswordChangeError(responseData?.detail || 'Password change request invalid (e.g., too short).');
      } else if (!response.ok) {
        setPasswordChangeError(responseData?.detail || 'Error changing password. Please try again.');
      } else {
        toast({ title: "Success", description: "Password changed successfully!" });
        setOldPassword('');
        setNewPassword('');
      }
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordChangeError('An unexpected error occurred while changing password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-10">Loading configuration...</div>;
  }

  if (error && !config) { // Show error prominently if config failed to load entirely
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Server Configuration</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Configuration</AlertTitle>
          <AlertDescription>
            {error} <Button variant="link" onClick={fetchConfig}>Try again</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (!config) { // Should be caught by isLoading or error, but as a fallback
    return <div className="text-center py-10">Configuration data is not available.</div>;
  }


  return (
    <div className="space-y-6 p-4 md:p-6">
      {error && ( // Display non-critical errors as a toast or inline message
         <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>An error occurred</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl lg:text-3xl font-bold">Server Configuration</h1>
        <div className="flex space-x-2 flex-wrap">
          <Button variant="outline" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving} >
            {isSaving && !hasChanges ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving && !hasChanges ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
      
        <Tabs defaultValue="measurements" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
            <TabsTrigger value="measurements">Measurement Units</TabsTrigger>
            <TabsTrigger value="system">System Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="measurements">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
              {Object.entries(config.measurements).map(([key, measurement]) => {
                const displayName = formatKeyToLabel(key);
                const unitsForThisType = measurementUnitOptions[key] || [];
                // Ensure current unit from DB is in options if not already there
                const currentUnitExistsInOptions = unitsForThisType.some(opt => opt.value === measurement.unit);
                if (measurement.unit && !currentUnitExistsInOptions) {
                    unitsForThisType.push({value: measurement.unit, label: `${measurement.unit} (current)`});
                }

                return (
                <Card key={key} className="bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>{displayName}</CardTitle>
                    <CardDescription>Configure {displayName.toLowerCase()} settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                  { !["humidity"].includes(key) && measurement.hasOwnProperty('unit') && ( // Only show unit if key is not humidity AND unit property exists
                    <div className="space-y-2">
                      <Label htmlFor={`${key}-unit`}>Unit</Label>
                      <Select
                        value={measurement.unit || ""} // Controlled component
                        onValueChange={(value) => handleMeasurementChange(key, "unit", value)}
                      >
                        <SelectTrigger id={`${key}-unit`}>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {unitsForThisType.length > 0 ? (
                            unitsForThisType.map(unitOpt => (
                              <SelectItem key={unitOpt.value} value={unitOpt.value}>{unitOpt.label}</SelectItem>
                            ))
                          ) : measurement.unit ? ( // Fallback if no predefined but DB has one
                             <SelectItem value={measurement.unit}>{measurement.unit}</SelectItem>
                          ) : (
                            <SelectItem value="" disabled>No units defined</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {measurement.hasOwnProperty('decimalPlaces') && (
                    <div className="space-y-2">
                      <Label htmlFor={`${key}-decimal`}>Decimal Places</Label>
                      <Select
                        value={(measurement.decimalPlaces ?? "").toString()} // Controlled
                        onValueChange={(value) => handleMeasurementChange(key, "decimalPlaces", Number.parseInt(value))}
                      >
                        <SelectTrigger id={`${key}-decimal`}>
                          <SelectValue placeholder="Select decimal places" />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3, 4].map(dp => ( // Extended options
                             <SelectItem key={dp} value={dp.toString()}>{dp}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {measurement.hasOwnProperty('lowest') && (
                      <div className="space-y-2">
                        <Label htmlFor={`${key}-lowest`}>Lowest Acceptable</Label>
                        <Input
                          id={`${key}-lowest`}
                          type="number"
                          value={measurement.lowest === null || measurement.lowest === undefined ? "" : String(measurement.lowest)}
                          onChange={(e) => handleMeasurementChange(key, "lowest", e.target.value === "" ? null : Number.parseFloat(e.target.value))}
                        />
                      </div>
                    )}
                    {measurement.hasOwnProperty('highest') && (
                      <div className="space-y-2">
                        <Label htmlFor={`${key}-highest`}>Highest Acceptable</Label>
                        <Input
                          id={`${key}-highest`}
                          type="number"
                          value={measurement.highest === null || measurement.highest === undefined ? "" : String(measurement.highest)}
                          onChange={(e) => handleMeasurementChange(key, "highest", e.target.value === "" ? null : Number.parseFloat(e.target.value))}
                        />
                      </div>
                    )}
                  </div>
                  </CardContent>
                </Card>
              )})}
            </div>
          </TabsContent>

          <TabsContent value="system">
            <Card className="bg-card/50 backdrop-blur-sm mt-4">
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Configure general system settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(config.system).map(([key, value]) => {
                  const displayName = formatKeyToLabel(key);
                  const selectOptions = systemSettingSelectOptions[key];

                  if (typeof value === 'boolean') {
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor={`system-${key}`}>{displayName}</Label>
                          {/* Optional: Add description based on key */}
                          {/* <p className="text-xs text-muted-foreground">Description for {displayName}</p> */}
                        </div>
                        <Switch
                          id={`system-${key}`}
                          checked={value}
                          onCheckedChange={(checked) => handleSystemChange(key, checked)}
                        />
                      </div>
                    );
                  } else if (selectOptions) {
                    return (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`system-${key}`}>{displayName}</Label>
                        <Select
                          value={String(value)}
                          onValueChange={(selectVal) => handleSystemChange(key, selectVal)}
                        >
                          <SelectTrigger id={`system-${key}`}>
                            <SelectValue placeholder={`Select ${displayName.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {selectOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  } else { // Default to text/number input
                    return (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`system-${key}`}>{displayName}</Label>
                        <Input
                          id={`system-${key}`}
                          type={typeof value === 'number' ? 'number' : 'text'}
                          value={String(value ?? '')}
                          onChange={(e) => handleSystemChange(key, 
                            typeof value === 'number' 
                              ? (e.target.value === "" ? null : Number.parseFloat(e.target.value)) 
                              : e.target.value
                          )}
                        />
                      </div>
                    );
                  }
                })}
                
                {/* Password Change Section - separated for clarity */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Change Password</h3>
                  {passwordChangeError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Password Change Error</AlertTitle>
                      <AlertDescription>{passwordChangeError}</AlertDescription>
                    </Alert>
                  )}
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="oldPassword">Current Password</Label>
                      <Input
                        id="oldPassword"
                        type="password"
                        placeholder="••••••••"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full md:w-auto" disabled={isChangingPassword}>
                      {isChangingPassword ? "Changing..." : "Set New Password"}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}