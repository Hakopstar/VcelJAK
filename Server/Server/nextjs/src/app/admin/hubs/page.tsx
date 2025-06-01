"use client"

import { useState, useEffect, useRef, useCallback } from "react" // Added useCallback
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



// Define hub type (using uuid as identifier based on updated code)
type Hub = {
  uuid: string          // Primary identifier used in UI and API calls
  name: string
  connectedSensors: number
  lastUpdate: string    // Expecting a human-readable string like "5 minutes ago"
}

// Define expected API response types (optional but good practice)
type HubApiResponse = Hub[];
type NewHubApiResponse = {
    hub: Hub;
    key: string;
}
type ChangeKeyApiResponse = {
    key: string;
}
type SuccessMsgResponse = {
    msg: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';


export default function HubsPage() {
  const [hubs, setHubs] = useState<Hub[]>([])
  const [newHub, setNewHub] = useState({ name: "" })
  const [editHub, setEditHub] = useState<Hub | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [hubToDelete, setHubToDelete] = useState<string | null>(null) // Stores the UUID to delete

  // State for secret key dialog
  const [isSecretKeyDialogOpen, setIsSecretKeyDialogOpen] = useState(false)
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null) // Stores the full Hub object for context
  const [newSecretKey, setNewSecretKey] = useState("")
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)

  // State for loading and error handling
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State for the dialog shown after successfully adding a hub
  const [isNewHubKeyDialogOpen, setIsNewHubKeyDialogOpen] = useState(false)
  const [newHubKey, setNewHubKey] = useState("") // The temporary key to display
  const [newHubData, setNewHubData] = useState<Hub | null>(null) // Data of the newly added hub

  // State for copy button visual feedback
  const [copiedUUID, setCopiedUUID] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  // Refs for the token elements (optional, but can be useful for focus or complex interactions)
  const newKeyRef = useRef<HTMLDivElement>(null)
  const newHubKeyRef = useRef<HTMLDivElement>(null)

  const { data: session, status } = useSession();

  // --- Data Fetching ---
  // Use useCallback to memoize fetchHubs function
  const fetchHubs = useCallback(async () => {
    // Prevent fetching if not authenticated
    if (status !== "authenticated" || !session?.accessToken) {
      setIsLoading(false); // Stop loading if we can't fetch
      return;
    }
    setIsLoading(true)
    setError(null)

    try {
      // Use the correct endpoint for fetching hubs list
      const response = await fetch(`${API_BASE_URL}/access/hub_management/get_hub_info`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.accessToken}` // Use the session token
        },
      })
      if (response.status === 401) {
        signOut(); // Sign out on unauthorized
        // No need to throw error here, signOut will redirect
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch hubs: ${response.statusText} (${response.status})`)
      }

      const data: HubApiResponse = await response.json()
      setHubs(data)
    } catch (err) {
      console.error("Error fetching hubs:", err)
      const errorMsg = err instanceof Error ? err.message : "Failed to load hubs. Please try again later."
      setError(errorMsg)
      toast({
        title: "Error Loading Hubs",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [session, status]); // Add dependencies

  // Fetch hubs on component mount or when session status changes
  useEffect(() => {
      fetchHubs();
  }, [fetchHubs]) // Use memoized fetchHubs

  // --- Dialog State Resets ---
  useEffect(() => {
    if (!isSecretKeyDialogOpen) {
      setCopiedKey(false)
      setNewSecretKey("") // Clear generated key when dialog closes
    }
  }, [isSecretKeyDialogOpen])

  useEffect(() => {
    if (!isNewHubKeyDialogOpen) {
      setCopiedUUID(false)
      setCopiedKey(false)
      setNewHubKey("")    // Clear displayed key/data when dialog closes
      setNewHubData(null)
    }
  }, [isNewHubKeyDialogOpen])

  // --- Helper Functions ---
  const copyToClipboard = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description: `${type} has been copied to your clipboard.`,
        });
        // Set temporary visual feedback state if needed
        if (type === "UUID") {
          setCopiedUUID(true);
          setTimeout(() => setCopiedUUID(false), 1500);
        } else if (type === "Secret key") {
          setCopiedKey(true);
          setTimeout(() => setCopiedKey(false), 1500);
        }
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        toast({ title: "Error", description: "Failed to copy to clipboard.", variant: "destructive" });
      });
  };

  // --- API Interaction Functions ---

  const handleAddHub = async () => {
    if (!newHub.name || status !== "authenticated") return

    setIsLoading(true); // Indicate activity
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/access/hub_management/new_hub`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken // Include if using CSRF
        },
        body: JSON.stringify({ name: newHub.name }),
      })
      if (response.status === 401) {
        signOut(); return;
      }
      if (!response.ok) {
         const errorData = await response.json().catch(() => ({})); // Try to get error details
         throw new Error(errorData.description || `Failed to create hub: ${response.statusText} (${response.status})`);
      }

      const data: NewHubApiResponse = await response.json()

      setIsAddDialogOpen(false)   // Close the add dialog
      setNewHubData(data.hub)     // Store new hub data for the next dialog
      setNewHubKey(data.key)      // Store the temporary key
      setIsNewHubKeyDialogOpen(true) // Open the key display dialog
      fetchHubs()                 // Refresh the hub list in the background
      setNewHub({ name: "" })     // Reset the add form
    } catch (err) {
      console.error("Error creating hub:", err)
      const errorMsg = err instanceof Error ? err.message : "Failed to create hub. Please try again."
      setError(errorMsg)
      toast({ title: "Error Creating Hub", description: errorMsg, variant: "destructive" })
    } finally {
        setIsLoading(false);
    }
  }

  // Called when user clicks "I've Copied the Key" in the New Hub Key Dialog
  const handleConfirmNewHubKeyCopied = () => {
    toast({
      title: "Hub Created",
      description: `${newHubData?.name} has been added successfully. Remember to configure the hardware with the new key.`,
    })
    // Close the dialog (state reset is handled by useEffect)
    setIsNewHubKeyDialogOpen(false);
  }

  const handleEditHub = async () => {
    // Ensure editHub is set and we have a valid session
    if (!editHub || !editHub.name || status !== "authenticated") return

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/access/hub_management/rename_hub`, {
        method: "POST", // Backend uses POST for rename
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({
          uuid: editHub.uuid, // Send the correct identifier
          name: editHub.name,
        }),
      })
      if (response.status === 401) {
        signOut(); return;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.description || `Failed to rename hub: ${response.statusText} (${response.status})`);
      }

      // No need to parse response body if just a success message
      // const data: SuccessMsgResponse = await response.json();

      await fetchHubs() // Refresh the hub list to show the change
      setIsEditDialogOpen(false) // Close the edit dialog
      setEditHub(null); // Reset edit state

      toast({
        title: "Hub Updated",
        description: `Hub has been renamed to "${editHub.name}" successfully.`,
      })
    } catch (err) {
      console.error("Error renaming hub:", err)
      const errorMsg = err instanceof Error ? err.message : "Failed to rename hub. Please try again."
      setError(errorMsg)
      toast({ title: "Error Renaming Hub", description: errorMsg, variant: "destructive" })
    } finally {
      setIsLoading(false);
    }
  }

  const handleDeleteHub = async () => {
    // Check if hubToDelete state is set and we have a session
    if (!hubToDelete || status !== "authenticated") {
        console.error("handleDeleteHub called but hubToDelete state is not set or not authenticated.");
        toast({ title: "Error", description:"No hub selected for deletion or not authenticated.", variant: "destructive"});
        return;
    }

    // Copy the state value to a local variable *before* potential state resets
    const uuidToDelete = hubToDelete;

    // setIsLoading(true); // Consider if loading state is needed here
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/access/hub_management/delete_hub`, {
         method: 'POST', // Backend uses POST
         headers: {
           'Content-Type': 'application/json',
           "Authorization": `Bearer ${session?.accessToken}`,
           "X-CSRF-TOKEN": session?.csrftoken
         },
         body: JSON.stringify({ uuid: uuidToDelete }), // Send the uuid from the copied state
      })

      if (response.status === 401) {
        signOut(); return;
      }

      // Check if the API call was successful (status code 2xx)
      if (!response.ok) {
        let errorMsg = `Failed to delete hub: ${response.statusText} (${response.status})`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.description || errorData.msg || errorMsg;
        } catch (jsonError) { /* Ignore if response body is not JSON */ }
        throw new Error(errorMsg);
      }

      // const data: SuccessMsgResponse = await response.json(); // Parse response if needed

      // --- Update local state ONLY AFTER successful API call ---
      setHubs((prevHubs) => prevHubs.filter((hub) => hub.uuid !== uuidToDelete));

      toast({
        title: "Hub Deleted",
        description: "The hub has been deleted successfully.",
      })

      // --- Close dialog and reset state ONLY AFTER successful deletion ---
      setIsDeleteDialogOpen(false);
      setHubToDelete(null);

    } catch (err) {
      console.error("Error deleting hub:", err);
      const errorMsg = err instanceof Error ? err.message : "An unknown error occurred during deletion";
      setError(errorMsg);
      toast({ title: "Error Deleting Hub", description: errorMsg, variant: "destructive" });
      // Keep dialog open on error to allow retry or cancellation
    } finally {
      // setIsLoading(false); // Stop loading indicator if you used one
    }
  }


  const handleGenerateNewKey = async () => {
    if (!selectedHub || status !== "authenticated") return

    setIsGeneratingKey(true)
    setError(null)
    setNewSecretKey(""); // Clear previous key attempt

    try {
      const response = await fetch(`${API_BASE_URL}/access/hub_management/change_api_key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({ uuid: selectedHub.uuid }), 
      })
      if (response.status === 401) {
        signOut(); return;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.description || `Failed to generate new key: ${response.statusText} (${response.status})`);
      }

      const data: ChangeKeyApiResponse = await response.json()
      setNewSecretKey(data.key) // Display the newly generated key
    } catch (err) {
      console.error("Error generating new key:", err)
      const errorMsg = err instanceof Error ? err.message : "Failed to generate new key. Please try again."
      setError(errorMsg)
      toast({ title: "Error Generating Key", description: errorMsg, variant: "destructive" })
    } finally {
      setIsGeneratingKey(false)
    }
  }

  // Called when user clicks "Save New Key" in the Manage Secret Key dialog
  const handleConfirmNewKeySaved = () => {
    // Key is already saved on backend by handleGenerateNewKey
    toast({
      title: "Secret Key Updated",
      description: "The new secret key has been generated and saved successfully. Update your hardware.",
    })
    // Close the dialog (state reset is handled by useEffect)
    setIsSecretKeyDialogOpen(false)
  }

  // Helper to open the Manage Secret Key dialog
  const openSecretKeyDialog = (hub: Hub) => {
    setSelectedHub(hub)
    setNewSecretKey("") // Ensure previous generated key is cleared
    setError(null) // Clear previous errors specific to this dialog
    setIsSecretKeyDialogOpen(true)
  }

  // --- JSX Rendering ---
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header and Add Button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Hub Management</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Hub
            </Button>
          </DialogTrigger>
          {/* Add Hub Dialog Content */}
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
                  placeholder="e.g., Apiary Section A Hub"
                  value={newHub.name}
                  onChange={(e) => setNewHub({ ...newHub, name: e.target.value })}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              {/* Disable button while loading or if name is empty */}
              <Button onClick={handleAddHub} disabled={isLoading || !newHub.name}>
                {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add Hub
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Global Error Alert */}
      {error && !isSecretKeyDialogOpen && !isNewHubKeyDialogOpen && ( // Avoid showing global error if dialog has specific error space
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Hubs Table Card */}
      <Card className="bg-card/50 backdrop-blur-sm border shadow-sm">
        <CardHeader>
          <CardTitle>Hardware Hubs</CardTitle>
          <CardDescription>Manage your hardware hubs, generate UUIDs and secret keys.</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" || isLoading ? (
            <div className="flex justify-center items-center py-10">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !error && hubs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No hubs found. Add a hub to get started.</div>
          ) : error && hubs.length === 0 ? (
             <div className="text-center py-10 text-destructive">{error}</div> // Show error if fetch failed and list is empty
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>UUID</TableHead>
                  <TableHead className="hidden sm:table-cell">Sensors</TableHead>
                  <TableHead className="hidden md:table-cell">Last Update</TableHead>
                  <TableHead className="text-right w-[50px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hubs.map((hub) => (
                  <TableRow key={hub.uuid}>
                    <TableCell className="font-medium py-3">{hub.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        {/* Truncate UUID nicely */}
                        <span className="font-mono text-xs block sm:hidden truncate max-w-[80px]">{hub.uuid}</span>
                        <span className="font-mono text-xs hidden sm:block truncate max-w-[180px]">{hub.uuid}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(hub.uuid, "UUID")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{hub.connectedSensors}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{hub.lastUpdate}</TableCell>
                    <TableCell className="text-right py-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              // Set the hub data for editing
                              setEditHub(hub);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSecretKeyDialog(hub)}>
                            <Key className="mr-2 h-4 w-4" />
                            Manage Secret Key
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-700 focus:bg-red-50"
                            onClick={() => {
                              // --- Set the UUID state before opening the dialog ---
                              console.log("Setting hubToDelete state to:", hub.uuid); // For debugging
                              setHubToDelete(hub.uuid);
                              setIsDeleteDialogOpen(true);
                              // ----------------------------------------------------
                            }}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete Hub
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

      {/* --- Dialogs --- */}

      {/* Edit Hub Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Hub</DialogTitle>
            <DialogDescription>Update the name for this hub.</DialogDescription>
          </DialogHeader>
          {editHub && ( // Conditionally render content only if editHub is set
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">New Hub Name</Label>
                <Input
                  id="edit-name"
                  value={editHub.name}
                  onChange={(e) => setEditHub({ ...editHub, name: e.target.value })} // Update name in editHub state
                  autoFocus
                />
              </div>
               <p className="text-xs text-muted-foreground">UUID: {editHub.uuid}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            {/* Disable button while loading or if name is empty/unchanged */}
            <Button onClick={handleEditHub} disabled={isLoading || !editHub?.name }>
                 {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                 Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Hub Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the hub
              (<span className="font-mono text-sm">{hubToDelete}</span>) and its associated data. Sensors connected to this hub may stop reporting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteHub} disabled={isLoading}>
              {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, Delete Hub
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Secret Key Dialog */}
      <Dialog open={isSecretKeyDialogOpen} onOpenChange={setIsSecretKeyDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Manage Secret Key</DialogTitle>
            {selectedHub && <DialogDescription>Hub: {selectedHub.name} ({selectedHub.uuid})</DialogDescription>}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Encrypted Secret Key</AlertTitle>
              <AlertDescription>
                For security, the current secret key is encrypted and cannot be viewed. You can only generate a new one. Generating a new key will invalidate the old one immediately.
              </AlertDescription>
            </Alert>

            {/* Display newly generated key or the button to generate */}
            {newSecretKey ? (
              <div className="space-y-2">
                <Label>New Secret Key (Copy Now!)</Label>
                <div className="flex items-center space-x-2">
                  <div
                    ref={newKeyRef} // Ref for potential future use
                    className="p-2 bg-muted rounded-md flex-grow font-mono text-xs overflow-x-auto break-all max-h-24 border"
                  >
                    {newSecretKey}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(newSecretKey, "Secret key")}
                    className="flex-shrink-0 h-9 w-9"
                  >
                   {copiedKey ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                 {error && isSecretKeyDialogOpen && ( // Show specific error here
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Generation Failed</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                <Button onClick={handleGenerateNewKey} disabled={isGeneratingKey} className="w-full">
                  {isGeneratingKey ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Key className="mr-2 h-4 w-4" /> Generate New Secret Key</>
                  )}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setIsSecretKeyDialogOpen(false)}
            >
              Cancel
            </Button>
            {/* Show save button only after key generation */}
            {newSecretKey && (
              <Button variant="default" onClick={handleConfirmNewKeySaved}>
                I Have Copied the New Key
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Hub Key Display Dialog */}
      <Dialog open={isNewHubKeyDialogOpen} onOpenChange={setIsNewHubKeyDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Hub Created Successfully!</DialogTitle>
            <DialogDescription>Copy the generated UUID and Secret Key below.</DialogDescription>
          </DialogHeader>
          {newHubData && ( // Only render if data is available
            <div className="space-y-4 py-4">
              <Alert variant="warning">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Important: Copy Secret Key Now!</AlertTitle>
                <AlertDescription>
                  This is the **only** time you will see the hub's secret key. Store it securely.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Hub Name</Label>
                <div className="p-2 bg-muted rounded-md border">{newHubData.name}</div>
              </div>

              <div className="space-y-2">
                <Label>Hub UUID</Label>
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-muted rounded-md flex-grow font-mono text-xs overflow-x-auto break-all border">
                    {newHubData.uuid}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(newHubData.uuid, "UUID")}
                    className="flex-shrink-0 h-9 w-9"
                  >
                    {copiedUUID ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Secret Key</Label>
                <div className="flex items-center space-x-2">
                  <div
                    ref={newHubKeyRef}
                    className="p-2 bg-muted rounded-md flex-grow font-mono text-xs overflow-x-auto break-all max-h-24 border"
                  >
                    {newHubKey}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(newHubKey, "Secret key")}
                    className="flex-shrink-0 h-9 w-9"
                  >
                    {copiedKey ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleConfirmNewHubKeyCopied} className="w-full sm:w-auto">I've Copied the Key & UUID</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}