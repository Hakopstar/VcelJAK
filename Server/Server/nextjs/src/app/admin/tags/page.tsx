"use client"

import { useState, useEffect } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Plus, MoreHorizontal, Trash, Edit, RefreshCw } from "lucide-react"
import { toast } from "~/hooks/use-toast"
import { Badge } from "~/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Skeleton } from "~/components/ui/skeleton"
import { useSession } from "next-auth/react";

// Define the Tag type
type Tag = {
  id: string
  name: string
  type: string
  description: string
}

// Define API response types
type ListTagsResponse = Tag[]

type CreateTagResponse = Tag

type UpdateTagResponse = Tag

type DeleteTagResponse = {
  success: boolean
  id: string
}

// Helper functions
const getTagTypeDescription = (type: string) => {
  switch (type) {
    case "purpose":
      return "Purpose tags define the primary function of a hive and set baseline monitoring parameters."
    case "mode":
      return "Mode tags can change monitoring thresholds globally."
    case "status":
      return "Status tags indicate the current condition of a hive."
    default:
      return ""
  }
}

const getTagBadgeVariant = (type: string) => {
  switch (type) {
    case "purpose":
      return "secondary"
    case "mode":
      return "default"
    case "status":
      return "destructive"
    default:
      return "default"
  }
}

// API endpoints
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';


export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [newTag, setNewTag] = useState<Partial<Tag>>({
    name: "",
    type: "",
    description: "",
  })
  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { data: session, status } = useSession();
  // Fetch tags on component mount
  useEffect(() => {
    if (status === "authenticated") {
      fetchTags();
    }
  }, [status, session]);

  // Function to fetch tags
  const fetchTags = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Request body for listing tags
      const requestBody = {
        filter: {
          type: activeTab !== "all" ? activeTab : undefined,
        },
      }

      // Using POST to pass filter data in the body
      const response = await fetch(`${API_BASE_URL}/access/tags/list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.statusText}`)
      }

      // Expected response: Array of Tag objects
      const data: ListTagsResponse = await response.json()
      setTags(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to fetch tags",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Function to refresh tags
  const refreshTags = () => {
    setIsRefreshing(true)
    fetchTags()
  }

  // Function to add a tag
  const handleAddTag = async () => {
    if (!newTag.name || !newTag.type) {
      toast({
        title: "Missing information",
        description: "Please provide a name and type for the tag.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)

      // Generate ID from name
      const id = newTag.name.toLowerCase().replace(/\s+/g, "-")

      // Request body for creating a tag
      const newTagData = {
        id,
        name: newTag.name,
        type: newTag.type,
        description: newTag.description || "",
      }

      const response = await fetch(`${API_BASE_URL}/access/tags/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify(newTagData),
      })

      if (!response.ok) {
        throw new Error(`Failed to add tag: ${response.statusText}`)
      }

      // Expected response: The created Tag object
      const addedTag: CreateTagResponse = await response.json()
      setTags([...tags, addedTag])

      setNewTag({ name: "", type: "", description: "" })
      setIsAddDialogOpen(false)

      toast({
        title: "Tag added",
        description: `${newTag.name} has been added successfully.`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add tag",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Function to edit a tag
  const handleEditTag = async () => {
    if (!editTag || !editTag.name || !editTag.type) return

    try {
      setIsLoading(true)

      // Request body for updating a tag
      const updateData = {
        id: editTag.id,
        name: editTag.name,
        type: editTag.type,
        description: editTag.description,
      }

      const response = await fetch(`${API_BASE_URL}/access/tags/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        throw new Error(`Failed to update tag: ${response.statusText}`)
      }

      // Expected response: The updated Tag object
      const updatedTag: UpdateTagResponse = await response.json()
      setTags(tags.map((tag) => (tag.id === updatedTag.id ? updatedTag : tag)))

      setIsEditDialogOpen(false)

      toast({
        title: "Tag updated",
        description: `${editTag.name} has been updated successfully.`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update tag",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Function to delete a tag
  const handleDeleteTag = async () => {
    if (!tagToDelete) return

    try {
      setIsLoading(true)

      // Request body for deleting a tag
      const deleteData = {
        id: tagToDelete,
      }

      // Pass the tag ID in the request body
      const response = await fetch(`${API_BASE_URL}/access/tags/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify(deleteData),
      })

      if (!response.ok) {
        throw new Error(`Failed to delete tag: ${response.statusText}`)
      }

      // Expected response: Success confirmation with the deleted tag ID
      const result: DeleteTagResponse = await response.json()

      if (result.success) {
        setTags(tags.filter((tag) => tag.id !== result.id))

        setIsDeleteDialogOpen(false)
        setTagToDelete(null)

        toast({
          title: "Tag deleted",
          description: "The tag has been deleted successfully.",
        })
      } else {
        throw new Error("Failed to delete tag: Operation unsuccessful")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete tag",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsDeleteDialogOpen(false)
      setTagToDelete(null)
    }
  }

  // Effect to refetch tags when tab changes
  useEffect(() => {
    if (tags.length > 0) {
      fetchTags()
    }
  }, [activeTab])

  // Render loading skeleton
  const renderSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-12 w-1/4" />
          <Skeleton className="h-12 w-1/6" />
          <Skeleton className="h-12 w-2/4" />
          <Skeleton className="h-12 w-12" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tag Management</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={refreshTags} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Tag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Tag</DialogTitle>
                <DialogDescription>Create a new tag for grouping and categorization.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tag Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter tag name"
                    value={newTag.name}
                    onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tag Type</Label>
                  <Select onValueChange={(value) => setNewTag({ ...newTag, type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tag type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purpose">Purpose</SelectItem>
                      <SelectItem value="mode">Mode</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                  {newTag.type && (
                    <p className="text-xs text-muted-foreground mt-1">{getTagTypeDescription(newTag.type)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Enter tag description"
                    value={newTag.description}
                    onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTag} disabled={isLoading}>
                  {isLoading ? "Adding..." : "Add Tag"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Tags</TabsTrigger>
          <TabsTrigger value="purpose">Purpose</TabsTrigger>
          <TabsTrigger value="mode">Mode</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            {activeTab === "all"
              ? "Manage tags for groups and hives."
              : `Manage ${activeTab} tags - ${getTagTypeDescription(activeTab)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="bg-red-50 p-4 rounded-md text-red-800 mb-4">
              <p className="font-medium">Error loading tags</p>
              <p>{error}</p>
              <Button variant="outline" className="mt-2" onClick={fetchTags}>
                Try Again
              </Button>
            </div>
          ) : isLoading && tags.length === 0 ? (
            renderSkeleton()
          ) : tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No tags found. Add a tag to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && tags.length === 0
                  ? renderSkeleton()
                  : tags
                      .filter((tag) => activeTab === "all" || tag.type === activeTab)
                      .map((tag) => (
                        <TableRow key={tag.id}>
                          <TableCell className="font-medium">{tag.name}</TableCell>
                          <TableCell>
                            <Badge variant={getTagBadgeVariant(tag.type as string)}>
                              {tag.type.charAt(0).toUpperCase() + tag.type.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>{tag.description}</TableCell>
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
                                    setEditTag(tag)
                                    setIsEditDialogOpen(true)
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-500"
                                  onClick={() => {
                                    setTagToDelete(tag.id)
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

      {/* Edit Tag Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>Update the tag details.</DialogDescription>
          </DialogHeader>
          {editTag && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Tag Name</Label>
                <Input
                  id="edit-name"
                  value={editTag.name}
                  onChange={(e) => setEditTag({ ...editTag, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">Tag Type</Label>
                <Select value={editTag.type} onValueChange={(value) => setEditTag({ ...editTag, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tag type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purpose">Purpose</SelectItem>
                    <SelectItem value="mode">Mode</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{getTagTypeDescription(editTag.type)}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editTag.description}
                  onChange={(e) => setEditTag({ ...editTag, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTag} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tag Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this tag? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTag} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
