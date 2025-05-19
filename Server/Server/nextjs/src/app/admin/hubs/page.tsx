"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
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
import { Plus, MoreHorizontal, Copy, RefreshCw, Trash, Edit, Key, ShieldAlert, AlertCircle, Check } from "lucide-react"
import { toast } from "~/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { useSession, signOut } from "next-auth/react";

// Define hub type
type Hub = {
  uuid: string
  name: string
  connectedSensors: number
  lastUpdate: string
}

export default function HubsPage() {
  const [hubs, setHubs] = useState<Hub[]>([])
  const [newHub, setNewHub] = useState({ name: "" })
  const [editHub, setEditHub] = useState<Hub | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [hubToDelete, setHubToDelete] = useState<string | null>(null)

  // Add state for secret key dialog
  const [isSecretKeyDialogOpen, setIsSecretKeyDialogOpen] = useState(false)
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null)
  const [newSecretKey, setNewSecretKey] = useState("")
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)

  // Add state for loading and error handling
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add these new state variables after the other state declarations
  const [isNewHubKeyDialogOpen, setIsNewHubKeyDialogOpen] = useState(false)
  const [newHubKey, setNewHubKey] = useState("")
  const [newHubData, setNewHubData] = useState<Hub | null>(null)

  // Add state for copy button feedback
  const [copiedUUID, setCopiedUUID] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  // Refs for the token elements
  const newKeyRef = useRef<HTMLDivElement>(null)
  const newHubKeyRef = useRef<HTMLDivElement>(null)

  const { data: session, status } = useSession();
  // Fetch hubs on component mount
  useEffect(() => {
    if (status === "authenticated") {
      fetchHubs();
    } 
  }, [status, session])

  // Reset copy states when dialogs close
  useEffect(() => {
    if (!isSecretKeyDialogOpen) {
      setCopiedKey(false)
    }
  }, [isSecretKeyDialogOpen])

  useEffect(() => {
    if (!isNewHubKeyDialogOpen) {
      setCopiedUUID(false)
      setCopiedKey(false)
    }
  }, [isNewHubKeyDialogOpen])

  const fetchHubs = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/access/get_hub_info`,{
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session?.accessToken}`
        },
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch hubs: ${response.status}`)
      }

      const data = await response.json()
      setHubs(data)
    } catch (err) {
      console.error("Error fetching hubs:", err)
      setError("Failed to load hubs. Please try again later.")
      toast({
        title: "Error",
        description: "Failed to load hubs. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied to clipboard",
      description: `${type} has been copied to your clipboard.`,
    })
  }

  // Updated copy functions with visual feedback
  const copyUUID = (uuid: string) => {
    navigator.clipboard.writeText(uuid)
    setCopiedUUID(true)
    toast({
      title: "Copied to clipboard",
      description: "UUID has been copied to your clipboard.",
    })
    setTimeout(() => setCopiedUUID(false), 2000)
  }

  const copySecretKey = (key: string, isNewHub = false) => {
    navigator.clipboard.writeText(key)
    if (isNewHub) {
      setCopiedKey(true)
      toast({
        title: "Copied to clipboard",
        description: "Secret key has been copied to your clipboard.",
      })
      setTimeout(() => setCopiedKey(false), 2000)
    } else {
      toast({
        title: "Copied to clipboard",
        description: "New secret key has been copied to your clipboard.",
      })
    }
  }

  // Replace the handleAddHub function with this updated version
  const handleAddHub = async () => {
    if (!newHub.name) return

    try {
      const response = await fetch(`/access/new_hub`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({ name: newHub.name }),
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to create hub: ${response.status}`)
      }

      // Get the response data which should include the hub info and key
      const data = await response.json()

      // Close the first dialog
      setIsAddDialogOpen(false)

      // Store the new hub data and key
      setNewHubData(data.hub)
      setNewHubKey(data.key)

      // Open the key dialog
      setIsNewHubKeyDialogOpen(true)

      // Refresh the hub list in the background
      fetchHubs()

      // Reset the form
      setNewHub({ name: "" })
    } catch (err) {
      console.error("Error creating hub:", err)
      toast({
        title: "Error",
        description: "Failed to create hub. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Add this new function to handle saving the new hub key
  const handleSaveNewHubKey = () => {
    toast({
      title: "Hub created",
      description: `${newHubData?.name} has been added successfully.`,
    })

    setNewHubKey("")
    setNewHubData(null)
    setIsNewHubKeyDialogOpen(false)
  }

  const handleEditHub = async () => {
    if (!editHub || !editHub.name) return

    try {
      const response = await fetch(`/access/rename_hub`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({
          uuid: editHub.uuid,
          name: editHub.name,
        }),
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to rename hub: ${response.status}`)
      }

      // Refresh the hub list
      await fetchHubs()
      setIsEditDialogOpen(false)

      toast({
        title: "Hub updated",
        description: `Hub has been renamed successfully.`,
      })
    } catch (err) {
      console.error("Error renaming hub:", err)
      toast({
        title: "Error",
        description: "Failed to rename hub. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteHub = async () => {
    if (!hubToDelete) return

    try {
     
      const response = await fetch(`/access/delete_hub`, {
         method: 'POST',
         headers: {
         'Content-Type': 'application/json',
         "Authorization": `Bearer ${session?.accessToken}`,
         "X-CSRF-TOKEN": session?.csrftoken
         },
         body: JSON.stringify({ uuid: hubToDelete }),
      })
      if (response.status === 401) {
        signOut();
      }

      setHubs(hubs.filter((hub) => hub.uuid !== hubToDelete))
      setIsDeleteDialogOpen(false)

      toast({
        title: "Hub deleted",
        description: "The hub has been deleted successfully.",
      })
    } catch (err) {
      console.error("Error deleting hub:", err)
      toast({
        title: "Error",
        description: "Failed to delete hub. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleGenerateNewKey = async () => {
    if (!selectedHub) return

    setIsGeneratingKey(true)
    setError(null)

    try {
      const response = await fetch(`/access/change_api_key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({ uuid: selectedHub.uuid }),
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to generate new key: ${response.status}`)
      }

      const data = await response.json()
      setNewSecretKey(data.key)
    } catch (err) {
      console.error("Error generating new key:", err)
      setError("Failed to generate new key. Please try again.")
      toast({
        title: "Error",
        description: "Failed to generate new key. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingKey(false)
    }
  }

  const handleSaveNewKey = () => {

    toast({
      title: "Secret key updated",
      description: "The new secret key has been saved successfully.",
    })

    setNewSecretKey("")
    setIsSecretKeyDialogOpen(false)
  }

  const openSecretKeyDialog = (hub: Hub) => {
    setSelectedHub(hub)
    setNewSecretKey("")
    setIsSecretKeyDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Hub Management</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Hub
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Hub</DialogTitle>
              <DialogDescription>Create a new hardware hub to connect sensors.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Hub Name</Label>
                <Input
                  id="name"
                  placeholder="Enter hub name"
                  value={newHub.name}
                  onChange={(e) => setNewHub({ ...newHub, name: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddHub}>Add Hub</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
          <CardTitle>Hardware Hubs</CardTitle>
          <CardDescription>Manage your hardware hubs, generate UUIDs and secret keys.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : hubs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hubs found. Add a hub to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>UUID</TableHead>
                  <TableHead>Connected Sensors</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hubs.map((hub) => (
                  <TableRow key={hub.uuid}>
                    <TableCell className="font-medium">{hub.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs truncate max-w-[120px]">{hub.uuid}</span>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(hub.uuid, "UUID")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{hub.connectedSensors}</TableCell>
                    <TableCell>{hub.lastUpdate}</TableCell>
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
                              setEditHub(hub)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSecretKeyDialog(hub)}>
                            <Key className="mr-2 h-4 w-4" />
                            Manage Secret Key
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-500"
                            onClick={() => {
                              setHubToDelete(hub.uuid)
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

      {/* Edit Hub Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hub</DialogTitle>
            <DialogDescription>Update the hub details.</DialogDescription>
          </DialogHeader>
          {editHub && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Hub Name</Label>
                <Input
                  id="edit-name"
                  value={editHub.name}
                  onChange={(e) => setEditHub({ ...editHub, name: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditHub}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Hub Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Hub</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this hub? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteHub}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret Key Dialog */}
      <Dialog open={isSecretKeyDialogOpen} onOpenChange={setIsSecretKeyDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Secret Key</DialogTitle>
            <DialogDescription>Generate a new secret key for this hub.</DialogDescription>
          </DialogHeader>
          {selectedHub && (
            <div className="space-y-4 py-4">
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Encrypted Secret Key</AlertTitle>
                <AlertDescription>
                  For security reasons, the current secret key is encrypted and cannot be viewed. You can only generate
                  a new key.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Hub Name</Label>
                <div className="p-2 bg-muted rounded-md">{selectedHub.name}</div>
              </div>

              {newSecretKey ? (
                <div className="space-y-2">
                  <Label>New Secret Key</Label>
                  <div className="flex items-start space-x-2">
                    <div
                      ref={newKeyRef}
                      className="p-2 bg-muted rounded-md flex-grow font-mono text-xs overflow-x-auto break-all max-h-32 overflow-y-auto"
                    >
                      {newSecretKey}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copySecretKey(newSecretKey)}
                      className="flex-shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Copy this key now. You won't be able to see it again after saving.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button onClick={handleGenerateNewKey} disabled={isGeneratingKey} className="w-full">
                    {isGeneratingKey ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Key className="mr-2 h-4 w-4" />
                        Generate New Secret Key
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Generating a new key will invalidate the current key. Any devices using the old key will need to be
                    updated.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setNewSecretKey("")
                setIsSecretKeyDialogOpen(false)
              }}
            >
              Cancel
            </Button>
            {newSecretKey && (
              <Button variant="default" onClick={handleSaveNewKey} className="sm:ml-auto">
                Save New Key
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Hub Key Dialog */}
      <Dialog open={isNewHubKeyDialogOpen} onOpenChange={setIsNewHubKeyDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Hub Created Successfully</DialogTitle>
            <DialogDescription>Your new hub has been created. Here is the secret key for this hub.</DialogDescription>
          </DialogHeader>
          {newHubData && (
            <div className="space-y-4 py-4">
              <Alert variant="warning">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Important Security Information</AlertTitle>
                <AlertDescription>
                  This is the only time you'll see this secret key. Please copy it now.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Hub Name</Label>
                <div className="p-2 bg-muted rounded-md">{newHubData.name}</div>
              </div>

              <div className="space-y-2">
                <Label>UUID</Label>
                <div className="flex items-start space-x-2">
                  <div className="p-2 bg-muted rounded-md flex-grow font-mono text-xs overflow-x-auto break-all">
                    {newHubData.uuid}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyUUID(newHubData.uuid)}
                    className="flex-shrink-0"
                  >
                    {copiedUUID ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Secret Key</Label>
                <div className="flex items-start space-x-2">
                  <div
                    ref={newHubKeyRef}
                    className="p-2 bg-muted rounded-md flex-grow font-mono text-xs overflow-x-auto break-all max-h-32 overflow-y-auto"
                  >
                    {newHubKey}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copySecretKey(newHubKey, true)}
                    className="flex-shrink-0"
                  >
                    {copiedKey ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy this key now. You won't be able to see it again after closing this dialog.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleSaveNewHubKey}>I've Copied the Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

