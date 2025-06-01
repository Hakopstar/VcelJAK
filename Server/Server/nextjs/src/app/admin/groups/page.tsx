"use client"

import React from "react"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
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
import { Plus, MoreHorizontal, Trash, Edit, LinkIcon, ChevronRight, AlertTriangle, Star, RefreshCw } from "lucide-react"
import { useToast } from "~/hooks/use-toast"
import { format } from "date-fns"
import { Calendar as CalendarComponent } from "~/components/ui/calendar"
import { Badge } from "~/components/ui/badge"
import { Progress } from "~/components/ui/progress"
import { Checkbox } from "~/components/ui/checkbox"
import { useRouter } from "next/navigation"
import { ScrollArea } from "~/components/ui/scroll-area"
import type { Group, Sensor, Rule, RuleSet, Tag } from "../types"
import {
  fetchGroups,
  fetchSensors,
  fetchRules,
  fetchRuleSets,
  fetchTags,
  createGroup,
  updateGroup,
  deleteGroup,
  assignSensor,
  unassignSensor,
  assignRule,
  unassignRule,
  setMainMeteostation,
} from "./apis"

import { useSession } from "next-auth/react";

export default function GroupsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session, status } = useSession();
  // State variables
  const [groups, setGroups] = useState<Group[]>([])
  const [sensors, setAllSensors] = useState<Sensor[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  // Loading states
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isAssignSensorDialogOpen, setIsAssignSensorDialogOpen] = useState(false)
  const [isAssignRuleDialogOpen, setIsAssignRuleDialogOpen] = useState(false)
  const [isViewRulesDialogOpen, setIsViewRulesDialogOpen] = useState(false)
  const [isInspectionDialogOpen, setIsInspectionDialogOpen] = useState(false)

  // Selected items
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null)
  const [groupToEdit, setGroupToEdit] = useState<Group | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null)
  const [selectedRule, setSelectedRule] = useState<string | null>(null)
  const [rulesGroup, setRulesGroup] = useState<Group | null>(null)
  const [inspectionGroup, setInspectionGroup] = useState<Group | null>(null)
  const [inspectionDate, setInspectionDate] = useState<Date | undefined>(undefined)

  // Additional states
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [overrideAssignment, setOverrideAssignment] = useState(false)
  const [showAllRules, setShowAllRules] = useState(false)

  // Operation states
  const [isAddingGroup, setIsAddingGroup] = useState(false)
  const [isEditingGroup, setIsEditingGroup] = useState(false)
  const [isDeletingGroup, setIsDeletingGroup] = useState(false)
  const [isAssigningSensor, setIsAssigningSensor] = useState(false)
  const [isAssigningRule, setIsAssigningRule] = useState(false)

  // New group state
  const [newGroup, setNewGroup] = useState<
    Partial<Group> & { type: string; name: string; location: string; isHive: boolean }
  >({
    type: "",
    name: "",
    location: "",
    description: "",
    beehiveType: "",
    isHive: false,
    parentId: "",
    tags: [],
    sensors: [],
    rules: [],
    ruleSets: [],
    connectedGroups: [],
    isMain: false,
    automaticMode: false,
  })

  // Step-by-step group creation/editing
  const [addGroupStep, setAddGroupStep] = useState(1)
  const fetchData = useCallback(async () => {
    // Check session status *before* attempting to fetch
    if (status !== 'authenticated' || !session) {
      console.log("fetchData: Aborting fetch. Status is not 'authenticated' or session is missing.", { status, sessionExists: !!session });
      setIsLoading(false); // Ensure loading stops if we abort early
      setIsRefreshing(false);
      // setError("Authentication required to load data."); // Optionally set an error
      return; // Exit if not authenticated
    }

    // --- Start Fetching ---
    console.log("fetchData: Starting data fetch. Session available.", { sessionId: session.user?.id }); // Log session ID if available
    setIsLoading(true); // Indicate loading start
    setError(null); // Clear previous errors

    try {
      console.log("fetchData: Initiating API calls via Promise.all...");
      // Log the session object being passed (be mindful of logging sensitive tokens in production)
      // console.log("fetchData: Session object being used:", session); 

      const results = await Promise.all([
        fetchGroups(session),   // Expected to return Group[]
        fetchSensors(session),  // Expected to return Sensor[]
        fetchRules(session),    // Expected to return Rule[]
        fetchRuleSets(session), // Expected to return RuleSet[]
        fetchTags(session)      // Expected to return Tag[]
      ]);

      console.log("fetchData: Promise.all resolved successfully. Raw results:", results);

      // --- STATE UPDATES ---
      const [fetchedGroups, fetchedSensors, fetchedRules, fetchedRuleSets, fetchedTags] = results;

      console.log("fetchData: Destructured Results:", {
          groupsCount: fetchedGroups?.length ?? 0,
          sensorsCount: fetchedSensors?.length ?? 0,
          rulesCount: fetchedRules?.length ?? 0,
          ruleSetsCount: fetchedRuleSets?.length ?? 0,
          tagsCount: fetchedTags?.length ?? 0,
      });

      // Update state with the fetched data. Use || [] to ensure we always set an array.
      setGroups(fetchedGroups || []);
      setAllSensors(fetchedSensors || []); // Ensure this matches the state variable name
      setRules(fetchedRules || []);
      setRuleSets(fetchedRuleSets || []);
      setTags(fetchedTags || []);

      console.log("fetchData: State updated successfully.");
      setError(null); // Clear any previous error on success

    } catch (fetchError: any) {
      // Log the specific error encountered during fetching
      console.error("fetchData: Error during data fetch:", fetchError);
      const errorMessage = fetchError.message || "Failed to load necessary data for the groups page.";
      setError(errorMessage); // Set error state for UI feedback
      toast({ // Show a user-friendly error message
        title: "Error Loading Data",
        description: errorMessage,
        variant: "destructive",
      });
      // Optionally clear data on error, or leave stale data? Clearing is often safer.
      setGroups([]);
      setAllSensors([]);
      setRules([]);
      setRuleSets([]);
      setTags([]);

    } finally {
      // This block runs whether the try succeeded or failed
      console.log("fetchData: Fetch process finished. Setting loading states to false.");
      setIsLoading(false); // Ensure loading is stopped
      setIsRefreshing(false); // Ensure refreshing indicator stops
    }
  // useCallback dependencies: These determine when the fetchData function itself is recreated.
  // It needs session to access tokens, status to check auth state, and toast for notifications.
  }, [status, session, toast]);


  // --- FULL useEffect Hook for Initial Data Load & Auth Changes ---
  useEffect(() => {
    // Log the effect trigger and current auth status
    console.log("useEffect (Auth Check): Running. Current status:", status);

    // Guard clause: Only proceed if authentication status is determined
    if (status === 'loading') {
        console.log("useEffect (Auth Check): Status is 'loading', waiting...");
        setIsLoading(true); // Make sure loading indicator is on during auth check
        return; // Wait for status to resolve
    }

    if (status === 'authenticated') {
        // Double-check if session object is truly available
        if (session) {
            console.log("useEffect (Auth Check): Status is 'authenticated' and session exists. Calling fetchData.");
            fetchData(); // Call the memoized fetch function
        } else {
            // This case *shouldn't* ideally happen if next-auth works correctly,
            // but it's a safeguard. Status is authenticated but session object is null/undefined.
            console.error("useEffect (Auth Check): Status is 'authenticated' BUT session object is missing! Cannot fetch.");
            setError("Authentication session is missing. Please try reloading or logging in again.");
            setIsLoading(false);
            // Clear any potentially stale data
            setGroups([]);
            setAllSensors([]);
            setRules([]);
            setRuleSets([]);
            setTags([]);
        }
    } else { // status === 'unauthenticated'
        console.log("useEffect (Auth Check): Status is 'unauthenticated'. Clearing data and stopping loading.");
        // Clear data, ensure loading is off, clear errors
        setGroups([]);
        setAllSensors([]);
        setRules([]);
        setRuleSets([]);
        setTags([]);
        setError(null); // Clear error message
        setIsLoading(false); // Ensure loading indicator is definitely off
    }

  }, [status, fetchData, session]);

 
  // Function to refresh data
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData()
    toast({
      title: "Refreshed",
      description: "Data has been refreshed successfully.",
    })
  }

  // Function to add a new group
  const handleAddGroup = async () => {
    // Check for conflicting mode tags - only one mode tag can be active
    const modeTags = (newGroup.tags ?? []).filter((tagId) => {
      const tag = tags.find((t) => t.id === tagId)
      return tag && tag.type === "mode"
    })

    if (modeTags.length > 1) {
      toast({
        title: "Tag conflict",
        description: "Only one mode tag can be applied to a group. Please select only one mode tag.",
        variant: "destructive",
      })
      return
    }

    // Ensure rules from selected rule sets are included
    const rulesFromSets = (newGroup.ruleSets ?? []).flatMap((rsId) => {
      const ruleSet = ruleSets.find((rs) => rs.id === rsId)
      return ruleSet ? ruleSet.rules : []
    })
    const allRules = [...new Set([...(newGroup.rules ?? []), ...rulesFromSets])]

    // Construct the new group data
    const newGroupData: Partial<Group> = {
      name: newGroup.name,
      type: newGroup.type,
      location: newGroup.location,
      description: newGroup.description ?? "",
      beehiveType: newGroup.beehiveType,
      tags: newGroup.tags ?? [],
      sensors: newGroup.sensors ?? [],
      rules: allRules,
      ruleSets: newGroup.ruleSets ?? [],
      connectedGroups: newGroup.connectedGroups ?? [],
      parentId: newGroup.isHive ? newGroup.parentId : undefined,
      isMain: newGroup.type === "meteostation" ? newGroup.isMain : undefined,
      automaticMode: newGroup.automaticMode ?? false,
    }

    setIsAddingGroup(true)

    try {
      const createdGroup = await createGroup(newGroupData as Omit<Group, "id">, session)

      // If this is a meteostation and isMain is true, update other meteostations
      if (newGroup.type === "meteostation" && newGroup.isMain) {
        setGroups((prevGroups) =>
          prevGroups.map((group) => ({
            ...group,
            isMain: group.type === "meteostation" ? false : group.isMain,
          })),
        )
      }

      // Update parent group if this is a hive
      if (newGroup.isHive && newGroup.parentId) {
        setGroups((prevGroups) =>
          prevGroups.map((group) => {
            if (group.id === newGroup.parentId) {
              return {
                ...group,
                subgroups: [...(group.subgroups || []), createdGroup.id],
              }
            }
            return group
          }),
        )
      }

      // Add the new group to the list
      setGroups((prevGroups) => [...prevGroups, createdGroup])
      setIsAddDialogOpen(false)
      resetNewGroupForm()

      toast({
        title: "Group added",
        description: `${createdGroup.name} has been added successfully.`,
      })
    } catch (err) {
      console.error("Error creating group:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create group. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAddingGroup(false)
    }
  }

  // Function to edit an existing group
  const handleEditGroup = async () => {
    if (!groupToEdit) return

    // Ensure rules from selected rule sets are included
    const rulesFromSets = (groupToEdit.ruleSets ?? []).flatMap((rsId) => {
      const ruleSet = ruleSets.find((rs) => rs.id === rsId)
      return ruleSet ? ruleSet.rules : []
    })
    // Combine unique rules from direct assignment and sets
    const allRules = [...new Set([...(groupToEdit.rules ?? []), ...rulesFromSets])]

    setIsEditingGroup(true)

    try {
      const updatedGroup = await updateGroup({ ...groupToEdit, rules: allRules }, session)

      // If this is a meteostation and isMain is being set to true, update other meteostations
      if (groupToEdit.type === "meteostation" && groupToEdit.isMain) {
        setGroups((prevGroups) =>
          prevGroups.map((group) => {
            if (group.id !== groupToEdit.id && group.type === "meteostation") {
              return { ...group, isMain: false }
            }
            return group
          }),
        )
      }

      // Update the group in the list
      setGroups((prevGroups) =>
        prevGroups.map((group) => {
          if (group.id === updatedGroup.id) {
            return updatedGroup
          }
          return group
        }),
      )

      setIsEditDialogOpen(false)
      resetNewGroupForm()

      toast({
        title: "Group updated",
        description: `${updatedGroup.name} has been updated successfully.`,
      })
    } catch (err) {
      console.error("Error updating group:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update group. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsEditingGroup(false)
    }
  }

  // Function to delete a group
  const handleDeleteGroup = async () => {
    if (!groupToDelete) return

    const groupName = groups.find((g) => g.id === groupToDelete)?.name || "The group"
    const groupToRemove = groups.find((g) => g.id === groupToDelete)

    setIsDeletingGroup(true)

    try {
      await deleteGroup(groupToDelete, session)

      // Update sensors to remove assignments to this group
      setAllSensors(
        sensors.map((sensor) => (sensor.assignedTo === groupToDelete ? { ...sensor, assignedTo: null } : sensor)),
      )

      let groupsAfterDelete = [...groups]

      // Remove from parent's subgroups list if it's a subgroup
      if (groupToRemove?.parentId) {
        groupsAfterDelete = groupsAfterDelete.map((g) => {
          if (g.id === groupToRemove.parentId) {
            return { ...g, subgroups: (g.subgroups || []).filter((sgId) => sgId !== groupToDelete) }
          }
          return g
        })
      }

      // Remove the group itself
      groupsAfterDelete = groupsAfterDelete.filter((group) => group.id !== groupToDelete)

      setGroups(groupsAfterDelete)

      setIsDeleteDialogOpen(false)
      setGroupToDelete(null)

      toast({
        title: "Group deleted",
        description: `${groupName} has been deleted successfully.`,
      })
    } catch (err) {
      console.error("Error deleting group:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete group. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingGroup(false)
    }
  }

  // Function to assign a sensor to a group
  const handleAssignSensor = async () => {
    if (!selectedGroup || !selectedSensor) return

    const sensor = sensors.find((s) => s.id === selectedSensor)
    if (!sensor) return

    const targetGroup = groups.find((g) => g.id === selectedGroup)
    if (!targetGroup) return

    // If sensor is already assigned and override is false, show error
    if (sensor.assignedTo && sensor.assignedTo !== selectedGroup && !overrideAssignment) {
      toast({
        title: "Assignment failed",
        description: `This sensor is already assigned to ${groups.find((g) => g.id === sensor.assignedTo)?.name || "another group"}. Check the override option to reassign.`,
        variant: "destructive",
      })
      return
    }

    const previousGroupId = sensor.assignedTo

    setIsAssigningSensor(true)

    try {
      await assignSensor(selectedGroup, selectedSensor, session)

      // Update sensor assignment
      setAllSensors(sensors.map((s) => (s.id === selectedSensor ? { ...s, assignedTo: selectedGroup } : s)))

      // Update group sensors list
      setGroups(
        groups.map((group) => {
          const updatedGroup = { ...group }
          // Add sensor to the selected group
          if (group.id === selectedGroup) {
            // Avoid duplicates if already present
            if (!(updatedGroup.sensors ?? []).includes(selectedSensor)) {
              updatedGroup.sensors = [...(updatedGroup.sensors ?? []), selectedSensor]
            }
          }
          // If override is true and sensor had a *different* previous assignment, remove it from the previous group
          if (
            overrideAssignment &&
            previousGroupId &&
            previousGroupId !== selectedGroup &&
            group.id === previousGroupId
          ) {
            updatedGroup.sensors = (updatedGroup.sensors ?? []).filter((id) => id !== selectedSensor)
          }
          return updatedGroup
        }),
      )

      setIsAssignSensorDialogOpen(false)
      setSelectedGroup(null)
      setSelectedSensor(null)
      setOverrideAssignment(false)

      toast({
        title: "Sensor assigned",
        description: `Sensor ${sensor.name} has been assigned to ${targetGroup.name}.`,
      })
    } catch (err) {
      console.error("Error assigning sensor:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to assign sensor. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAssigningSensor(false)
    }
  }

  // Function to unassign a sensor from a group
  const handleUnassignSensor = async (groupId: string, sensorId: string) => {
    const sensorName = sensors.find((s) => s.id === sensorId)?.name || "The sensor"
    const groupName = groups.find((g) => g.id === groupId)?.name || "the group"

    try {
      await unassignSensor(groupId, sensorId)

      // Update sensor assignment
      setAllSensors(sensors.map((sensor) => (sensor.id === sensorId ? { ...sensor, assignedTo: null } : sensor)))

      // Update group sensors list
      setGroups(
        groups.map((group) =>
          group.id === groupId ? { ...group, sensors: (group.sensors ?? []).filter((id) => id !== sensorId) } : group,
        ),
      )

      toast({
        title: "Sensor unassigned",
        description: `${sensorName} has been unassigned from ${groupName}.`,
      })
    } catch (err) {
      console.error("Error unassigning sensor:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to unassign sensor. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Function to assign a rule to a group
  const handleAssignRule = async () => {
    if (!selectedGroup || !selectedRule) return

    const groupToUpdate = groups.find((g) => g.id === selectedGroup)
    if (!groupToUpdate) return

    const ruleToAdd = rules.find((r) => r.id === selectedRule)
    if (!ruleToAdd) return

    // Check if rule is already assigned (directly or via a rule set)
    const isAlreadyAssignedDirectly = (groupToUpdate.rules ?? []).includes(selectedRule)
    const isAssignedViaSet = ruleToAdd.ruleSet && (groupToUpdate.ruleSets ?? []).includes(ruleToAdd.ruleSet)

    if (isAlreadyAssignedDirectly || isAssignedViaSet) {
      toast({
        title: "Rule Already Applied",
        description: `This rule is already applied to the group ${isAssignedViaSet ? "via a rule set" : "directly"}.`,
        variant: "warning",
      })
      return
    }

    setIsAssigningRule(true)

    try {
      await assignRule(selectedGroup, selectedRule, session)

      // Update group rules list
      setGroups(
        groups.map((group) => {
          if (group.id === selectedGroup) {
            return {
              ...group,
              rules: [...(group.rules ?? []), selectedRule], // Add the individual rule
            }
          }
          return group
        }),
      )

      setIsAssignRuleDialogOpen(false)
      setSelectedGroup(null)
      setSelectedRule(null)

      toast({
        title: "Rule Assigned",
        description: `Rule "${ruleToAdd.name}" has been assigned successfully.`,
      })
    } catch (err) {
      console.error("Error assigning rule:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to assign rule. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAssigningRule(false)
    }
  }

  // Function to unassign a rule from a group
  const handleUnassignRule = async (groupId: string, ruleId: string) => {
    const ruleName = rules.find((r) => r.id === ruleId)?.name || "The rule"
    const groupName = groups.find((g) => g.id === groupId)?.name || "the group"

    // Find the rule to check if it belongs to a rule set applied to the group
    const rule = rules.find((r) => r.id === ruleId)
    const group = groups.find((g) => g.id === groupId)

    if (rule && group && rule.ruleSet && (group.ruleSets || []).includes(rule.ruleSet)) {
      toast({
        title: "Cannot Unassign Rule",
        description: `"${ruleName}" is part of an applied rule set (${ruleSets.find((rs) => rs.id === rule.ruleSet)?.name}). To remove it, either unassign the rule set or edit the rule set itself.`,
        variant: "warning",
      })
      return
    }

    try {
      await unassignRule(groupId, ruleId, session)

      // Update group rules list (only removes individually added rules)
      setGroups(
        groups.map((currentGroup) =>
          currentGroup.id === groupId
            ? { ...currentGroup, rules: (currentGroup.rules ?? []).filter((id) => id !== ruleId) }
            : currentGroup,
        ),
      )
      // Update the local state for the dialog if it's open
      setRulesGroup((prev) =>
        prev && prev.id === groupId ? { ...prev, rules: (prev.rules ?? []).filter((id) => id !== ruleId) } : prev,
      )

      toast({
        title: "Rule unassigned",
        description: `Rule "${ruleName}" has been unassigned from ${groupName}.`,
      })
    } catch (err) {
      console.error("Error unassigning rule:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to unassign rule. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Function to set inspection date for a group
  const handleSetInspectionDate = async () => {
    if (!inspectionGroup || !inspectionDate) return

    try {
      await setInspectionDate(inspectionGroup.id, format(inspectionDate, "yyyy-MM-dd"))

      setGroups(
        groups.map((group) =>
          group.id === inspectionGroup.id ? { ...group, lastInspection: format(inspectionDate, "yyyy-MM-dd") } : group,
        ),
      )

      setIsInspectionDialogOpen(false)
      setInspectionGroup(null)
      setInspectionDate(undefined)

      toast({
        title: "Inspection date updated",
        description: `Last inspection date has been updated to ${format(inspectionDate, "PPP")}.`,
      })
    } catch (err) {
      console.error("Error setting inspection date:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to set inspection date. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Function to set a meteostation as the main one
  const handleSetMainMeteostation = async (groupId: string) => {
    try {
      await setMainMeteostation(groupId, groupId, session)

      setGroups(
        groups.map((group) => {
          if (group.type === "meteostation") {
            return { ...group, isMain: group.id === groupId }
          }
          return group
        }),
      )

      toast({
        title: "Main Meteostation Updated",
        description: `${groups.find((g) => g.id === groupId)?.name} is now the main meteostation.`,
      })
    } catch (err) {
      console.error("Error setting main meteostation:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to set main meteostation. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Helper functions
  const resetNewGroupForm = () => {
    setAddGroupStep(1)
    setNewGroup({
      type: "",
      name: "",
      location: "",
      description: "",
      beehiveType: "",
      isHive: false,
      parentId: "",
      tags: [],
      sensors: [],
      rules: [],
      ruleSets: [],
      connectedGroups: [],
      isMain: false,
      automaticMode: false,
    })
    setGroupToEdit(null)
    setShowAllRules(false)
  }

  const handleAddGroupNext = () => {
    // Validate current step
    if (addGroupStep === 1 && !newGroup.type) {
      toast({
        title: "Missing information",
        description: "Please select a group type.",
        variant: "destructive",
      })
      return
    }

    if (addGroupStep === 2 && (!newGroup.name || !newGroup.location)) {
      toast({
        title: "Missing information",
        description: "Please provide a name and location.",
        variant: "destructive",
      })
      return
    }

    if (addGroupStep === 3 && newGroup.type === "beehive" && !newGroup.beehiveType) {
      toast({
        title: "Missing information",
        description: "Please select a beehive type.",
        variant: "destructive",
      })
      return
    }
    if (addGroupStep === 3 && newGroup.type === "hive" && !newGroup.parentId) {
      toast({
        title: "Missing information",
        description: "Please select a parent beehive for this subgroup.",
        variant: "destructive",
      })
      return
    }

    // Move to next step or finish
    if (addGroupStep < 7) {
      setAddGroupStep(addGroupStep + 1)
    } else {
      handleAddGroup()
    }
  }

  const handleAddGroupBack = () => {
    if (addGroupStep > 1) {
      setAddGroupStep(addGroupStep - 1)
    } else {
      setIsAddDialogOpen(false)
      resetNewGroupForm()
    }
  }

  const handleEditGroupNext = () => {
    // Validate current step
    if (!groupToEdit) return

    if (addGroupStep === 1 && !groupToEdit.type) {
      toast({
        title: "Missing information",
        description: "Please select a group type.",
        variant: "destructive",
      })
      return
    }

    if (addGroupStep === 2 && (!groupToEdit.name || !groupToEdit.location)) {
      toast({
        title: "Missing information",
        description: "Please provide a name and location.",
        variant: "destructive",
      })
      return
    }

    if (addGroupStep === 3 && groupToEdit.type === "beehive" && !groupToEdit.beehiveType) {
      toast({
        title: "Missing information",
        description: "Please select a beehive type.",
        variant: "destructive",
      })
      return
    }
    if (addGroupStep === 3 && groupToEdit.type === "hive" && !groupToEdit.parentId) {
      toast({
        title: "Missing information",
        description: "Please select a parent beehive for this subgroup.",
        variant: "destructive",
      })
      return
    }

    // Move to next step or finish
    if (addGroupStep < 7) {
      setAddGroupStep(addGroupStep + 1)
    } else {
      handleEditGroup()
    }
  }

  const handleEditGroupBack = () => {
    if (addGroupStep > 1) {
      setAddGroupStep(addGroupStep - 1)
    } else {
      setIsEditDialogOpen(false)
      resetNewGroupForm()
    }
  }

  const handleViewGroup = (groupId: string) => {
    router.push(`/admin/groups/${groupId}`)
  }

  const handleStartEditGroup = (group: Group) => {
    setGroupToEdit({ ...group })
    setAddGroupStep(1)
    setIsEditDialogOpen(true)
    setShowAllRules(false)
  }

  const handleViewRules = (group: Group) => {
    setRulesGroup(group)
    setIsViewRulesDialogOpen(true)
  }

  const toggleGroupExpanded = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  // Helper functions for UI display
  const getTagName = (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId)
    return tag ? tag.name : tagId
  }



  const getTagBadgeVariant = (tagId: string): "default" | "secondary" | "destructive" | "outline" | "warning" => {
    const tag = tags.find((t) => t.id === tagId)
    if (!tag) return "default"

    if (tag.type === "mode") {
      return "default"
    }
    if (tag.type === "status") {
      return "destructive"
    }
    if (tag.type === "purpose") {
      return "secondary"
    }
    

    return "outline"
  }

  const getGroupTypeIcon = (type: string) => {
    switch (type) {
      case "beehive":
        return "🐝"
      case "meteostation":
        return "🌤️"
      case "hive":
        return "🍯"
      case "generic":
        return "📦"
      default:
        return "📋"
    }
  }

  const getRuleName = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId)
    return rule ? rule.name : ruleId
  }

  const getRuleDescription = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId)
    return rule ? rule.description : ""
  }

  const getRuleTypeIcon = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId)
    if (!rule) return null

    switch (rule.initiator) {
      case "temp":
        return "🌡️"
      case "humidity":
        return "💧"
      case "weight":
        return "⚖️"
      case "activity":
        return "🐝"
      default:
        return "📊"
    }
  }

  const getHealthColor = (health: number) => {
    if (health >= 80) return "bg-emerald-500"
    if (health >= 60) return "bg-amber-500"
    if (health >= 40) return "bg-orange-500"
    return "bg-red-500"
  }

  const getHealthTextColor = (health: number) => {
    if (health >= 80) return "text-emerald-500"
    if (health >= 60) return "text-amber-500"
    if (health >= 40) return "text-orange-500"
    return "text-red-500"
  }

  const getTagRuleOverrides = (tagIds: string[] | undefined) => {
    if (!tagIds) return null
    const overrides: Record<string, string> = {}

    tagIds.forEach((tagId) => {
      const tag = tags.find((t) => t.id === tagId)
      if (tag && tag.ruleOverrides && Array.isArray(tag.ruleOverrides) && tag.ruleOverrides.length > 0) {
        tag.ruleOverrides.forEach((override) => {
          const [rule, value] = override.split(":")
          if (rule && value) {
            overrides[rule] = value
          }
        })
      }
    })

    return Object.keys(overrides).length > 0 ? overrides : null
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Groups</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Groups</h1>
        <div className="bg-destructive/20 p-4 rounded-md mb-6">
          <h2 className="text-xl font-semibold text-destructive mb-2">Error</h2>
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchData}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Group Management</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing || isLoading} className="mr-2">
            {isRefreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>

          <Dialog open={isAssignSensorDialogOpen} onOpenChange={setIsAssignSensorDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <LinkIcon className="mr-2 h-4 w-4" />
                Assign Sensor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Sensor to Group</DialogTitle>
                <DialogDescription>Select a sensor and a group to create an assignment.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="group">Group</Label>
                  <Select onValueChange={setSelectedGroup} value={selectedGroup || undefined}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {getGroupTypeIcon(group.type)} {group.name} {group.parentId ? `(Subgroup)` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sensor">Sensor</Label>
                  <Select onValueChange={setSelectedSensor} value={selectedSensor || undefined}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a sensor" />
                    </SelectTrigger>
                    <SelectContent>
                      {sensors.map((sensor) => (
                        <SelectItem key={sensor.id} value={sensor.id} disabled={sensor.assignedTo === selectedGroup}>
                          {sensor.name} ({sensor.type})
                          {sensor.assignedTo &&
                            sensor.assignedTo !== selectedGroup &&
                            ` (Assigned to ${groups.find((g) => g.id === sensor.assignedTo)?.name || "another"})`}
                          {sensor.assignedTo === selectedGroup && ` (Already assigned)`}
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
                    disabled={
                      !selectedSensor ||
                      !sensors.find((s) => s.id === selectedSensor)?.assignedTo ||
                      sensors.find((s) => s.id === selectedSensor)?.assignedTo === selectedGroup
                    }
                  />
                  <Label
                    htmlFor="override"
                    className={`text-sm ${!selectedSensor || !sensors.find((s) => s.id === selectedSensor)?.assignedTo || sensors.find((s) => s.id === selectedSensor)?.assignedTo === selectedGroup ? "text-muted-foreground" : ""}`}
                  >
                    Override existing assignment
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAssignSensorDialogOpen(false)
                    setSelectedGroup(null)
                    setSelectedSensor(null)
                    setOverrideAssignment(false)
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleAssignSensor} disabled={!selectedGroup || !selectedSensor || isAssigningSensor}>
                  {isAssigningSensor ? "Assigning..." : "Assign"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isAddDialogOpen}
            onOpenChange={(open) => {
              setIsAddDialogOpen(open)
              if (!open) resetNewGroupForm()
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Group
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px]">
              <DialogHeader>
                <DialogTitle>Add New Group</DialogTitle>
                <DialogDescription>Complete the wizard to create a new group</DialogDescription>
              </DialogHeader>
              {/* Wizard Progress Indicator - Slider Style */}
              <div className="mb-8 mt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Step {addGroupStep} of 7</span>
                  <span className="text-sm text-muted-foreground">
                    {addGroupStep === 1 && "Select Type"}
                    {addGroupStep === 2 && "Basic Information"}
                    {addGroupStep === 3 && "Configuration"}
                    {addGroupStep === 4 && "Tags"}
                    {addGroupStep === 5 && "Sensors"}
                    {addGroupStep === 6 && "Rules & Connections"}
                    {addGroupStep === 7 && "Summary"}
                  </span>
                </div>

                <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-primary transition-all duration-300 ease-in-out"
                    style={{ width: `${(addGroupStep / 7) * 100}%` }}
                  ></div>
                </div>

                <div className="flex justify-between mt-2 text-xs">
                  <span className={addGroupStep >= 1 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Type
                  </span>
                  <span className={addGroupStep >= 2 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Info
                  </span>
                  <span className={addGroupStep >= 3 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Config
                  </span>
                  <span className={addGroupStep >= 4 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Tags
                  </span>
                  <span className={addGroupStep >= 5 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Sensors
                  </span>
                  <span className={addGroupStep >= 6 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Rules
                  </span>
                  <span className={addGroupStep >= 7 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Summary
                  </span>
                </div>
              </div>
              <ScrollArea className="max-h-[60vh] h-[350px] pr-5">
                <div className="py-4 min-h-[300px]">
                  {/* Step 1: Select Group Type */}
                  {addGroupStep === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Select Group Type</h3>
                      <p className="text-sm text-muted-foreground mb-4">Choose the type of group you want to create</p>
                      <div className="grid grid-cols-2 gap-4">
                        <Card
                          className={`cursor-pointer hover:border-primary transition-colors ${newGroup.type === "beehive" ? "border-primary bg-primary/5" : ""}`}
                          onClick={() => setNewGroup({ ...newGroup, type: "beehive", isHive: false })} // Ensure isHive is false
                        >
                          <CardContent className="p-6 text-center">
                            <div className="text-4xl mb-2">🐝</div>
                            <h3 className="font-medium">Beehive</h3>
                            <p className="text-sm text-muted-foreground">Primary beehive group</p>
                          </CardContent>
                        </Card>

                        <Card
                          className={`cursor-pointer hover:border-primary transition-colors ${newGroup.type === "meteostation" ? "border-primary bg-primary/5" : ""}`}
                          onClick={() => setNewGroup({ ...newGroup, type: "meteostation", isHive: false })} // Ensure isHive is false
                        >
                          <CardContent className="p-6 text-center">
                            <div className="text-4xl mb-2">🌤️</div>
                            <h3 className="font-medium">Meteostation</h3>
                            <p className="text-sm text-muted-foreground">Weather monitoring station</p>
                          </CardContent>
                        </Card>

                        <Card
                          className={`cursor-pointer hover:border-primary transition-colors ${newGroup.type === "hive" ? "border-primary bg-primary/5" : ""}`}
                          onClick={() => setNewGroup({ ...newGroup, type: "hive", isHive: true })} // Ensure isHive is true
                        >
                          <CardContent className="p-6 text-center">
                            <div className="text-4xl mb-2">🍯</div>
                            <h3 className="font-medium">Hive (Subgroup)</h3>
                            <p className="text-sm text-muted-foreground">Subgroup of a beehive</p>
                          </CardContent>
                        </Card>

                        <Card
                          className={`cursor-pointer hover:border-primary transition-colors ${newGroup.type === "generic" ? "border-primary bg-primary/5" : ""}`}
                          onClick={() => setNewGroup({ ...newGroup, type: "generic", isHive: false })} // Ensure isHive is false
                        >
                          <CardContent className="p-6 text-center">
                            <div className="text-4xl mb-2">📦</div>
                            <h3 className="font-medium">Generic</h3>
                            <p className="text-sm text-muted-foreground">Other group type</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Basic Information */}
                  {addGroupStep === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Basic Information</h3>
                      <p className="text-sm text-muted-foreground mb-4">Provide essential details about your group</p>
                      <div className="space-y-2">
                        <Label htmlFor="name">Group Name</Label>
                        <Input
                          id="name"
                          placeholder="Enter group name"
                          value={newGroup.name}
                          onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          placeholder="Enter group location"
                          value={newGroup.location}
                          onChange={(e) => setNewGroup({ ...newGroup, location: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          placeholder="Enter group description (optional)"
                          value={newGroup.description}
                          onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 3: Group Configuration */}
                  {addGroupStep === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Group Configuration</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Configure specific settings for this group type
                      </p>
                      {newGroup.type === "beehive" && (
                        <div className="space-y-2">
                          <Label htmlFor="beehiveType">Beehive Type</Label>
                          <Select
                            value={newGroup.beehiveType}
                            onValueChange={(value) => setNewGroup({ ...newGroup, beehiveType: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select beehive type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="39x24">Standard (39x24)</SelectItem>
                              <SelectItem value="42x27">Large (42x27)</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {newGroup.type === "meteostation" && (
                        <div className="flex items-center space-x-2 p-4 border rounded-md">
                          <Checkbox
                            id="isMain"
                            checked={newGroup.isMain}
                            onCheckedChange={(checked) => setNewGroup({ ...newGroup, isMain: checked === true })}
                          />
                          <Label htmlFor="isMain" className="flex items-center cursor-pointer">
                            <Star
                              className={`mr-2 h-4 w-4 transition-colors ${newGroup.isMain ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"}`}
                            />
                            Set as main meteostation for dashboard
                          </Label>
                        </div>
                      )}

                      {newGroup.type === "hive" && (
                        <div className="space-y-2">
                          <Label htmlFor="parentId">Parent Beehive</Label>
                          <Select
                            value={newGroup.parentId}
                            onValueChange={(value) => setNewGroup({ ...newGroup, parentId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select parent beehive" />
                            </SelectTrigger>
                            <SelectContent>
                              {groups
                                .filter((group) => group.type === "beehive")
                                .map((group) => (
                                  <SelectItem key={group.id} value={group.id}>
                                    {group.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {!newGroup.parentId && (
                            <p className="text-xs text-destructive mt-1">
                              A parent beehive is required for a hive subgroup.
                            </p>
                          )}
                        </div>
                      )}
                      {/* Show message if no config needed */}
                      {(newGroup.type === "generic" ||
                        (newGroup.type !== "beehive" &&
                          newGroup.type !== "meteostation" &&
                          newGroup.type !== "hive")) && (
                        <p className="text-sm text-muted-foreground p-4 border rounded-md">
                          No specific configuration needed for this group type.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Step 4: Add Tags */}
                  {addGroupStep === 4 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Tags</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Assign tags to categorize and manage your group (optional)
                      </p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-base">Purpose Tags</Label>
                          <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                            {tags
                              .filter((tag) => tag.type === "purpose")
                              .map((tag) => (
                                <div key={tag.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`tag-${tag.id}`}
                                    checked={(newGroup.tags ?? []).includes(tag.id)}
                                    onCheckedChange={(checked) => {
                                      const currentTags = newGroup.tags ?? []
                                      if (checked) {
                                        setNewGroup({ ...newGroup, tags: [...currentTags, tag.id] })
                                      } else {
                                        setNewGroup({ ...newGroup, tags: currentTags.filter((t) => t !== tag.id) })
                                      }
                                    }}
                                  />
                                  <Label htmlFor={`tag-${tag.id}`} className="flex items-center cursor-pointer">
                                    {tag.name}
                                    {tag.ruleOverrides && tag.ruleOverrides.length > 0 && (
                                      <span className="ml-1 text-xs text-muted-foreground" title="Has rule overrides">
                                        (R)
                                      </span>
                                    )}
                                  </Label>
                                </div>
                              ))}
                            {tags.filter((tag) => tag.type === "purpose").length === 0 && (
                              <p className="text-xs text-muted-foreground col-span-2">No purpose tags available.</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-base">Mode Tags (Select one)</Label>
                          <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                            {tags
                              .filter((tag) => tag.type === "mode")
                              .map((tag) => (
                                <div key={tag.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`tag-${tag.id}`}
                                    checked={(newGroup.tags ?? []).includes(tag.id)}
                                    onCheckedChange={(checked) => {
                                      // Ensure only one mode tag is selected
                                      const currentTags = newGroup.tags ?? []
                                      const otherModeTags = tags.filter((t) => t.type === "mode").map((t) => t.id)
                                      const tagsWithoutModes = currentTags.filter((t) => !otherModeTags.includes(t))
                                      if (checked) {
                                        setNewGroup({ ...newGroup, tags: [...tagsWithoutModes, tag.id] })
                                      } else {
                                        // If unchecking the currently selected one, just remove it
                                        setNewGroup({ ...newGroup, tags: tagsWithoutModes })
                                      }
                                    }}
                                  />
                                  <Label htmlFor={`tag-${tag.id}`} className="flex items-center cursor-pointer">
                                    {tag.name}
                                    {tag.ruleOverrides && tag.ruleOverrides.length > 0 && (
                                      <span className="ml-1 text-xs text-muted-foreground" title="Has rule overrides">
                                        (R)
                                      </span>
                                    )}
                                  </Label>
                                </div>
                              ))}
                            {tags.filter((tag) => tag.type === "mode").length === 0 && (
                              <p className="text-xs text-muted-foreground col-span-2">No mode tags available.</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-base">Status Tags</Label>
                          <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                            {tags
                              .filter((tag) => tag.type === "status")
                              .map((tag) => (
                                <div key={tag.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`tag-${tag.id}`}
                                    checked={(newGroup.tags ?? []).includes(tag.id)}
                                    onCheckedChange={(checked) => {
                                      const currentTags = newGroup.tags ?? []
                                      if (checked) {
                                        setNewGroup({ ...newGroup, tags: [...currentTags, tag.id] })
                                      } else {
                                        setNewGroup({ ...newGroup, tags: currentTags.filter((t) => t !== tag.id) })
                                      }
                                    }}
                                  />
                                  <Label htmlFor={`tag-${tag.id}`} className="cursor-pointer">
                                    {tag.name}
                                    {tag.alertLevel && (
                                      <Badge variant={getTagBadgeVariant(tag.id)} className="ml-2">
                                        {tag.alertLevel}
                                      </Badge>
                                    )}
                                  </Label>
                                </div>
                              ))}
                            {tags.filter((tag) => tag.type === "status").length === 0 && (
                              <p className="text-xs text-muted-foreground col-span-2">No status tags available.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Assign Sensors */}
                  {addGroupStep === 5 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Sensors</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Assign sensors to monitor this group (optional)
                      </p>
                      <div className="space-y-2">
                        <Label className="text-base">Available Sensors</Label>
                        <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                          {sensors
                            .filter((sensor) => !sensor.assignedTo) // Only show unassigned sensors initially
                            .map((sensor) => (
                              <div key={sensor.id} className="flex items-center space-x-2 py-1">
                                <Checkbox
                                  id={`sensor-${sensor.id}`}
                                  checked={(newGroup.sensors ?? []).includes(sensor.id)}
                                  onCheckedChange={(checked) => {
                                    const currentSensors = newGroup.sensors ?? []
                                    if (checked) {
                                      setNewGroup({ ...newGroup, sensors: [...currentSensors, sensor.id] })
                                    } else {
                                      setNewGroup({
                                        ...newGroup,
                                        sensors: currentSensors.filter((s) => s !== sensor.id),
                                      })
                                    }
                                  }}
                                />
                                <Label htmlFor={`sensor-${sensor.id}`} className="flex-1 cursor-pointer">
                                  {sensor.name}
                                  <span className="text-xs text-muted-foreground ml-2">({sensor.type})</span>
                                </Label>
                              </div>
                            ))}
                          {sensors.filter((s) => !s.assignedTo).length === 0 && (
                            <p className="text-sm text-muted-foreground py-2">
                              No unassigned sensors available. Use the "Assign Sensor" button on the main page to manage
                              assignments.
                            </p>
                          )}
                        </div>
                      </div>

                      {(newGroup.sensors ?? []).length > 0 && (
                        <div className="mt-4 p-3 border rounded-md bg-muted/30">
                          <h4 className="text-sm font-medium mb-2">
                            Selected Sensors ({(newGroup.sensors ?? []).length})
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {(newGroup.sensors ?? []).map((sensorId) => {
                              const sensor = sensors.find((s) => s.id === sensorId)
                              return sensor ? (
                                <Badge key={sensorId} variant="secondary" className="flex items-center gap-1">
                                  {sensor.name}
                                  <button
                                    type="button"
                                    className="ml-1 opacity-50 hover:opacity-100 focus:outline-none"
                                    onClick={() =>
                                      setNewGroup({
                                        ...newGroup,
                                        sensors: (newGroup.sensors ?? []).filter((id) => id !== sensorId),
                                      })
                                    }
                                    aria-label={`Remove sensor ${sensor.name}`}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={2.5}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M18 6 6 18" />
                                      <path d="m6 6 12 12" />
                                    </svg>
                                  </button>
                                </Badge>
                              ) : null
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 6: Add Rules & Connections */}
                  {addGroupStep === 6 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Rules & Connections</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Apply rules and connect to other groups (optional)
                      </p>

                      {/* Automatic Rules Section - Primary */}
                      {(newGroup.type === "beehive" || newGroup.type === "hive") && (
                        <div className="space-y-2">
                          <Label className="text-base">Automatic Monitoring</Label>
                          <div className="border rounded-md p-3">
                            <div key="automatic_rules" className="mb-1 pb-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Checkbox
                                  id="automatic_rules"
                                  checked={newGroup.automaticMode ?? false}
                                  onCheckedChange={(checked) => {
                                    setNewGroup({ ...newGroup, automaticMode: checked === true })
                                  }}
                                />
                                <Label htmlFor="automatic_rules" className="flex-1 font-medium cursor-pointer">
                                  Automatic Beehive Monitoring
                                </Label>
                                <Badge variant="secondary">Priority 9</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground ml-6">
                                Enables monitoring via tags, creating schedules and tips automatically. Overrides
                                explicit rules if priority is higher.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rule Sets Section */}
                      <div className="space-y-2 mt-4">
                        <Label className="text-base">Rule Sets</Label>
                        <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                          {ruleSets.length > 0 ? (
                            ruleSets.map((ruleSet) => (
                              <div key={ruleSet.id} className="mb-3 border-b pb-3 last:border-b-0 last:pb-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Checkbox
                                    id={`ruleset-${ruleSet.id}`}
                                    checked={(newGroup.ruleSets ?? []).includes(ruleSet.id)}
                                    onCheckedChange={(checked) => {
                                      const currentRuleSets = newGroup.ruleSets ?? []
                                      if (checked) {
                                        setNewGroup({ ...newGroup, ruleSets: [...currentRuleSets, ruleSet.id] })
                                      } else {
                                        setNewGroup({
                                          ...newGroup,
                                          ruleSets: currentRuleSets.filter((id) => id !== ruleSet.id),
                                        })
                                      }
                                    }}
                                  />
                                  <Label
                                    htmlFor={`ruleset-${ruleSet.id}`}
                                    className="flex-1 font-medium cursor-pointer"
                                  >
                                    {ruleSet.name}
                                  </Label>
                                  <Badge variant="outline">
                                    {ruleSet.rules.length} Rule{ruleSet.rules.length !== 1 ? "s" : ""}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground ml-6">{ruleSet.description}</div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">No rule sets available.</p>
                          )}
                        </div>
                      </div>

                      {/* Individual Rules Section - Secondary */}
                      <div className="space-y-2 mt-4">
                        <div className="flex justify-between items-center">
                          <Label className="text-base">Additional Individual Rules</Label>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-xs h-auto p-0"
                            onClick={() => setShowAllRules(!showAllRules)}
                          >
                            {showAllRules ? "Hide rules from applied sets" : "Show all rules"}
                          </Button>
                        </div>
                        <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                          {rules.length > 0 ? (
                            rules
                              .filter((rule) => {
                                const isInSelectedRuleSet =
                                  rule.ruleSet && (newGroup.ruleSets ?? []).includes(rule.ruleSet)
                                // Show rule if showAllRules is true OR if it's not part of a selected rule set
                                return showAllRules || !isInSelectedRuleSet
                              })
                              .map((rule) => {
                                const isInSelectedRuleSet =
                                  rule.ruleSet && (newGroup.ruleSets ?? []).includes(rule.ruleSet)
                                const isChecked = (newGroup.rules ?? []).includes(rule.id)

                                return (
                                  <div key={rule.id} className="flex items-center space-x-2 py-1">
                                    <Checkbox
                                      id={`rule-${rule.id}`}
                                      checked={isChecked || isInSelectedRuleSet}
                                      disabled={isInSelectedRuleSet}
                                      onCheckedChange={(checked) => {
                                        const currentRules = newGroup.rules ?? []
                                        // This only handles *individual* rule selection/deselection
                                        if (checked) {
                                          setNewGroup({
                                            ...newGroup,
                                            rules: [...currentRules, rule.id],
                                          })
                                        } else {
                                          setNewGroup({
                                            ...newGroup,
                                            rules: currentRules.filter((id) => id !== rule.id),
                                          })
                                        }
                                      }}
                                    />
                                    <Label
                                      htmlFor={`rule-${rule.id}`}
                                      className={`flex-1 ${isInSelectedRuleSet ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                                    >
                                      <>
                                        <div className="flex items-center">
                                          <span className="mr-1">{getRuleTypeIcon(rule.id)}</span>
                                          {rule.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">{rule.description}</div>
                                      </>
                                    </Label>
                                    {rule.ruleSet && (
                                      <Badge variant="outline" className="ml-auto">
                                        {ruleSets.find((rs) => rs.id === rule.ruleSet)?.name || "Unknown Set"}
                                        {isInSelectedRuleSet && <span className="ml-1 text-xs">(Applied via Set)</span>}
                                      </Badge>
                                    )}
                                  </div>
                                )
                              })
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">No rules available.</p>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Step 7: Summary */}
                  {addGroupStep === 7 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Summary</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Review your group configuration before creating
                      </p>

                      <div className="border rounded-md divide-y">
                        <div className="p-3 flex">
                          <div className="w-1/3 font-medium">Group Type</div>
                          <div className="w-2/3 flex items-center">
                            <span className="mr-2">{getGroupTypeIcon(newGroup.type)}</span>
                            {newGroup.type.charAt(0).toUpperCase() + newGroup.type.slice(1)}
                            {newGroup.type === "meteostation" && newGroup.isMain && (
                              <Badge variant="secondary" className="ml-2">
                                <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-600" />
                                Main
                              </Badge>
                            )}
                            {newGroup.type === "hive" && (
                              <span className="ml-1 text-xs text-muted-foreground">(Subgroup)</span>
                            )}
                          </div>
                        </div>

                        <div className="p-3 flex">
                          <div className="w-1/3 font-medium">Name</div>
                          <div className="w-2/3">{newGroup.name}</div>
                        </div>

                        <div className="p-3 flex">
                          <div className="w-1/3 font-medium">Location</div>
                          <div className="w-2/3">{newGroup.location}</div>
                        </div>

                        {newGroup.description && (
                          <div className="p-3 flex">
                            <div className="w-1/3 font-medium">Description</div>
                            <div className="w-2/3 whitespace-pre-wrap">{newGroup.description}</div>
                          </div>
                        )}

                        {newGroup.type === "beehive" && newGroup.beehiveType && (
                          <div className="p-3 flex">
                            <div className="w-1/3 font-medium">Beehive Type</div>
                            <div className="w-2/3">{newGroup.beehiveType}</div>
                          </div>
                        )}

                        {newGroup.type === "hive" && newGroup.parentId && (
                          <div className="p-3 flex">
                            <div className="w-1/3 font-medium">Parent Beehive</div>
                            <div className="w-2/3">
                              {groups.find((g) => g.id === newGroup.parentId)?.name || "Unknown"}
                            </div>
                          </div>
                        )}

                        {(newGroup.tags ?? []).length > 0 && (
                          <div className="p-3 flex">
                            <div className="w-1/3 font-medium">Tags</div>
                            <div className="w-2/3">
                              <div className="flex flex-wrap gap-1">
                                {(newGroup.tags ?? []).map((tagId) => (
                                  <Badge key={tagId} variant={getTagBadgeVariant(tagId)}>
                                    {getTagName(tagId)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {(newGroup.sensors ?? []).length > 0 && (
                          <div className="p-3 flex">
                            <div className="w-1/3 font-medium">Sensors</div>
                            <div className="w-2/3">
                              <div className="flex flex-wrap gap-1">
                                {(newGroup.sensors ?? []).map((sensorId) => {
                                  const sensor = sensors.find((s) => s.id === sensorId)
                                  return sensor ? (
                                    <Badge key={sensorId} variant="outline">
                                      {sensor.name} ({sensor.type})
                                    </Badge>
                                  ) : null
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Summary for Rule Sets */}
                        {(newGroup.ruleSets ?? []).length > 0 && (
                          <div className="p-3 flex">
                            <div className="w-1/3 font-medium">Rule Sets</div>
                            <div className="w-2/3">
                              <div className="flex flex-col gap-1">
                                {(newGroup.ruleSets ?? []).map((ruleSetId) => {
                                  const ruleSet = ruleSets.find((rs) => rs.id === ruleSetId)
                                  return ruleSet ? (
                                    <div key={ruleSetId} className="text-sm">
                                      {ruleSet.name}{" "}
                                      <span className="text-xs text-muted-foreground">
                                        ({rules.filter((rule) => rule.ruleSet === ruleSetId).length} rules included)
                                      </span>
                                    </div>
                                  ) : null
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Summary for Individual Rules */}
                        {(() => {
                          const individualRules = (newGroup.rules ?? []).filter((ruleId) => {
                            const rule = rules.find((r) => r.id === ruleId)
                            // Only include if the rule exists AND (it has no ruleSet OR its ruleSet is NOT in the selected newGroup.ruleSets)
                            return rule && (!rule.ruleSet || !(newGroup.ruleSets ?? []).includes(rule.ruleSet))
                          })

                          if (individualRules.length > 0) {
                            return (
                              <div className="p-3 flex">
                                <div className="w-1/3 font-medium">Individual Rules</div>
                                <div className="w-2/3">
                                  <div className="flex flex-col gap-1">
                                    {individualRules.map((ruleId) => {
                                      const rule = rules.find((r) => r.id === ruleId)
                                      return rule ? (
                                        <div key={ruleId} className="text-sm">
                                          {getRuleTypeIcon(ruleId)} {rule.name}
                                        </div>
                                      ) : null
                                    })}
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          return null // Render nothing if no individual rules
                        })()}

                        {(newGroup.connectedGroups ?? []).length > 0 && (
                          <div className="p-3 flex">
                            <div className="w-1/3 font-medium">Connected To</div>
                            <div className="w-2/3">
                              <div className="flex flex-col gap-1">
                                {(newGroup.connectedGroups ?? []).map((groupId) => {
                                  const group = groups.find((g) => g.id === groupId)
                                  return group ? (
                                    <div key={groupId} className="text-sm flex items-center">
                                      <span className="mr-1">{getGroupTypeIcon(group.type)}</span>
                                      {group.name}
                                      {group.type === "meteostation" && group.isMain && (
                                        <span className="ml-1 text-xs text-muted-foreground">(Main)</span>
                                      )}
                                    </div>
                                  ) : null
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {newGroup.automaticMode && (
                          <div className="p-3 flex">
                            <div className="w-1/3 font-medium">Monitoring Mode</div>
                            <div className="w-2/3">
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Automatic Monitoring (Priority 9)
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter>
                <div className="flex justify-between w-full pt-4 border-t">
                  <Button variant="outline" onClick={handleAddGroupBack} disabled={addGroupStep === 1}>
                    {addGroupStep === 1 ? "Cancel" : "Back"}
                  </Button>
                  <Button onClick={addGroupStep === 7 ? handleAddGroup : handleAddGroupNext} disabled={isAddingGroup}>
                    {addGroupStep === 7 ? (isAddingGroup ? "Creating..." : "Create Group") : "Next"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open)
              if (!open) resetNewGroupForm()
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit Group
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px]">
              <DialogHeader>
                <DialogTitle>Edit Group: {groupToEdit?.name}</DialogTitle>
                <DialogDescription>Update your group configuration</DialogDescription>
              </DialogHeader>
              {/* Wizard Progress Indicator */}
              <div className="mb-8 mt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Step {addGroupStep} of 7</span>
                  <span className="text-sm text-muted-foreground">
                    {addGroupStep === 1 && "Select Type"}
                    {addGroupStep === 2 && "Basic Information"}
                    {addGroupStep === 3 && "Configuration"}
                    {addGroupStep === 4 && "Tags"}
                    {addGroupStep === 5 && "Sensors"}
                    {addGroupStep === 6 && "Rules & Connections"}
                    {addGroupStep === 7 && "Summary"}
                  </span>
                </div>
                <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-primary transition-all duration-300 ease-in-out"
                    style={{ width: `${(addGroupStep / 7) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className={addGroupStep >= 1 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Type
                  </span>
                  <span className={addGroupStep >= 2 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Info
                  </span>
                  <span className={addGroupStep >= 3 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Config
                  </span>
                  <span className={addGroupStep >= 4 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Tags
                  </span>
                  <span className={addGroupStep >= 5 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Sensors
                  </span>
                  <span className={addGroupStep >= 6 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Rules
                  </span>
                  <span className={addGroupStep >= 7 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Summary
                  </span>
                </div>
              </div>
              <ScrollArea className="max-h-[60vh] h-[350px] pr-5">
                {groupToEdit && (
                  <div className="py-4 min-h-[300px]">
                    {/* Step 1: Edit Group Type */}
                    {addGroupStep === 1 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Group Type</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Change the type of the group (use with caution)
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <Card
                            className={`cursor-pointer hover:border-primary transition-colors ${groupToEdit.type === "beehive" ? "border-primary bg-primary/5" : ""}`}
                            onClick={() => setGroupToEdit({ ...groupToEdit, type: "beehive", parentId: undefined })}
                          >
                            <CardContent className="p-6 text-center">
                              <div className="text-4xl mb-2">🐝</div>
                              <h3 className="font-medium">Beehive</h3>
                            </CardContent>
                          </Card>

                          <Card
                            className={`cursor-pointer hover:border-primary transition-colors ${groupToEdit.type === "meteostation" ? "border-primary bg-primary/5" : ""}`}
                            onClick={() =>
                              setGroupToEdit({
                                ...groupToEdit,
                                type: "meteostation",
                                parentId: undefined,
                                beehiveType: undefined,
                              })
                            }
                          >
                            <CardContent className="p-6 text-center">
                              <div className="text-4xl mb-2">🌤️</div>
                              <h3 className="font-medium">Meteostation</h3>
                            </CardContent>
                          </Card>

                          <Card
                            className={`cursor-pointer hover:border-primary transition-colors ${groupToEdit.type === "hive" ? "border-primary bg-primary/5" : ""}`}
                            onClick={() => {
                              setGroupToEdit({ ...groupToEdit, type: "hive", beehiveType: undefined })
                            }}
                          >
                            <CardContent className="p-6 text-center">
                              <div className="text-4xl mb-2">🍯</div>
                              <h3 className="font-medium">Hive (Subgroup)</h3>
                            </CardContent>
                          </Card>

                          <Card
                            className={`cursor-pointer hover:border-primary transition-colors ${groupToEdit.type === "generic" ? "border-primary bg-primary/5" : ""}`}
                            onClick={() =>
                              setGroupToEdit({
                                ...groupToEdit,
                                type: "generic",
                                parentId: undefined,
                                beehiveType: undefined,
                              })
                            }
                          >
                            <CardContent className="p-6 text-center">
                              <div className="text-4xl mb-2">📦</div>
                              <h3 className="font-medium">Generic</h3>
                            </CardContent>
                          </Card>
                        </div>
                        <p className="text-xs text-amber-600 mt-4">
                          Changing the group type might reset or invalidate certain configurations (like Parent Beehive,
                          Beehive Type, Main Meteostation status). Review subsequent steps carefully.
                        </p>
                      </div>
                    )}

                    {/* Step 2: Basic Information */}
                    {addGroupStep === 2 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Basic Information</h3>
                        <p className="text-sm text-muted-foreground mb-4">Update essential details about your group</p>
                        <div className="space-y-2">
                          <Label htmlFor="edit-name">Group Name</Label>
                          <Input
                            id="edit-name"
                            placeholder="Enter group name"
                            value={groupToEdit.name}
                            onChange={(e) => setGroupToEdit({ ...groupToEdit, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-location">Location</Label>
                          <Input
                            id="edit-location"
                            placeholder="Enter group location"
                            value={groupToEdit.location || ""}
                            onChange={(e) => setGroupToEdit({ ...groupToEdit, location: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-description">Description</Label>
                          <Textarea
                            id="edit-description"
                            placeholder="Enter group description (optional)"
                            value={groupToEdit.description || ""}
                            onChange={(e) => setGroupToEdit({ ...groupToEdit, description: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {/* Step 3: Group Configuration */}
                    {addGroupStep === 3 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Group Configuration</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Update specific settings for this group type
                        </p>
                        {groupToEdit.type === "beehive" && (
                          <div className="space-y-2">
                            <Label htmlFor="edit-beehiveType">Beehive Type</Label>
                            <Select
                              value={groupToEdit.beehiveType || ""}
                              onValueChange={(value) => setGroupToEdit({ ...groupToEdit, beehiveType: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select beehive type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="39x24">Standard (39x24)</SelectItem>
                                <SelectItem value="42x27">Large (42x27)</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {groupToEdit.type === "meteostation" && (
                          <div className="flex items-center space-x-2 p-4 border rounded-md">
                            <Checkbox
                              id="edit-isMain"
                              checked={groupToEdit.isMain || false}
                              onCheckedChange={(checked) =>
                                setGroupToEdit({ ...groupToEdit, isMain: checked === true })
                              }
                            />
                            <Label htmlFor="edit-isMain" className="flex items-center cursor-pointer">
                              <Star
                                className={`mr-2 h-4 w-4 transition-colors ${groupToEdit.isMain ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"}`}
                              />
                              Set as main meteostation for dashboard
                            </Label>
                          </div>
                        )}

                        {groupToEdit.type === "hive" && (
                          <div className="space-y-2">
                            <Label htmlFor="edit-parentId">Parent Beehive</Label>
                            <Select
                              value={groupToEdit.parentId || ""}
                              onValueChange={(value) => setGroupToEdit({ ...groupToEdit, parentId: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select parent beehive" />
                              </SelectTrigger>
                              <SelectContent>
                                {groups
                                  .filter((group) => group.type === "beehive" && group.id !== groupToEdit.id)
                                  .map((group) => (
                                    <SelectItem key={group.id} value={group.id}>
                                      {group.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            {!groupToEdit.parentId && (
                              <p className="text-xs text-destructive mt-1">
                                A parent beehive is required for a hive subgroup.
                              </p>
                            )}
                          </div>
                        )}
                        {/* Show message if no config needed */}
                        {(groupToEdit.type === "generic" ||
                          (groupToEdit.type !== "beehive" &&
                            groupToEdit.type !== "meteostation" &&
                            groupToEdit.type !== "hive")) && (
                          <p className="text-sm text-muted-foreground p-4 border rounded-md">
                            No specific configuration needed for this group type.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Step 4: Edit Tags */}
                    {addGroupStep === 4 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Tags</h3>
                        <p className="text-sm text-muted-foreground mb-4">Update tags assigned to this group</p>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-base">Purpose Tags</Label>
                            <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                              {tags
                                .filter((tag) => tag.type === "purpose")
                                .map((tag) => (
                                  <div key={tag.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`edit-tag-${tag.id}`}
                                      checked={(groupToEdit.tags ?? []).includes(tag.id)}
                                      onCheckedChange={(checked) => {
                                        const currentTags = groupToEdit.tags ?? []
                                        if (checked) {
                                          setGroupToEdit({ ...groupToEdit, tags: [...currentTags, tag.id] })
                                        } else {
                                          setGroupToEdit({
                                            ...groupToEdit,
                                            tags: currentTags.filter((t) => t !== tag.id),
                                          })
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`edit-tag-${tag.id}`} className="flex items-center cursor-pointer">
                                      {tag.name}
                                      {tag.ruleOverrides && tag.ruleOverrides.length > 0 && (
                                        <span className="ml-1 text-xs text-muted-foreground" title="Has rule overrides">
                                          (R)
                                        </span>
                                      )}
                                    </Label>
                                  </div>
                                ))}
                              {tags.filter((tag) => tag.type === "purpose").length === 0 && (
                                <p className="text-xs text-muted-foreground col-span-2">No purpose tags available.</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-base">Mode Tags (Select one)</Label>
                            <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                              {tags
                                .filter((tag) => tag.type === "mode")
                                .map((tag) => (
                                  <div key={tag.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`edit-tag-${tag.id}`}
                                      checked={(groupToEdit.tags ?? []).includes(tag.id)}
                                      onCheckedChange={(checked) => {
                                        const currentTags = groupToEdit.tags ?? []
                                        const otherModeTags = tags.filter((t) => t.type === "mode").map((t) => t.id)
                                        const tagsWithoutModes = currentTags.filter((t) => !otherModeTags.includes(t))
                                        if (checked) {
                                          setGroupToEdit({ ...groupToEdit, tags: [...tagsWithoutModes, tag.id] })
                                        } else {
                                          setGroupToEdit({ ...groupToEdit, tags: tagsWithoutModes })
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`edit-tag-${tag.id}`} className="flex items-center cursor-pointer">
                                      {tag.name}
                                      {tag.ruleOverrides && tag.ruleOverrides.length > 0 && (
                                        <span className="ml-1 text-xs text-muted-foreground" title="Has rule overrides">
                                          (R)
                                        </span>
                                      )}
                                    </Label>
                                  </div>
                                ))}
                              {tags.filter((tag) => tag.type === "mode").length === 0 && (
                                <p className="text-xs text-muted-foreground col-span-2">No mode tags available.</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-base">Status Tags</Label>
                            <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                              {tags
                                .filter((tag) => tag.type === "status")
                                .map((tag) => (
                                  <div key={tag.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`edit-tag-${tag.id}`}
                                      checked={(groupToEdit.tags ?? []).includes(tag.id)}
                                      onCheckedChange={(checked) => {
                                        const currentTags = groupToEdit.tags ?? []
                                        if (checked) {
                                          setGroupToEdit({ ...groupToEdit, tags: [...currentTags, tag.id] })
                                        } else {
                                          setGroupToEdit({
                                            ...groupToEdit,
                                            tags: currentTags.filter((t) => t !== tag.id),
                                          })
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`edit-tag-${tag.id}`} className="cursor-pointer">
                                      {tag.name}
                                      {tag.alertLevel && (
                                        <Badge variant={getTagBadgeVariant(tag.id)} className="ml-2">
                                          {tag.alertLevel}
                                        </Badge>
                                      )}
                                    </Label>
                                  </div>
                                ))}
                              {tags.filter((tag) => tag.type === "status").length === 0 && (
                                <p className="text-xs text-muted-foreground col-span-2">No status tags available.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 5: Manage Sensors */}
                    {addGroupStep === 5 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Sensors</h3>
                        <p className="text-sm text-muted-foreground mb-4">Update sensors assigned to this group</p>
                        <div className="space-y-2">
                          <Label className="text-base">Available & Assigned Sensors</Label>
                          <p className="text-xs text-muted-foreground">
                            Check sensors to assign them to <span className="font-medium">{groupToEdit.name}</span>.
                            Uncheck to unassign.
                          </p>
                          <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                            {sensors
                              .filter((sensor) => !sensor.assignedTo || sensor.assignedTo === groupToEdit.id)
                              .map((sensor) => (
                                <div key={sensor.id} className="flex items-center space-x-2 py-1">
                                  <Checkbox
                                    id={`edit-sensor-${sensor.id}`}
                                    checked={(groupToEdit.sensors ?? []).includes(sensor.id)}
                                    onCheckedChange={(checked) => {
                                      const currentSensors = groupToEdit.sensors ?? []
                                      if (checked) {
                                        // Assign sensor to this group in both group's list and sensor's record
                                        setGroupToEdit({ ...groupToEdit, sensors: [...currentSensors, sensor.id] })
                                        setAllSensors((prevSensors) =>
                                          prevSensors.map((s) =>
                                            s.id === sensor.id ? { ...s, assignedTo: groupToEdit.id } : s,
                                          ),
                                        )
                                      } else {
                                        // Unassign sensor from this group
                                        setGroupToEdit({
                                          ...groupToEdit,
                                          sensors: currentSensors.filter((sId) => sId !== sensor.id),
                                        })
                                        setAllSensors((prevSensors) =>
                                          prevSensors.map((s) => (s.id === sensor.id ? { ...s, assignedTo: null } : s)),
                                        )
                                      }
                                    }}
                                  />
                                  <Label htmlFor={`edit-sensor-${sensor.id}`} className="flex-1 cursor-pointer">
                                    {sensor.name}
                                    <span className="text-xs text-muted-foreground ml-2">({sensor.type})</span>
                                  </Label>
                                </div>
                              ))}
                            {sensors.filter((sensor) => !sensor.assignedTo || sensor.assignedTo === groupToEdit.id)
                              .length === 0 && (
                              <p className="text-sm text-muted-foreground py-2">
                                No sensors currently available or assigned to this group.
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            To assign a sensor already linked to *another* group, use the "Assign Sensor" button on the
                            main page with the override option.
                          </p>
                        </div>

                        {(groupToEdit.sensors ?? []).length > 0 && (
                          <div className="mt-4 p-3 border rounded-md bg-muted/30">
                            <h4 className="text-sm font-medium mb-2">
                              Currently Assigned Sensors ({(groupToEdit.sensors ?? []).length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {(groupToEdit.sensors ?? []).map((sensorId) => {
                                const sensor = sensors.find((s) => s.id === sensorId)
                                return sensor ? (
                                  <Badge key={sensorId} variant="secondary" className="flex items-center gap-1">
                                    {sensor.name}
                                    <button
                                      type="button"
                                      className="ml-1 opacity-50 hover:opacity-100 focus:outline-none"
                                      onClick={() => {
                                        const currentSensors = groupToEdit.sensors ?? []
                                        // Unassign sensor from this group
                                        setGroupToEdit({
                                          ...groupToEdit,
                                          sensors: currentSensors.filter((sId) => sId !== sensor.id),
                                        })
                                        setAllSensors((prevSensors) =>
                                          prevSensors.map((s) => (s.id === sensor.id ? { ...s, assignedTo: null } : s)),
                                        )
                                      }}
                                      aria-label={`Remove sensor ${sensor.name}`}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={2.5}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M18 6 6 18" />
                                        <path d="m6 6 12 12" />
                                      </svg>
                                    </button>
                                  </Badge>
                                ) : null
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 6: Manage Rules & Connections */}
                    {addGroupStep === 6 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Rules & Connections</h3>
                        <p className="text-sm text-muted-foreground mb-4">Update applied rules and connections</p>

                        {/*Automatic Rules Section */}
                        {(groupToEdit.type === "beehive" || groupToEdit.type === "hive") && (
                          <div className="space-y-2">
                            <Label className="text-base">Automatic Monitoring</Label>
                            <div className="border rounded-md p-3">
                              <div key="automatic_rules" className="mb-1 pb-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Checkbox
                                    id="edit-automatic_rules"
                                    checked={groupToEdit?.automaticMode ?? false}
                                    onCheckedChange={(checked) => {
                                      setGroupToEdit((prev) =>
                                        prev ? { ...prev, automaticMode: checked === true } : null,
                                      )
                                    }}
                                  />
                                  <Label htmlFor="edit-automatic_rules" className="flex-1 font-medium cursor-pointer">
                                    Automatic Beehive Monitoring
                                  </Label>
                                  <Badge variant="secondary">Priority 9</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground ml-6">
                                  Enables monitoring via tags, creating schedules and tips automatically. Overrides
                                  explicit rules if priority is higher.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Rule Sets Section */}
                        <div className="space-y-2 mt-4">
                          <Label className="text-base">Rule Sets</Label>
                          <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                            {ruleSets.length > 0 ? (
                              ruleSets.map((ruleSet) => (
                                <div key={ruleSet.id} className="mb-3 border-b pb-3 last:border-b-0 last:pb-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <Checkbox
                                      id={`edit-ruleset-${ruleSet.id}`}
                                      checked={(groupToEdit.ruleSets ?? []).includes(ruleSet.id)}
                                      onCheckedChange={(checked) => {
                                        const currentRuleSets = groupToEdit.ruleSets ?? []
                                        if (checked) {
                                          setGroupToEdit({ ...groupToEdit, ruleSets: [...currentRuleSets, ruleSet.id] })
                                        } else {
                                          setGroupToEdit({
                                            ...groupToEdit,
                                            ruleSets: currentRuleSets.filter((id) => id !== ruleSet.id),
                                          })
                                        }
                                      }}
                                    />
                                    <Label
                                      htmlFor={`edit-ruleset-${ruleSet.id}`}
                                      className="flex-1 font-medium cursor-pointer"
                                    >
                                      {ruleSet.name}
                                    </Label>
                                    <Badge variant="outline">
                                      {ruleSet.rules.length} Rule{ruleSet.rules.length !== 1 ? "s" : ""}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground ml-6">{ruleSet.description}</div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">No rule sets available.</p>
                            )}
                          </div>
                        </div>

                        {/* Individual Rules Section */}
                        <div className="space-y-2 mt-4">
                          <div className="flex justify-between items-center">
                            <Label className="text-base">Additional Individual Rules</Label>
                            <Button
                              variant="link"
                              size="sm"
                              className="text-xs h-auto p-0"
                              onClick={() => setShowAllRules(!showAllRules)}
                            >
                              {showAllRules ? "Hide rules from applied sets" : "Show all rules"}
                            </Button>
                          </div>
                          <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                            {rules.length > 0 ? (
                              rules
                                .filter((rule) => {
                                  const isInSelectedRuleSet =
                                    rule.ruleSet && (groupToEdit.ruleSets ?? []).includes(rule.ruleSet)
                                  return showAllRules || !isInSelectedRuleSet
                                })
                                .map((rule) => {
                                  const isInSelectedRuleSet =
                                    rule.ruleSet && (groupToEdit.ruleSets ?? []).includes(rule.ruleSet)
                                  const isChecked = (groupToEdit.rules ?? []).includes(rule.id)

                                  return (
                                    <div key={rule.id} className="flex items-center space-x-2 py-1">
                                      <Checkbox
                                        id={`edit-rule-${rule.id}`}
                                        checked={isChecked || isInSelectedRuleSet}
                                        disabled={isInSelectedRuleSet}
                                        onCheckedChange={(checked) => {
                                          const currentRules = groupToEdit.rules ?? []
                                          if (checked) {
                                            setGroupToEdit({ ...groupToEdit, rules: [...currentRules, rule.id] })
                                          } else {
                                            setGroupToEdit({
                                              ...groupToEdit,
                                              rules: currentRules.filter((id) => id !== rule.id),
                                            })
                                          }
                                        }}
                                      />
                                      <Label
                                        htmlFor={`edit-rule-${rule.id}`}
                                        className={`flex-1 ${isInSelectedRuleSet ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                                      >
                                        <>
                                          <div className="flex items-center">
                                            <span className="mr-1">{getRuleTypeIcon(rule.id)}</span>
                                            {rule.name}
                                          </div>
                                          <div className="text-xs text-muted-foreground">{rule.description}</div>
                                        </>
                                      </Label>
                                      {rule.ruleSet && (
                                        <Badge variant="outline" className="ml-auto">
                                          {ruleSets.find((rs) => rs.id === rule.ruleSet)?.name || "Unknown Set"}
                                          {isInSelectedRuleSet && (
                                            <span className="ml-1 text-xs">(Applied via Set)</span>
                                          )}
                                        </Badge>
                                      )}
                                    </div>
                                  )
                                })
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">No rules available.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 7: Summary */}
                    {addGroupStep === 7 && groupToEdit && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Summary</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Review your group configuration before saving changes
                        </p>

                        <div className="border rounded-md divide-y">
                          {/* --- Type --- */}
                          <div className="p-3 flex">
                            <div className="w-1/3 font-medium">Group Type</div>
                            <div className="w-2/3 flex items-center">
                              <span className="mr-2">{getGroupTypeIcon(groupToEdit.type)}</span>
                              {groupToEdit.type.charAt(0).toUpperCase() + groupToEdit.type.slice(1)}
                              {groupToEdit.type === "meteostation" && groupToEdit.isMain && (
                                <Badge variant="secondary" className="ml-2">
                                  <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-600" /> Main
                                </Badge>
                              )}
                              {groupToEdit.type === "hive" && (
                                <span className="ml-1 text-xs text-muted-foreground">(Subgroup)</span>
                              )}
                            </div>
                          </div>

                          {/* --- Name --- */}
                          <div className="p-3 flex">
                            <div className="w-1/3 font-medium">Name</div>
                            <div className="w-2/3">{groupToEdit.name}</div>
                          </div>

                          {/* --- Location --- */}
                          <div className="p-3 flex">
                            <div className="w-1/3 font-medium">Location</div>
                            <div className="w-2/3">{groupToEdit.location}</div>
                          </div>

                          {/* --- Description (Optional) --- */}
                          {groupToEdit.description && (
                            <div className="p-3 flex">
                              <div className="w-1/3 font-medium">Description</div>
                              <div className="w-2/3 whitespace-pre-wrap">{groupToEdit.description}</div>
                            </div>
                          )}

                          {/* --- Beehive Type (Conditional) --- */}
                          {groupToEdit.type === "beehive" && groupToEdit.beehiveType && (
                            <div className="p-3 flex">
                              <div className="w-1/3 font-medium">Beehive Type</div>
                              <div className="w-2/3">{groupToEdit.beehiveType}</div>
                            </div>
                          )}

                          {/* --- Parent Beehive (Conditional) --- */}
                          {groupToEdit.type === "hive" && groupToEdit.parentId && (
                            <div className="p-3 flex">
                              <div className="w-1/3 font-medium">Parent Beehive</div>
                              <div className="w-2/3">
                                {groups.find((g) => g.id === groupToEdit.parentId)?.name || "Unknown"}
                              </div>
                            </div>
                          )}

                          {/* --- Tags (Optional) --- */}
                          {(groupToEdit.tags ?? []).length > 0 && (
                            <div className="p-3 flex">
                              <div className="w-1/3 font-medium">Tags</div>
                              <div className="w-2/3">
                                <div className="flex flex-wrap gap-1">
                                  {(groupToEdit.tags ?? []).map((tagId) => (
                                    <Badge key={tagId} variant={getTagBadgeVariant(tagId)}>
                                      {getTagName(tagId)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* --- Sensors (Optional) --- */}
                          {(groupToEdit.sensors ?? []).length > 0 && (
                            <div className="p-3 flex">
                              <div className="w-1/3 font-medium">Sensors</div>
                              <div className="w-2/3">
                                <div className="flex flex-wrap gap-1">
                                  {(groupToEdit.sensors ?? []).map((sensorId) => {
                                    const sensor = sensors.find((s) => s.id === sensorId)
                                    return sensor ? (
                                      <Badge key={sensorId} variant="outline">
                                        {sensor.name} ({sensor.type})
                                      </Badge>
                                    ) : null
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* --- Rule Sets (Optional) --- */}
                          {(groupToEdit.ruleSets ?? []).length > 0 && (
                            <div className="p-3 flex">
                              <div className="w-1/3 font-medium">Rule Sets</div>
                              <div className="w-2/3">
                                <div className="flex flex-col gap-1">
                                  {(groupToEdit.ruleSets ?? []).map((ruleSetId) => {
                                    const ruleSet = ruleSets.find((rs) => rs.id === ruleSetId)
                                    return ruleSet ? (
                                      <div key={ruleSetId} className="text-sm">
                                        {ruleSet.name}{" "}
                                        <span className="text-xs text-muted-foreground">
                                          ({rules.filter((rule) => rule.ruleSet === ruleSetId).length} rules included)
                                        </span>
                                      </div>
                                    ) : null
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* --- Individual Rules (Optional) --- */}
                          {(() => {
                            const individualRules = (groupToEdit.rules ?? []).filter((ruleId) => {
                              const rule = rules.find((r) => r.id === ruleId)
                              return rule && (!rule.ruleSet || !(groupToEdit.ruleSets ?? []).includes(rule.ruleSet))
                            })

                            if (individualRules.length > 0) {
                              return (
                                <div className="p-3 flex">
                                  <div className="w-1/3 font-medium">Individual Rules</div>
                                  <div className="w-2/3">
                                    <div className="flex flex-col gap-1">
                                      {individualRules.map((ruleId) => {
                                        const rule = rules.find((r) => r.id === ruleId)
                                        return rule ? (
                                          <div key={ruleId} className="text-sm">
                                            {getRuleTypeIcon(ruleId)} {rule.name}
                                          </div>
                                        ) : null
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          })()}

                          {/* --- Connections (Optional) --- */}
                          {(groupToEdit.connectedGroups ?? []).length > 0 && (
                            <div className="p-3 flex">
                              <div className="w-1/3 font-medium">Connected To</div>
                              <div className="w-2/3">
                                <div className="flex flex-col gap-1">
                                  {(groupToEdit.connectedGroups ?? []).map((groupId) => {
                                    const group = groups.find((g) => g.id === groupId)
                                    return group ? (
                                      <div key={groupId} className="text-sm flex items-center">
                                        <span className="mr-1">{getGroupTypeIcon(group.type)}</span>
                                        {group.name}
                                        {group.type === "meteostation" && group.isMain && (
                                          <span className="mr-1 text-xs text-muted-foreground">(Main)</span>
                                        )}
                                      </div>
                                    ) : null
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                          {groupToEdit?.automaticMode && (
                            <div className="p-3 flex">
                              <div className="w-1/3 font-medium">Monitoring Mode</div>
                              <div className="w-2/3">
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Automatic Monitoring (Priority 9)
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
              <DialogFooter>
                <div className="flex justify-between w-full pt-4 border-t">
                  <Button variant="outline" onClick={handleEditGroupBack} disabled={addGroupStep === 1}>
                    {addGroupStep === 1 ? "Cancel" : "Back"}
                  </Button>
                  <Button onClick={addGroupStep === 7 ? handleEditGroup : handleEditGroupNext}>
                    {addGroupStep === 7 ? (isEditingGroup ? "Saving..." : "Save Changes") : "Next"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Groups</CardTitle>
          <CardDescription>Manage your groups and assign sensors and rules.</CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {isLoading ? "Loading groups..." : "No groups found. Add a group to get started."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Name</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead className="w-[150px]">Location</TableHead>
                  <TableHead className="w-[150px]">Tags</TableHead>
                  <TableHead className="w-[150px]">Sensors</TableHead>
                  <TableHead className="w-[120px]">Health</TableHead>
                  <TableHead className="w-[150px]">Last Inspection</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups
                  .filter((group) => !group.parentId) // Only render top-level groups initially
                  .map((group) => (
                    <React.Fragment key={group.id}>
                      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewGroup(group.id)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            {group.subgroups && group.subgroups.length > 0 ? (
                              <button
                                onClick={(e) => toggleGroupExpanded(group.id, e)}
                                className="cursor-pointer p-1 hover:bg-muted rounded-sm mr-1 focus:outline-none focus:ring-1 focus:ring-ring"
                                aria-label={
                                  expandedGroups[group.id] ? `Collapse ${group.name}` : `Expand ${group.name}`
                                }
                                aria-expanded={expandedGroups[group.id]}
                              >
                                <ChevronRight
                                  className={`h-4 w-4 text-muted-foreground transition-transform ${expandedGroups[group.id] ? "rotate-90" : ""}`}
                                />
                              </button>
                            ) : (
                              <div className="w-6 mr-1" /> // Placeholder for alignment
                            )}
                            <span className="mr-2" aria-hidden="true">
                              {getGroupTypeIcon(group.type)}
                            </span>
                            {group.name}
                            {group.type === "meteostation" && group.isMain && (
                              <Badge variant="secondary" className="ml-2">
                                <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-600" />
                                Main
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`
                              ${group.type === "beehive" ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300" : ""}
                              ${group.type === "meteostation" ? "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300" : ""}
                              ${group.type === "hive" ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300" : ""}
                              ${group.type === "generic" ? "bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300" : ""}
                            `}
                          >
                            {group.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{group.location || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(group.tags ?? []).map((tagId) => (
                              <Badge key={tagId} variant={getTagBadgeVariant(tagId)}>
                                {getTagName(tagId)}
                              </Badge>
                            ))}
                            {(!group.tags || group.tags.length === 0) && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex -space-x-2 overflow-hidden">
                            {(group.sensors ?? []).slice(0, 4).map((sensorId) => {
                              const sensor = sensors.find((s) => s.id === sensorId)
                              if (!sensor) return null
                              const initials = sensor.name
                                .split(" ")
                                .map((word) => word[0])
                                .join("")
                                .substring(0, 2)
                                .toUpperCase()

                              return (
                                <div
                                  key={sensorId}
                                  className={`
                                    inline-flex items-center justify-center w-8 h-8 rounded-full
                                    border-2 border-background text-xs font-medium
                                    ${sensor.type === "Temperature" ? "bg-red-200 text-red-800" : ""}
                                    ${sensor.type === "Humidity" ? "bg-blue-200 text-blue-800" : ""}
                                    ${sensor.type === "Weight" ? "bg-purple-200 text-purple-800" : ""}
                                    ${sensor.type === "Wind" ? "bg-teal-200 text-teal-800" : ""}
                                    ${sensor.type === "Light" ? "bg-yellow-200 text-yellow-800" : ""}
                                    bg-gray-200 text-gray-800 // Fallback
                                  `}
                                  title={`${sensor.name} (${sensor.type})`}
                                >
                                  {initials}
                                </div>
                              )
                            })}
                            {(group.sensors ?? []).length > 4 && (
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground border-2 border-background text-xs font-medium">
                                +{(group.sensors ?? []).length - 4}
                              </div>
                            )}
                            {(!group.sensors || group.sensors.length === 0) && (
                              <span className="text-muted-foreground text-sm">No sensors</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {group.health !== undefined && group.health !== null ? (
                            <div className="flex items-center space-x-2">
                              <Progress
                                value={group.health}
                                className={`h-2 w-20 [&>div]:${getHealthColor(group.health)}`}
                                aria-label={`Health ${group.health}%`}
                              />
                              <span className={`${getHealthTextColor(group.health)} font-medium`}>{group.health}%</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span>{group.lastInspection ? format(new Date(group.lastInspection), "PP") : "Never"}</span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Actions for ${group.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewGroup(group.id)
                                }}
                              >
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStartEditGroup(group)
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Group
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedGroup(group.id)
                                  setIsAssignSensorDialogOpen(true)
                                }}
                              >
                                <LinkIcon className="mr-2 h-4 w-4" />
                                Assign Sensor...
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewRules(group)
                                }}
                              >
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                View/Manage Rules...
                              </DropdownMenuItem>
                              {group.type === "meteostation" && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSetMainMeteostation(group.id)
                                  }}
                                  disabled={group.isMain}
                                >
                                  <Star
                                    className={`mr-2 h-4 w-4 transition-colors ${group.isMain ? "fill-yellow-400 text-yellow-500" : ""}`}
                                  />
                                  {group.isMain ? "Is Main Meteostation" : "Set as Main"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600 focus:bg-red-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setGroupToDelete(group.id)
                                  setIsDeleteDialogOpen(true)
                                }}
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Delete Group...
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {/* Render subgroups if expanded */}
                      {expandedGroups[group.id] &&
                        group.subgroups &&
                        group.subgroups.length > 0 &&
                        group.subgroups.map((subgroupId) => {
                          const subgroup = groups.find((g) => g.id === subgroupId)
                          if (!subgroup) return null

                          return (
                            <TableRow
                              key={`subgroup-${subgroup.id}`}
                              className="cursor-pointer hover:bg-muted/50 bg-muted/20"
                              onClick={() => handleViewGroup(subgroup.id)}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center pl-8">
                                  <span className="mr-2">{getGroupTypeIcon(subgroup.type)}</span>
                                  {subgroup.name}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`
                                    ${subgroup.type === "beehive" ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300" : ""}
                                    ${subgroup.type === "meteostation" ? "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300" : ""}
                                    ${subgroup.type === "hive" ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300" : ""}
                                    ${subgroup.type === "generic" ? "bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300" : ""}
                                  `}
                                >
                                  {subgroup.type}
                                </Badge>
                              </TableCell>
                              <TableCell>{subgroup.location || "—"}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {(subgroup.tags ?? []).map((tagId) => (
                                    <Badge key={tagId} variant={getTagBadgeVariant(tagId)}>
                                      {getTagName(tagId)}
                                    </Badge>
                                  ))}
                                  {(!subgroup.tags || subgroup.tags.length === 0) && (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex -space-x-2 overflow-hidden">
                                  {(subgroup.sensors ?? []).slice(0, 4).map((sensorId) => {
                                    const sensor = sensors.find((s) => s.id === sensorId)
                                    if (!sensor) return null
                                    const initials = sensor.name
                                      .split(" ")
                                      .map((word) => word[0])
                                      .join("")
                                      .substring(0, 2)
                                      .toUpperCase()

                                    return (
                                      <div
                                        key={sensorId}
                                        className={`
                                          inline-flex items-center justify-center w-8 h-8 rounded-full
                                          border-2 border-background text-xs font-medium
                                          ${sensor.type === "Temperature" ? "bg-red-200 text-red-800" : ""}
                                          ${sensor.type === "Humidity" ? "bg-blue-200 text-blue-800" : ""}
                                          ${sensor.type === "Weight" ? "bg-purple-200 text-purple-800" : ""}
                                          ${sensor.type === "Wind" ? "bg-teal-200 text-teal-800" : ""}
                                          ${sensor.type === "Light" ? "bg-yellow-200 text-yellow-800" : ""}
                                           bg-gray-200 text-gray-800 // Fallback
                                        `}
                                        title={`${sensor.name} (${sensor.type})`}
                                      >
                                        {initials}
                                      </div>
                                    )
                                  })}
                                  {(subgroup.sensors ?? []).length > 4 && (
                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground border-2 border-background text-xs font-medium">
                                      +{(subgroup.sensors ?? []).length - 4}
                                    </div>
                                  )}
                                  {(!subgroup.sensors || subgroup.sensors.length === 0) && (
                                    <span className="text-muted-foreground text-sm">No sensors</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {subgroup.health !== undefined && subgroup.health !== null ? (
                                  <div className="flex items-center space-x-2">
                                    <Progress
                                      value={subgroup.health}
                                      className={`h-2 w-20 [&>div]:${getHealthColor(subgroup.health)}`}
                                      aria-label={`Health ${subgroup.health}%`}
                                    />
                                    <span className={`${getHealthTextColor(subgroup.health)} font-medium`}>
                                      {subgroup.health}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span>
                                  {subgroup.lastInspection ? format(new Date(subgroup.lastInspection), "PP") : "Never"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label={`Actions for ${subgroup.name}`}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleViewGroup(subgroup.id)
                                      }}
                                    >
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleStartEditGroup(subgroup)
                                      }}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit Subgroup
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedGroup(subgroup.id)
                                        setIsAssignSensorDialogOpen(true)
                                      }}
                                    >
                                      <LinkIcon className="mr-2 h-4 w-4" />
                                      Assign Sensor...
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setInspectionGroup(subgroup)
                                        setIsInspectionDialogOpen(true)
                                      }}
                                    >
                                      <CalendarComponent className="mr-2 h-4 w-4 opacity-50" />
                                      Set Inspection Date...
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleViewRules(subgroup)
                                      }}
                                    >
                                      <AlertTriangle className="mr-2 h-4 w-4" />
                                      View/Manage Rules...
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600 focus:bg-red-100"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setGroupToDelete(subgroupId)
                                        setIsDeleteDialogOpen(true)
                                      }}
                                    >
                                      <Trash className="mr-2 h-4 w-4" />
                                      Delete Subgroup...
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </React.Fragment>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Group Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group: {groups.find((g) => g.id === groupToDelete)?.name || ""}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this group? This action cannot be undone. All sensor assignments will be
              removed. If it's a parent group, its subgroups will become top-level groups.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteGroup} disabled={isDeletingGroup}>
              {isDeletingGroup ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspection Date Dialog */}
      <Dialog open={isInspectionDialogOpen} onOpenChange={setIsInspectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Inspection Date</DialogTitle>
            <DialogDescription>Update the last inspection date for {inspectionGroup?.name}.</DialogDescription>
          </DialogHeader>
          {inspectionGroup && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Group</Label>
                <div className="p-2 bg-muted rounded-md">{inspectionGroup.name}</div>
              </div>

              <div className="space-y-2">
                <Label>Inspection Date</Label>
                <div className="flex justify-center border rounded-md py-3">
                  <CalendarComponent
                    mode="single"
                    selected={
                      inspectionDate ??
                      (inspectionGroup.lastInspection ? new Date(inspectionGroup.lastInspection) : undefined)
                    }
                    onSelect={setInspectionDate}
                    initialFocus
                    defaultMonth={
                      inspectionDate ??
                      (inspectionGroup.lastInspection ? new Date(inspectionGroup.lastInspection) : new Date())
                    }
                    disabled={(date) => date > new Date()}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsInspectionDialogOpen(false)
                setInspectionDate(undefined)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSetInspectionDate} disabled={!inspectionDate}>
              Save Date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Rules Dialog */}
      <Dialog open={isViewRulesDialogOpen} onOpenChange={setIsViewRulesDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Rules for: {rulesGroup?.name}</DialogTitle>
            <DialogDescription>View and manage rules applied to this group.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {rulesGroup && (
              <div className="py-4 space-y-6">
                {/* Applied Rule Sets Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 border-b pb-2">Applied Rule Sets</h3>
                  {(rulesGroup.ruleSets ?? []).length > 0 ? (
                    <div className="space-y-3">
                      {(rulesGroup.ruleSets ?? []).map((ruleSetId) => {
                        const ruleSet = ruleSets.find((rs) => rs.id === ruleSetId)
                        if (!ruleSet) return null
                        const rulesInThisSet = rules.filter((r) => r.ruleSet === ruleSetId)
                        return (
                          <Card key={ruleSetId} className="bg-muted/50">
                            <CardHeader className="p-3 flex flex-row items-center justify-between">
                              <div>
                                <CardTitle className="text-base">{ruleSet.name}</CardTitle>
                                <CardDescription className="text-xs">{ruleSet.description}</CardDescription>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  const updatedRuleSets = (rulesGroup.ruleSets ?? []).filter((id) => id !== ruleSetId)
                                  setGroups((prevGroups) =>
                                    prevGroups.map((g) =>
                                      g.id === rulesGroup.id ? { ...g, ruleSets: updatedRuleSets } : g,
                                    ),
                                  )
                                  setRulesGroup((prev) => (prev ? { ...prev, ruleSets: updatedRuleSets } : null))
                                  toast({
                                    title: "Rule Set Unassigned",
                                    description: `"${ruleSet.name}" unassigned from ${rulesGroup.name}.`,
                                  })
                                }}
                                aria-label={`Unassign rule set ${ruleSet.name}`}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                              <p className="text-xs text-muted-foreground mb-2">
                                {rulesInThisSet.length} rules included:
                              </p>
                              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                                {rulesInThisSet.map((rule) => (
                                  <li key={rule.id} className="flex items-center">
                                    <span className="mr-1">{getRuleTypeIcon(rule.id)}</span> {rule.name}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No rule sets are currently applied to this group.</p>
                  )}
                </div>

                {/* Individually Applied Rules Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 border-b pb-2">Individually Applied Rules</h3>
                  {(() => {
                    const individualRules = (rulesGroup.rules ?? []).filter((ruleId) => {
                      const rule = rules.find((r) => r.id === ruleId)
                      return rule && (!rule.ruleSet || !(rulesGroup.ruleSets ?? []).includes(rule.ruleSet))
                    })

                    if (individualRules.length > 0) {
                      return (
                        <div className="space-y-3">
                          {individualRules.map((ruleId) => {
                            const rule = rules.find((r) => r.id === ruleId)
                            if (!rule) return null

                            return (
                              <Card key={rule.id} className="overflow-hidden">
                                <CardHeader className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <span className="mr-2">{getRuleTypeIcon(rule.id)}</span>
                                      <CardTitle className="text-base">{rule.name}</CardTitle>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleUnassignRule(rulesGroup.id, rule.id)}
                                      aria-label={`Unassign rule ${rule.name}`}
                                    >
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <CardDescription className="text-xs mt-1">{rule.description}</CardDescription>
                                </CardHeader>
                              </Card>
                            )
                          })}
                        </div>
                      )
                    } else {
                      return (
                        <p className="text-sm text-muted-foreground">
                          No individual rules are currently applied (rules might be applied via sets).
                        </p>
                      )
                    }
                  })()}
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs h-auto p-0 mt-2"
                    onClick={() => {
                      setSelectedGroup(rulesGroup?.id || null)
                      setIsAssignRuleDialogOpen(true)
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Assign Individual Rule...
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsViewRulesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Rule Dialog */}
      <Dialog open={isAssignRuleDialogOpen} onOpenChange={setIsAssignRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Individual Rule</DialogTitle>
            <DialogDescription>
              Select an individual rule to assign to {groups.find((g) => g.id === selectedGroup)?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rule-select">Rule</Label>
              <Select onValueChange={setSelectedRule} value={selectedRule || undefined}>
                <SelectTrigger id="rule-select">
                  <SelectValue placeholder="Select a rule" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const group = groups.find((g) => g.id === selectedGroup)
                    const assignableRules = rules.filter((rule) => {
                      if (!group) return true
                      const isAssignedDirectly = (group.rules ?? []).includes(rule.id)
                      const isAssignedViaSet = rule.ruleSet && (group.ruleSets ?? []).includes(rule.ruleSet)
                      return !isAssignedDirectly && !isAssignedViaSet
                    })

                    if (assignableRules.length === 0) {
                      return (
                        <p className="p-2 text-sm text-muted-foreground text-center">
                          No assignable individual rules found.
                        </p>
                      )
                    }

                    return assignableRules.map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {getRuleTypeIcon(rule.id)} {rule.name}
                        {rule.ruleSet
                          ? ` (from: ${ruleSets.find((rs) => rs.id === rule.ruleSet)?.name || "Set"})`
                          : " (Individual)"}
                      </SelectItem>
                    ))
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignRuleDialogOpen(false)
                setSelectedRule(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignRule} disabled={!selectedRule || !selectedGroup || isAssigningRule}>
              {isAssigningRule ? "Assigning..." : "Assign Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
