"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Checkbox } from "~/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import {
  Plus,
  MoreHorizontal,
  Trash,
  Edit,
  LinkIcon,
  Link2OffIcon as LinkOff,
  Calendar,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { toast } from "~/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { format } from "date-fns"
import { Calendar as CalendarComponent } from "~/components/ui/calendar"
import { DatePicker } from "~/components/ui/date-picker"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { useSession, signOut } from "next-auth/react";

// Define types
type Beehive = {
  id: string
  name: string
  location: string
  sensors: string[]
  lastInspection: string
}

type Sensor = {
  id: string
  name: string
  type: string
  hubId: string | null
}

export default function BeehivesPage() {
  const [beehives, setBeehives] = useState<Beehive[]>([])
  const [allSensors, setAllSensors] = useState<Sensor[]>([])
  const [newBeehive, setNewBeehive] = useState({ name: "", location: "" })
  const [editBeehive, setEditBeehive] = useState<Beehive | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [beehiveToDelete, setBeehiveToDelete] = useState<string | null>(null)
  const [isAssignSensorDialogOpen, setIsAssignSensorDialogOpen] = useState(false)
  const [selectedBeehive, setSelectedBeehive] = useState<string | null>(null)
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null)
  const [overrideAssignment, setOverrideAssignment] = useState(false)
  const [isCalibrationDialogOpen, setIsCalibrationDialogOpen] = useState(false)
  const [calibrationStep, setCalibrationStep] = useState(1)
  const [calibrationSensor, setCalibrationSensor] = useState<Sensor | null>(null)
  const [calibrationValue, setCalibrationValue] = useState("")

  // Add state for inspection date dialog
  const [isInspectionDialogOpen, setIsInspectionDialogOpen] = useState(false)
  const [inspectionBeehive, setInspectionBeehive] = useState<Beehive | null>(null)
  const [inspectionDate, setInspectionDate] = useState<Date | undefined>(undefined)

  // Add loading and error states
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { data: session, status } = useSession();

  // Fetch beehives and sensors on component mount
  useEffect(() => {
   
    if (status === "authenticated") {
      fetchBeehives()
      fetchSensors()
    }
  }, [status, session])

  const fetchBeehives = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/access/get_beehives`,{
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session?.accessToken}`
        },
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch beehives: ${response.status}`)
      }

      const data = await response.json()
      setBeehives(data)
    } catch (err) {
      console.error("Error fetching beehives:", err)
      setError("Failed to load beehives. Please try again later.")
      toast({
        title: "Error",
        description: "Failed to load beehives. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSensors = async () => {
    try {
      const response = await fetch(`/access/get_info_sensors`,{
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session?.accessToken}`
        },
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch sensors: ${response.status}`)
      }

      const data = await response.json()
      setAllSensors(data)
    } catch (err) {
      console.error("Error fetching sensors:", err)
      toast({
        title: "Error",
        description: "Failed to load sensors. Please try again later.",
        variant: "destructive",
      })
    }
  }

  const handleStartCalibration = (sensor: Sensor) => {
    setCalibrationSensor(sensor)
    setCalibrationStep(1)
    setCalibrationValue("")
    setIsCalibrationDialogOpen(true)
  }

  const handleCalibrationNext = async () => {
    if (calibrationStep === 1) {
      setCalibrationStep(2)
    } else if (calibrationStep === 2) {
      if (!calibrationValue || isNaN(Number.parseFloat(calibrationValue))) {
        toast({
          title: "Invalid value",
          description: "Please enter a valid number for calibration.",
          variant: "destructive",
        })
        return
      }

      if (!calibrationSensor) return

      try {
        const response = await fetch(`/access/calibrated_sensor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.accessToken}`,
            "X-CSRF-TOKEN": session?.csrftoken
          },
          body: JSON.stringify({
            sensorId: calibrationSensor.id,
            value: Number.parseFloat(calibrationValue),
          }),
        })
        if (response.status === 401) {
          signOut();
        }
        if (!response.ok) {
          throw new Error(`Failed to calibrate sensor: ${response.status}`)
        }

        toast({
          title: "Calibration successful",
          description: `Sensor ${calibrationSensor.name} has been calibrated to ${calibrationValue}kg.`,
        })

        setIsCalibrationDialogOpen(false)
        setCalibrationStep(1)
        setCalibrationValue("")
      } catch (err) {
        console.error("Error calibrating sensor:", err)
        toast({
          title: "Error",
          description: "Failed to calibrate sensor. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleAddBeehive = async () => {
    if (!newBeehive.name || !newBeehive.location) return

    try {
      const response = await fetch(`/access/edit_beehives`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({
          name: newBeehive.name,
          location: newBeehive.location,
          action: "add",
        }),
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to add beehive: ${response.status}`)
      }

      await fetchBeehives()
      setNewBeehive({ name: "", location: "" })
      setIsAddDialogOpen(false)

      toast({
        title: "Beehive added",
        description: `${newBeehive.name} has been added successfully.`,
      })
    } catch (err) {
      console.error("Error adding beehive:", err)
      toast({
        title: "Error",
        description: "Failed to add beehive. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditBeehive = async () => {
    if (!editBeehive || !editBeehive.name || !editBeehive.location) return

    try {
      const response = await fetch(`/access/edit_beehives`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({
          id: editBeehive.id,
          name: editBeehive.name,
          location: editBeehive.location,
          action: "edit",
        }),
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to update beehive: ${response.status}`)
      }

      await fetchBeehives()
      setIsEditDialogOpen(false)

      toast({
        title: "Beehive updated",
        description: `${editBeehive.name} has been updated successfully.`,
      })
    } catch (err) {
      console.error("Error updating beehive:", err)
      toast({
        title: "Error",
        description: "Failed to update beehive. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteBeehive = async () => {
    if (!beehiveToDelete) return

    try {
      const response = await fetch(`/access/deleting_beehive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({
          id: beehiveToDelete,
        }),
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to delete beehive: ${response.status}`)
      }

      await fetchBeehives()
      await fetchSensors()
      setIsDeleteDialogOpen(false)

      toast({
        title: "Beehive deleted",
        description: "The beehive has been deleted successfully.",
      })
    } catch (err) {
      console.error("Error deleting beehive:", err)
      toast({
        title: "Error",
        description: "Failed to delete beehive. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleAssignSensor = async () => {
    if (!selectedBeehive || !selectedSensor) return

    const sensor = allSensors.find((s) => s.id === selectedSensor)
    if (!sensor) return

    try {
      const response = await fetch(`/access/assign_sensor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({
          beehiveId: selectedBeehive,
          sensorId: selectedSensor,
          override: overrideAssignment,
        }),
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        // If the sensor is already assigned and override is false
        if (response.status === 409) {
          toast({
            title: "Assignment failed",
            description:
              "This sensor is already assigned to another beehive. Please check the override option to reassign.",
            variant: "destructive",
          })
          return
        }

        throw new Error(`Failed to assign sensor: ${response.status}`)
      }

      await fetchBeehives()
      await fetchSensors()
      setIsAssignSensorDialogOpen(false)
      setSelectedBeehive(null)
      setSelectedSensor(null)
      setOverrideAssignment(false)

      toast({
        title: "Sensor assigned",
        description: "The sensor has been assigned successfully.",
      })
    } catch (err) {
      console.error("Error assigning sensor:", err)
      toast({
        title: "Error",
        description: "Failed to assign sensor. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUnassignSensor = async (beehiveId: string, sensorId: string) => {
    try {
      const response = await fetch(`/access/unassign_sensor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({
          beehiveId,
          sensorId,
        }),
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to unassign sensor: ${response.status}`)
      }

      await fetchBeehives()
      await fetchSensors()

      toast({
        title: "Sensor unassigned",
        description: "The sensor has been unassigned successfully.",
      })
    } catch (err) {
      console.error("Error unassigning sensor:", err)
      toast({
        title: "Error",
        description: "Failed to unassign sensor. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Add function to handle setting last inspection date
  const handleSetInspectionDate = async () => {
    if (!inspectionBeehive || !inspectionDate) return

    try {
      const response = await fetch(`/access/edit_beehives`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({
          id: inspectionBeehive.id,
          lastInspection: format(inspectionDate, "yyyy-MM-dd"),
          action: "update_inspection",
        }),
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to update inspection date: ${response.status}`)
      }

      await fetchBeehives()
      setIsInspectionDialogOpen(false)
      setInspectionBeehive(null)
      setInspectionDate(undefined)

      toast({
        title: "Inspection date updated",
        description: `Last inspection date has been updated to ${format(inspectionDate, "PPP")}.`,
      })
    } catch (err) {
      console.error("Error updating inspection date:", err)
      toast({
        title: "Error",
        description: "Failed to update inspection date. Please try again.",
        variant: "destructive",
      })
    }
  }
  const [date, setDate] = useState<Date | undefined>(new Date())
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Beehive Management</h1>
        <div className="flex space-x-2">
          <Dialog open={isAssignSensorDialogOpen} onOpenChange={setIsAssignSensorDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <LinkIcon className="mr-2 h-4 w-4" />
                Assign Sensor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Sensor to Beehive</DialogTitle>
                <DialogDescription>Select a sensor and a beehive to create an assignment.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="beehive">Beehive</Label>
                  <Select onValueChange={setSelectedBeehive}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a beehive" />
                    </SelectTrigger>
                    <SelectContent>
                      {beehives.map((beehive) => (
                        <SelectItem key={beehive.id} value={beehive.id}>
                          {beehive.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sensor">Sensor</Label>
                  <Select onValueChange={setSelectedSensor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a sensor" />
                    </SelectTrigger>
                    <SelectContent>
                      {allSensors.map((sensor) => (
                        <SelectItem key={sensor.id} value={sensor.id}>
                          {sensor.name} {sensor.hubId && "(Already assigned)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="override"
                    checked={overrideAssignment}
                    onCheckedChange={(checked) => setOverrideAssignment(checked === true)}
                  />
                  <Label htmlFor="override" className="text-sm">
                    Override Existing Data
                  </Label>
                </div>
                {overrideAssignment && (
                  <Alert variant="warning">
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>
                      Overriding an existing assignment will remove all sensor's data and writes them into new assignment.
                      Potentialy leading to Data Loss! If this option is not marked, there will be duplicated entries in the system and unexpected system behaviors!
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAssignSensorDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignSensor}>Assign</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Beehive
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Beehive</DialogTitle>
                <DialogDescription>Create a new beehive to monitor.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Beehive Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter beehive name"
                    value={newBeehive.name}
                    onChange={(e) => setNewBeehive({ ...newBeehive, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Enter beehive location"
                    value={newBeehive.location}
                    onChange={(e) => setNewBeehive({ ...newBeehive, location: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddBeehive}>Add Beehive</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Beehives</CardTitle>
          <CardDescription>Manage your beehives and assign sensors.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : beehives.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No beehives found. Add a beehive to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Sensors</TableHead>
                  <TableHead>Last Inspection</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {beehives.map((beehive) => (
                  <TableRow key={beehive.id}>
                    <TableCell className="font-medium">{beehive.name}</TableCell>
                    <TableCell>{beehive.location}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        {beehive.sensors.length > 0 ? (
                          beehive.sensors.map((sensorId) => {
                            const sensor = allSensors.find((s) => s.id === sensorId)
                            return sensor ? (
                              <div key={sensorId} className="flex items-center justify-between text-sm">
                                <div className="flex items-center">
                                  <span>{sensor.name}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  {sensor.type === "weight" && (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      title="Calibrate Weight Sensor"
                                      onClick={() => handleStartCalibration(sensor)}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="lucide lucide-scale"
                                      >
                                        <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                                        <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                                        <path d="M7 21h10" />
                                        <path d="M12 3v18" />
                                        <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
                                      </svg>
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleUnassignSensor(beehive.id, sensorId)}
                                  >
                                    <LinkOff className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ) : null
                          })
                        ) : (
                          <span className="text-muted-foreground text-sm">No sensors assigned</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span>{beehive.lastInspection || "Never"}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setInspectionBeehive(beehive)
                            setIsInspectionDialogOpen(true)
                          }}
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setEditBeehive(beehive)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedBeehive(beehive.id)
                              setIsAssignSensorDialogOpen(true)
                            }}
                          >
                            <LinkIcon className="mr-2 h-4 w-4" />
                            Assign Sensor
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setInspectionBeehive(beehive)
                              setIsInspectionDialogOpen(true)
                            }}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            Set Inspection Date
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-500"
                            onClick={() => {
                              setBeehiveToDelete(beehive.id)
                              setIsDeleteDialogOpen(true)
                            }}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Beehive Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Beehive</DialogTitle>
            <DialogDescription>Update the beehive details.</DialogDescription>
          </DialogHeader>
          {editBeehive && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Beehive Name</Label>
                <Input
                  id="edit-name"
                  value={editBeehive.name}
                  onChange={(e) => setEditBeehive({ ...editBeehive, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editBeehive.location}
                  onChange={(e) => setEditBeehive({ ...editBeehive, location: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditBeehive}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Beehive Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Beehive</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this beehive? This action cannot be undone. All sensor assignments will be
              removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteBeehive}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add the calibration dialog */}
      <Dialog open={isCalibrationDialogOpen} onOpenChange={setIsCalibrationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{calibrationStep === 1 ? "Initiate Calibration" : "Enter Calibration Value"}</DialogTitle>
            <DialogDescription>
              {calibrationStep === 1
                ? "Prepare the sensor for calibration by placing it on a flat surface with no weight."
                : "Enter the known weight value for calibration."}
            </DialogDescription>
          </DialogHeader>

          {calibrationSensor && (
            <div className="py-4">
              <div className="mb-4">
                <p className="font-medium">Sensor: {calibrationSensor.name}</p>
                <p className="text-sm text-muted-foreground">Type: {calibrationSensor.type}</p>
              </div>

              {calibrationStep === 1 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center p-6 bg-muted rounded-md">
                    <div className="text-center">
                      <p className="mb-2">Ensure the sensor is:</p>
                      <ul className="text-sm text-left space-y-1">
                        <li>• On a flat, stable surface</li>
                        <li>• Free from any weight or pressure</li>
                        <li>• Not being touched or disturbed</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="calibration-value">Known Weight (kg)</Label>
                    <Input
                      id="calibration-value"
                      type="number"
                      step="0.01"
                      placeholder="Enter the known weight"
                      value={calibrationValue}
                      onChange={(e) => setCalibrationValue(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the exact weight of the calibration object in kilograms
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCalibrationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCalibrationNext}>{calibrationStep === 1 ? "Next" : "Confirm Calibration"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Inspection Date Dialog */}
      <Dialog open={isInspectionDialogOpen} onOpenChange={setIsInspectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Inspection Date</DialogTitle>
            <DialogDescription>Update the last inspection date for this beehive.</DialogDescription>
          </DialogHeader>
          
          {inspectionBeehive && (
            <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Beehive</Label>
              <div className="p-2 bg-muted rounded-md">{inspectionBeehive.name}</div>
            </div>

            <div className="space-y-2">
              <Label>Inspection Date</Label>
              <div className="border rounded-md p-3">
                <CalendarComponent
                  mode="single"
                  selected={inspectionDate}
                  onSelect={setInspectionDate}
                  className="mx-auto"
                />
              </div>
            </div>
          </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInspectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetInspectionDate} disabled={!inspectionDate}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

