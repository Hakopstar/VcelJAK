"use client"

import { useState, useEffect, useCallback } from "react"; // useCallback might not be needed here anymore
import { useParams, useRouter } from "next/navigation";
import { useSession, SessionContextValue } from "next-auth/react"; // Import SessionContextValue if needed for typing 'session'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  AlertTriangle,
  Clock,
  Tag,
  Mail,
  Bell,
  MessageSquare,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  CloudRain,
  Heart,
  Layers,
  Activity,
  Zap,
  Calendar,
  PenToolIcon as Tool,
  Search,
  Sprout,
  Snowflake,
  Droplet,
  Beaker,
  Eye,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit,
  Trash,
  Copy,
  Download,
  Upload,
  Loader2,
  RefreshCw,
  X,
  ArrowLeft,
} from "lucide-react"
import { useToast } from "~/hooks/use-toast";
import SensorChart from "./sensor-chart";
import {
  fetchGroupById,
  fetchGroupSensors,
  fetchSubgroups,
  fetchGroupEvents,
  fetchGroupRules,
  fetchConnectedGroups,
} from "../apis-detail";

import {
    fetchTags
} from "../apis"

import type { Group, Sensor, Rule, Event } from "../../types"; // Make sure paths are correct
import type { Session } from "next-auth"; // Import Session type

// Define AppSession if not globally available (match apis-detail.ts)
interface AppSession extends Session {
  accessToken?: string;
  csrfToken?: string;
}
const conditionOperators = [
  { id: "gt", name: "Greater Than", symbol: ">", description: "Value is greater than threshold" },
  { id: "lt", name: "Less Than", symbol: "<", description: "Value is less than threshold" },
  { id: "eq", name: "Equal To", symbol: "=", description: "Value is equal to threshold" },
  {
    id: "gte",
    name: "Greater Than or Equal",
    symbol: ">=",
    description: "Value is greater than or equal to threshold",
  },
  { id: "lte", name: "Less Than or Equal", symbol: "<=", description: "Value is less than or equal to threshold" },
  { id: "neq", name: "Not Equal", symbol: "!=", description: "Value is not equal to threshold" },
  { id: "between", name: "Between", symbol: "><", description: "Value is between two thresholds" },
  { id: "change", name: "Change", symbol: "Δ", description: "Value changes by threshold amount" },
]

// Logical operators
const logicalOperators = [
  { id: "and", name: "AND", description: "All conditions must be met" },
  { id: "or", name: "OR", description: "At least one condition must be met" },
]

const initiatorTypes = [
  { id: "temp", name: "Temperature", unit: "°C", icon: Thermometer, type: "measurement" },
  { id: "hum", name: "Humidity", unit: "%", icon: Droplets, type: "measurement" },
  { id: "sound", name: "Sound Activity", unit: "dB", icon: Bell, type: "measurement" },
  { id: "lux", name: "Light Level", unit: "lux", icon: Sun, type: "measurement" },
  { id: "rain", name: "Rain Detection", unit: "mm", icon: CloudRain, type: "measurement" },
  { id: "weight", name: "Weight", unit: "kg", icon: Layers, type: "measurement" },
  { id: "wind", name: "Wind Speed", unit: "m/s", icon: Wind, type: "measurement" },
  { id: "activity", name: "Bee Activity", unit: "count", icon: Activity, type: "measurement" },
  { id: "battery", name: "Battery Voltage", unit: "V", icon: Zap, type: "measurement" },
  { id: "tag", name: "Tag Status", unit: "", icon: Tag, type: "tag" },
  { id: "time", name: "Time Schedule", unit: "", icon: Clock, type: "schedule" },
  { id: "date", name: "Date", unit: "", icon: Calendar, type: "schedule" },
]

const formatCondition = (initiator, tags) => {
  const initiatorType = initiatorTypes.find((i) => i.id === initiator.type)
  if (!initiatorType) return "Invalid condition"

  if (initiatorType.type === "schedule") {
    return `${initiator.scheduleType}: ${initiator.scheduleValue}`
  }

  if (initiatorType.type === "tag") {
    const tagNames = (initiator.tags || [])
      .map((tagId) => {
        const tag = tags.find((t) => t.id === tagId)
        return tag ? tag.name : "Unknown"
      })
      .join(", ")
    return `Has tags: ${tagNames || "None"}`
  }

  const operator = conditionOperators.find((o) => o.id === initiator.operator)
  if (!operator) return "Invalid condition"

  if (initiator.operator === "between" && initiator.value2 !== null) {
    return `${initiatorType.name} ${initiator.value} - ${initiator.value2} ${initiatorType.unit}`
  }

  return `${initiatorType.name} ${operator.symbol} ${initiator.value} ${initiatorType.unit}`
}

const formatAllConditions = (rule, tags) => {
  if (rule.initiators.length === 1) {
    return formatCondition(rule.initiators[0], tags)
  }

  const conditions = rule.initiators.map((initiator) => formatCondition(initiator, tags))
  const operator = rule.logicalOperator === "and" ? "AND" : "OR"

  return conditions.join(` ${operator} `)
}

// Add a helper function to get tag rule overrides


export default function GroupDetailPage() {
  const { data: session, status }: { data: AppSession | null; status: SessionContextValue['status'] } = useSession();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast(); // Get toast function

  const [group, setGroup] = useState<Group | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [subgroups, setSubgroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [connectedGroups, setConnectedGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true); // *** USE THIS for loading state ***
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<[]>([]);

    // Extract groupId safely
  const groupId = typeof params.id === 'string' ? params.id : null;
  useEffect(() => {
    // Log status and groupId whenever effect runs
    console.log("Group Detail Effect - Status:", status, "GroupId:", groupId);

    // *** MODIFIED FUNCTION TO FETCH SEQUENTIALLY ***
    async function fetchDataSequentially(currentSession: AppSession) {
      if (!groupId) {
        console.error("FetchData called without groupId, should not happen based on outer check.");
        setError("Group ID is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true); // Set loading true at the start
      setError(null); // Clear previous errors

      console.log("Fetching data sequentially for group:", groupId);

      try {
        // --- Fetch data one by one ---

        console.log("Fetching Group Detail...");
        const groupData = await fetchGroupById(groupId, currentSession);
        console.log("Fetched Group Data:", groupData);
        setGroup(groupData); // Set group state

        console.log("Fetching Group Sensors...");
        const sensorsData = await fetchGroupSensors(groupId, currentSession);
        console.log("Fetched Sensors:", sensorsData);
        setSensors(sensorsData); // Set sensors state

        console.log("Fetching Subgroups...");
        const subgroupsData = await fetchSubgroups(groupId, currentSession);
        console.log("Fetched Subgroups:", subgroupsData);
        setSubgroups(subgroupsData); // Set subgroups state

        console.log("Fetching Group Events...");
        const eventsData = await fetchGroupEvents(groupId, currentSession);
        console.log("Fetched Events:", eventsData);
        setEvents(eventsData); // Set events state

        console.log("Fetching Group Rules...");
        const rulesData = await fetchGroupRules(groupId, currentSession);
        console.log("Fetched Rules:", rulesData);
        setRules(rulesData); 

        console.log("Fetching Tags")
        const tagsData = await fetchTags(currentSession)
        console.log("Fetchig Tags:")

        setTags(tagsData); // Set rules state

        console.log("Fetching Connected Groups...");
        const connectedGroupsData = await fetchConnectedGroups(groupId, currentSession);
        console.log("Fetched Connected Groups:", connectedGroupsData);
        setConnectedGroups(connectedGroupsData); // Set connected groups state

        console.log("All data fetched sequentially and set successfully.");

      } catch (fetchError: any) {
        // This will now catch the error from the specific await call that failed
        console.error("Error during sequential fetch:", fetchError);
        const errorMessage = fetchError.message || "Failed to load some group data.";
        setError(errorMessage);
        toast({ // Use the toast function
          title: "Error loading details",
          description: errorMessage,
          variant: "destructive",
        });
        // Depending on the error, some state might be set, others not.
        // You might want to clear all related state here for consistency on error:
        // setGroup(null); setSensors([]); setSubgroups([]); setEvents([]); setRules([]); setConnectedGroups([]);
      } finally {
        console.log("Setting isLoading to false (sequential fetch).");
        setIsLoading(false); // Ensure loading is set to false
      }
    }

    // --- Conditions to fetch data (remain the same) ---
    if (status === "authenticated" && session && groupId) {
      console.log("Status authenticated, calling sequential fetch.");
      fetchDataSequentially(session); // Call the sequential function
    } else if (status === "unauthenticated") {
       console.log("Status is unauthenticated.");
       setError("Please log in to view group details.");
       setIsLoading(false);
       // Clear data
       setGroup(null); setSensors([]); setSubgroups([]); setEvents([]); setRules([]); setConnectedGroups([]);
    } else if (status === "loading") {
       console.log("Session status is loading...");
    } else if (!groupId && status !== "loading") {
       console.log("No groupId found, but status is not loading.");
       setError("Group ID is missing or invalid.");
       setIsLoading(false);
       setGroup(null); setSensors([]); setSubgroups([]); setEvents([]); setRules([]); setConnectedGroups([]);
    }

    // Dependencies remain the same
  }, [groupId, status, session, toast]);

 
  const getTagName = (tagId: string): string => {
    // Find the tag object in the 'allTags' array
    // whose 'id' property matches the provided 'tagId'.
    const tag = tags.find(t => t.id === tagId);
  
    // If a tag object was found, return its 'name'.
    // Otherwise, return the original 'tagId'.
    return tag ? tag.name : tagId;
  };




  const getTagBadgeVariant = (tagId: string) => {
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

  const getHealthColor = (health: number) => {
    if (health >= 80) return "text-emerald-500"
    if (health >= 60) return "text-amber-500"
    if (health >= 40) return "text-orange-500"
    return "text-red-500"
  }

  const getHealthTextColor = (health: number) => {
    if (health >= 80) return "text-emerald-500"
    if (health >= 60) return "text-amber-500"
    if (health >= 40) return "text-orange-500"
    return "text-red-500"
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading group details...</p>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Button variant="outline" onClick={() => router.push("/admin/groups")} className="mr-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Groups
          </Button>
          <h1 className="text-3xl font-bold">Group Not Found</h1>
        </div>
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <p className="text-muted-foreground">The requested group could not be found.</p>
              <Button onClick={() => router.push("/admin/groups")} className="mt-4">
                Return to Group Management
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button variant="outline" onClick={() => router.push("/admin/groups")} className="mr-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Groups
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <span className="mr-2">{getGroupTypeIcon(group.type)}</span>
            {group.name}
          </h1>
          <p className="text-muted-foreground">{group.location}</p>
        </div>
      </div>

      {group.type === "beehive" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                  <p>{group.description || "No description provided."}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Beehive Type</h3>
                  <p>{group.beehiveType}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Last Inspection</h3>
                  <p>{group.lastInspection || "Never"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Tags</h3>
                  <div className="flex flex-wrap gap-1">
                    {group.tags?.map((tagId) => (
                      <Badge key={tagId} variant={getTagBadgeVariant(tagId)}>
                        {getTagName(tagId)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Connected Groups</h3>
                {connectedGroups.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {connectedGroups.map((connectedGroup) => (
                      <Badge key={connectedGroup.id} variant="outline" className="flex items-center">
                        <span className="mr-1">{getGroupTypeIcon(connectedGroup.type)}</span>
                        {connectedGroup.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No connected groups</p>
                )}
              </div>
              
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Health Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle
                      className="text-muted/30 stroke-current"
                      strokeWidth="10"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                    />
                    <circle
                      className={`${getHealthColor(group.health || 0)} stroke-current`}
                      strokeWidth="10"
                      strokeLinecap="round"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      strokeDasharray={`${(2 * Math.PI * 40 * (group.health || 0)) / 100} ${2 * Math.PI * 40 * (1 - (group.health || 0) / 100)}`}
                      strokeDashoffset={2 * Math.PI * 40 * 0.25}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-3xl font-bold ${getHealthTextColor(group.health || 0)}`}>
                      {group.health || 0}%
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Overall health status</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {group.type === "hive" && (
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                <p>{group.description || "No description provided."}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Parent Beehive</h3>
                {group.parentId ? (
                  <Badge variant="outline" className="flex items-center">
                    <span className="mr-1">🐝</span>
                    {/* We would fetch the parent group name from the API in a real implementation */}
                    {group.parentId}
                  </Badge>
                ) : (
                  <p className="text-sm text-muted-foreground">No parent beehive</p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Tags</h3>
                <div className="flex flex-wrap gap-1">
                  {group.tags?.map((tagId) => (
                    <Badge key={tagId} variant={getTagBadgeVariant(tagId)}>
                      {getTagName(tagId)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {group.type === "meteostation" && (
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                <p>{group.description || "No description provided."}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Location</h3>
                <p>{group.location}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="sensors" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sensors">Sensors</TabsTrigger>
          {group.type === "beehive" && <TabsTrigger value="hives">Hives</TabsTrigger>}
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="sensors" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Sensors</CardTitle>
              <CardDescription>Sensors currently assigned to this group</CardDescription>
            </CardHeader>
            <CardContent>
              {sensors.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sensor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Current Reading</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sensors.map((sensor) => (
                      <TableRow key={sensor.id}>
                        <TableCell className="font-medium">{sensor.name}</TableCell>
                        <TableCell>{sensor.type}</TableCell>
                        <TableCell>
                          {sensor.value ? (
                            <div>
                              <span className="font-medium">
                                {sensor.value}
                              </span>
                              
                            </div>
                          ) : (
                            "No readings"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No sensors assigned to this group.</div>
              )}
            </CardContent>
          </Card>
          {sensors.length > 0 && <SensorChart sensors={sensors} />}
        </TabsContent>

        {group.type === "beehive" && (
          <TabsContent value="hives" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Hives</CardTitle>
                <CardDescription>Subgroups of this beehive</CardDescription>
              </CardHeader>
              <CardContent>
                {subgroups.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Sensors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subgroups.map((subgroup) => (
                        <TableRow
                          key={subgroup.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/admin/groups/${subgroup.id}`)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center">
                              <span className="mr-2">{getGroupTypeIcon(subgroup.type)}</span>
                              {subgroup.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {subgroup.tags
                                ?.filter((tag) => {
                                  const tagObj = tags.find((t) => t.id === tag)
                                  return tagObj?.type === "purpose"
                                })
                                .map((tagId) => (
                                  <Badge key={tagId} variant={getTagBadgeVariant(tagId)}>
                                    {getTagName(tagId)}
                                  </Badge>
                                ))}
                            </div>
                          </TableCell>
                          <TableCell>{subgroup.sensors?.length || 0} sensors</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No hives found for this beehive.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="events" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Event History</CardTitle>
              <CardDescription>Recent events for this group</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>{event.event_date}</TableCell>
                        <TableCell>
                          <Badge variant={event.event_type === "alert" ? "destructive" : "outline"}>{event.event_type}</Badge>
                        </TableCell>
                        <TableCell>{event.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No events recorded for this group.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Applied Rules</CardTitle>
              <CardDescription>Rules currently applied to this group</CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                          {rule.name}
                          <div className="text-xs text-muted-foreground">{rule.description}</div>
                        </TableCell>
                        <TableCell>
                          <code className="bg-muted px-1 py-0.5 rounded text-sm">{formatAllConditions(rule, tags)}</code>
                        </TableCell>
                        <TableCell>
                          <Badge>{rule.priority}</Badge>
                        </TableCell>
                        <TableCell>{rule.action}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No rules applied to this group.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
