"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
} from "lucide-react"
import { useToast } from "~/hooks/use-toast"

import { Button } from "~/components/ui/button"
import { Switch } from "~/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Alert, AlertDescription } from "~/components/ui/alert"

import {
  fetchRules,
  fetchRuleSets,
  fetchTags,
  fetchGroups,
  createRule,
  updateRule,
  deleteRule,
  createRuleSet,
  updateRuleSet,
  deleteRuleSet,
  type Rule,
  type RuleSet,
  type Tag as TagType,
  type Group,
} from "./apis"

// Schedule categories
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import { Checkbox } from "~/components/ui/checkbox"
import { Label } from "~/components/ui/label"
import { Slider } from "~/components/ui/slider"
import { useSession } from "next-auth/react"

// Schedule categories
const scheduleCategories = [
  {
    id: "spring-expansion",
    name: "Spring Expansion",
    description: "Prepare for colony growth and add supers",
    icon: Sprout,
    color: "bg-green-500",
    textColor: "text-green-500",
    borderColor: "border-green-500",
    lightBg: "bg-green-50",
    season: "spring",
  },
  {
    id: "summer-extraction",
    name: "Summer Extraction",
    description: "Harvest honey from productive hives",
    icon: Droplet,
    color: "bg-amber-500",
    textColor: "text-amber-500",
    borderColor: "border-amber-500",
    lightBg: "bg-amber-50",
    season: "summer",
  },
  {
    id: "curing-treatment",
    name: "Curing & Treatment",
    description: "Treat for pests and diseases, cure honey",
    icon: Beaker,
    color: "bg-blue-500",
    textColor: "text-blue-500",
    borderColor: "border-blue-500",
    lightBg: "bg-blue-50",
    season: "summer",
  },
  {
    id: "winter-preparation",
    name: "Winter Preparation",
    description: "Prepare hives for cold weather",
    icon: Snowflake,
    color: "bg-slate-500",
    textColor: "text-slate-500",
    borderColor: "border-slate-500",
    lightBg: "bg-slate-50",
    season: "fall",
  },
  {
    id: "inspection",
    name: "Inspection",
    description: "Regular hive inspection and maintenance",
    icon: Eye,
    color: "bg-purple-500",
    textColor: "text-purple-500",
    borderColor: "border-purple-500",
    lightBg: "bg-purple-50",
    season: "all",
  },
  {
    id: "treatment",
    name: "Treatment",
    description: "Disease and pest treatment",
    icon: AlertTriangle,
    color: "bg-red-500",
    textColor: "text-red-500",
    borderColor: "border-red-500",
    lightBg: "bg-red-50",
    season: "all",
  },
  {
    id: "other",
    name: "Other",
    description: "Other beekeeping activities",
    icon: Calendar,
    color: "bg-gray-500",
    textColor: "text-gray-500",
    borderColor: "border-gray-500",
    lightBg: "bg-gray-50",
    season: "all",
  },
]

// Initiator types
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
  { id: "schedule", name: "Schedule", unit: "", icon: Clock, type: "schedule" },
]

// Action types
const actionTypes = [
  { id: "alert", name: "Send Alert", icon: AlertTriangle, description: "Send an alert notification" },
  { id: "email", name: "Send Email", icon: Mail, description: "Send an email notification" },
  { id: "tip", name: "Send Tip", icon: MessageSquare, description: "Send a tip notification" },
  {
    id: "health",
    name: "Adjust Health",
    icon: Heart,
    description: "Adjust the health score of the group (dynamic or static)",
  },
  { id: "tag", name: "Apply Tag", icon: Tag, description: "Apply a tag to the group" },
  { id: "schedule", name: "Create Schedule", icon: Calendar, description: "Schedule an event or task" },
  { id: "maintenance", name: "Schedule Maintenance", icon: Tool, description: "Schedule maintenance for the group" },
  {
    id: "inspection",
    name: "Schedule Inspection",
    icon: Search,
    description: "Schedule an inspection for the group",
  },
  {
    id: "progress",
    name: "Update Schedule Progress",
    icon: Calendar,
    description: "Update the progress of an existing schedule based on measurements",
  },
]

// Condition operators
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

// Text templates
const textTemplates = [
  {
    id: "temp_low",
    name: "Low Temperature",
    text: "Temperature in {group} is low ({value}°C). This may affect bee activity and health.",
    condition: "temp_lt",
  },
  {
    id: "temp_high",
    name: "High Temperature",
    text: "Temperature in {group} is high ({value}°C). Ventilation may be needed.",
    condition: "temp_gt",
  },
  {
    id: "hum_low",
    name: "Low Humidity",
    text: "Humidity in {group} is low ({value}%). Consider adding a water source nearby.",
    condition: "hum_lt",
  },
  {
    id: "hum_high",
    name: "High Humidity",
    text: "Humidity in {group} is high ({value}%). Check for proper ventilation.",
    condition: "hum_gt",
  },
  {
    id: "weight_low",
    name: "Low Weight",
    text: "Weight of {group} is low ({value}kg). Bees may need feeding.",
    condition: "weight_lt",
  },
  {
    id: "weight_high",
    name: "High Weight",
    text: "Weight of {group} is high ({value}kg). Honey may be ready for harvesting.",
    condition: "weight_gt",
  },
  {
    id: "activity_low",
    name: "Low Activity",
    text: "Bee activity in {group} is low ({value}). Check for issues.",
    condition: "activity_lt",
  },
  {
    id: "activity_high",
    name: "High Activity",
    text: "Bee activity in {group} is high ({value}). This is a good sign of colony health.",
    condition: "activity_gt",
  },
  {
    id: "inspection_due",
    name: "Inspection Due",
    text: "Scheduled inspection for {group} is due today.",
    condition: "schedule",
  },
  {
    id: "treatment_due",
    name: "Treatment Due",
    text: "Scheduled treatment for {group} is due today.",
    condition: "schedule",
  },
]



const convertTimeToUTC = (timeString) => {
  console.log("1Timestring:")
  console.log(timeString)
  if (!timeString) {
    console.warn("convertTimeToUTC: timeString is empty, returning as is.");
    return timeString;
  }

  // 1. Parse the input time string (HH:MM)
  const timeParts = timeString.split(":");
  if (timeParts.length !== 2) {
    console.error(`convertTimeToUTC: Invalid timeString format "${timeString}". Expected HH:MM.`);
    return "Invalid Time Format";
  }

  const inputHours = parseInt(timeParts[0], 10);
  const inputMinutes = parseInt(timeParts[1], 10);

  if (isNaN(inputHours) || isNaN(inputMinutes) ||
      inputHours < 0 || inputHours > 23 ||
      inputMinutes < 0 || inputMinutes > 59) {
    console.error(`convertTimeToUTC: Invalid time values in "${timeString}".`);
    return "Invalid Time Values";
  }

  // 2. Create a Date object with the current date and the parsed time (in browser's local timezone)
  const localDate = new Date(); // Gets current date and time in local timezone
  localDate.setHours(inputHours);
  localDate.setMinutes(inputMinutes);
  localDate.setSeconds(0); // Explicitly set seconds to 0
  localDate.setMilliseconds(0); // Explicitly set milliseconds to 0

  // 3. Get the UTC hours and minutes from this date object
  const hoursUTC = localDate.getUTCHours();
  const minutesUTC = localDate.getUTCMinutes();

  // 4. Format the UTC time string
  // Pad with leading zero if necessary
  const formattedHoursUTC = String(hoursUTC).padStart(2, '0');
  const formattedMinutesUTC = String(minutesUTC).padStart(2, '0');
  console.log("Formatted:")
  console.log(timeString)
  return `${formattedHoursUTC}:${formattedMinutesUTC}`;
};

const convertTimeFromUTC = (utcTimeString) => {
  console.log("2UTC TIME:")
  console.log(utcTimeString)
  if (!utcTimeString) {
    console.warn("convertTimeFromUTC: utcTimeString is empty, returning as is.");
    return utcTimeString;
  }

  // 1. Parse the input UTC time string (HH:MM)
  const timeParts = utcTimeString.split(":");
  if (timeParts.length !== 2) {
    console.error(`convertTimeFromUTC: Invalid utcTimeString format "${utcTimeString}". Expected HH:MM.`);
    return "Invalid Time Format";
  }

  const utcHours = parseInt(timeParts[0], 10);
  const utcMinutes = parseInt(timeParts[1], 10);

  if (isNaN(utcHours) || isNaN(utcMinutes) ||
      utcHours < 0 || utcHours > 23 ||
      utcMinutes < 0 || utcMinutes > 59) {
    console.error(`convertTimeFromUTC: Invalid UTC time values in "${utcTimeString}".`);
    return "Invalid Time Values";
  }

  // 2. Create a Date object for the current date, then set its time component using UTC values.
  // We need to determine the current year, month, and day in UTC to correctly anchor the UTC time.
  const now = new Date(); // We use 'now' to get a basis for a Date object.
                       // The specific date (day, month, year) will affect the conversion if the
                       // local time crosses a date boundary relative to the UTC time.

  // Create a new Date object and set its hours and minutes in UTC.
  // We use the current local date's year, month, and day, but then specify the time components as UTC.
  const dateInUTC = new Date();
  dateInUTC.setUTCHours(utcHours);
  dateInUTC.setUTCMinutes(utcMinutes);
  dateInUTC.setUTCSeconds(0);
  dateInUTC.setUTCMilliseconds(0);

  // 3. Get the local hours and minutes from this date object.
  // The Date object now represents that specific moment in time.
  // .getHours() and .getMinutes() will return them in the browser's local timezone.
  const localHours = dateInUTC.getHours();
  const localMinutes = dateInUTC.getMinutes();

  // 4. Format the local time string
  const formattedLocalHours = String(localHours).padStart(2, '0');
  const formattedLocalMinutes = String(localMinutes).padStart(2, '0');

  console.log("2Converted time:")
  console.log(`${formattedLocalHours}:${formattedLocalMinutes}`)
  return `${formattedLocalHours}:${formattedLocalMinutes}`;
};

const convertScheduleValueToUTC = (scheduleType: string, scheduleValue: string) => {
  if (!scheduleValue || !scheduleType) return scheduleValue

  switch (scheduleType) {
    case "daily":
      return convertTimeToUTC(scheduleValue)

    case "weekly":
    case "monthly":
    case "yearly": {
      const parts = scheduleValue.split(",")
      if (parts.length === 2) {
        const [datePart, timePart] = parts
        const convertedTime = convertTimeToUTC(timePart)
        return `${datePart},${convertedTime}`
      }
      return scheduleValue
    }

    default:
      return scheduleValue
  }
}

const convertScheduleValueFromUTC = (scheduleType: string, scheduleValue: string, userTimezone: string) => {
  if (!scheduleValue || !scheduleType) return scheduleValue

  switch (scheduleType) {
    case "daily":
      return convertTimeFromUTC(scheduleValue, userTimezone)

    case "weekly":
    case "monthly":
    case "yearly": {
      const parts = scheduleValue.split(",")
      if (parts.length === 2) {
        const [datePart, timePart] = parts
        const convertedTime = convertTimeFromUTC(timePart, userTimezone)
        return `${datePart},${convertedTime}`
      }
      return scheduleValue
    }

    default:
      return scheduleValue
  }
}

// Helper function to download JSON
const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([])
  const [tags, setTags] = useState<TagType[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState({
    rules: true,
    ruleSets: true,
    tags: true,
    groups: true,
  })
  const [error, setError] = useState({
    rules: null,
    ruleSets: null,
    tags: null,
    groups: null,
  })

  const [activeTab, setActiveTab] = useState("sets")
  const [expandedRuleSets, setExpandedRuleSets] = useState<Record<string, boolean>>({})
  const [isAddRuleDialogOpen, setIsAddRuleDialogOpen] = useState(false)
  const [isEditRuleDialogOpen, setIsEditRuleDialogOpen] = useState(false)
  const [isDeleteRuleDialogOpen, setIsDeleteRuleDialogOpen] = useState(false)
  const [isAddRuleSetDialogOpen, setIsAddRuleSetDialogOpen] = useState(false)
  const [isEditRuleSetDialogOpen, setIsEditRuleSetDialogOpen] = useState(false)
  const [isDeleteRuleSetDialogOpen, setIsDeleteRuleSetDialogOpen] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null)
  const [ruleSetToDelete, setRuleSetToDelete] = useState<string | null>(null)
  const [ruleSetToEdit, setRuleSetToEdit] = useState<RuleSet | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [totalSteps, setTotalSteps] = useState(5)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [selectedRulesToExport, setSelectedRulesToExport] = useState<Record<string, boolean>>({})
  const [selectedRuleSetsToExport, setSelectedRuleSetsToExport] = useState<Record<string, boolean>>({})
  const [importedData, setImportedData] = useState<{ rules: Rule[]; ruleSets: RuleSet[] } | null>(null)
  const [selectedRulesToImport, setSelectedRulesToImport] = useState<Record<string, boolean>>({})
  const [selectedRuleSetsToImport, setSelectedRuleSetsToImport] = useState<Record<string, boolean>>({})
  const [searchExport, setSearchExport] = useState("")
  const [searchImport, setSearchImport] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const [userTimezone, setUserTimezone] = useState<string>("")

  // New rule state
  const [newRule, setNewRule] = useState<Omit<Rule, "id">>({
    name: "",
    description: "",
    initiators: [
      {
        id: `i${Date.now()}`,
        type: "",
        operator: "",
        value: 0,
        value2: null,
        scheduleType: "daily",
        scheduleValue: "",
        tags: [],
      },
    ],
    logicalOperator: "and",
    action: "",
    actionParams: {
      severity: "medium",
      template: "",
      customMessage: "",
      amount: 0,
      tagId: "",
      scheduleTitle: "",
      scheduleDescription: "",
      scheduleCategory: "",
      scheduleSeason: "",
      schedulePriority: "medium",
      scheduleDate: "",
      scheduleTime: "",
      scheduleId: "",
      targetValue: 0,
      progressType: "linear",
      incrementAmount: 10,
      healthType: "static",
    },
    isActive: true,
    tags: [],
    ruleSet: "none",
    priority: 5,
  })

  const [editRule, setEditRule] = useState<Rule | null>(null)
  const [newRuleSet, setNewRuleSet] = useState<Omit<RuleSet, "id">>({
    name: "",
    description: "",
    isActive: true,
    rules: [],
  })
  useEffect(() => {
    if (status === "authenticated" && session) {
      // Set user timezone
      fetchData()
    }
  }, [status, session])
  // Fetch data on component mount

  // Fetch all required data
  const fetchData = async () => {
    // Reset loading states
    setLoading({
      rules: true,
      ruleSets: true,
      tags: true,
      groups: true,
    })

    // Reset error states
    setError({
      rules: null,
      ruleSets: null,
      tags: null,
      groups: null,
    })

    // Fetch rules
    fetchRules(session)
      .then((data) => {
        // Convert schedule values from UTC for display
        const rulesWithLocalTime = data.map((rule) => ({
          ...rule,
          initiators: rule.initiators.map((initiator) => {
            if (initiatorTypes.find((t) => t.id === initiator.type)?.type === "schedule") {
              return {
                ...initiator,
                scheduleValue: convertScheduleValueFromUTC(
                  initiator.scheduleType,
                  initiator.scheduleValue,
                  userTimezone,
                ),
              }
            }
            return initiator
          }),
        }))

        setRules(rulesWithLocalTime)
        setLoading((prev) => ({ ...prev, rules: false }))
      })
      .catch((err) => {
        setError((prev) => ({ ...prev, rules: err.message }))
        setLoading((prev) => ({ ...prev, rules: false }))
        toast({
          title: "Error fetching rules",
          description: err.message,
          variant: "destructive",
        })
      })

    // Fetch rule sets
    fetchRuleSets(session)
      .then((data) => {
        setRuleSets(data)
        setLoading((prev) => ({ ...prev, ruleSets: false }))
      })
      .catch((err) => {
        setError((prev) => ({ ...prev, ruleSets: err.message }))
        setLoading((prev) => ({ ...prev, ruleSets: false }))
        toast({
          title: "Error fetching rule sets",
          description: err.message,
          variant: "destructive",
        })
      })

    // Fetch tags
    fetchTags(session)
      .then((data) => {
        setTags(data)
        setLoading((prev) => ({ ...prev, tags: false }))
      })
      .catch((err) => {
        setError((prev) => ({ ...prev, tags: err.message }))
        setLoading((prev) => ({ ...prev, tags: false }))
        toast({
          title: "Error fetching tags",
          description: err.message,
          variant: "destructive",
        })
      })

    // Fetch groups
    fetchGroups(session)
      .then((data) => {
        setGroups(data)
        setLoading((prev) => ({ ...prev, groups: false }))
      })
      .catch((err) => {
        setError((prev) => ({ ...prev, groups: err.message }))
        setLoading((prev) => ({ ...prev, groups: false }))
        toast({
          title: "Error fetching groups",
          description: err.message,
          variant: "destructive",
        })
      })
  }

  // Get status tags only
  const statusTags = useMemo(() => {
    return tags.filter((tag) => tag.type === "status")
  }, [tags])

  // Toggle rule set expansion
  const toggleRuleSetExpansion = (ruleSetId: string) => {
    setExpandedRuleSets((prev) => ({
      ...prev,
      [ruleSetId]: !prev[ruleSetId],
    }))
  }

  // Filter rules based on active tab
  const getFilteredRules = () => {
    if (activeTab === "all") return rules
    if (activeTab === "sets") return []
    if (activeTab === "measurement")
      return rules.filter((rule) =>
        rule.initiators.some((i) => initiatorTypes.find((t) => t.id === i.type)?.type === "measurement"),
      )
    if (activeTab === "schedule")
      return rules.filter((rule) =>
        rule.initiators.some((i) => initiatorTypes.find((t) => t.id === i.type)?.type === "schedule"),
      )
    if (activeTab === "tag")
      return rules.filter((rule) =>
        rule.initiators.some((i) => initiatorTypes.find((t) => t.id === i.type)?.type === "tag"),
      )
    return []
  }

  // Get rules for a specific rule set
  const getRulesForRuleSet = (ruleSetId: string) => {
    return rules.filter((rule) => rule.ruleSet === ruleSetId)
  }

  // Update steps based on rule type
  useEffect(() => {
    if (isAddRuleDialogOpen || isEditRuleDialogOpen) {
      setTotalSteps(5)
    }
  }, [isAddRuleDialogOpen, isEditRuleDialogOpen])

  // Handle next step in rule creation/editing
  const handleNextStep = () => {
    // Validate current step
    if (currentStep === 1) {
      const rule = editRule || newRule
      if (!rule.name) {
        toast({
          title: "Missing information",
          description: "Please provide a name for the rule.",
          variant: "destructive",
        })
        return
      }
    }

    if (currentStep === 2) {
      const rule = editRule || newRule
      if (rule.initiators.length === 0) {
        toast({
          title: "Missing information",
          description: "Please add at least one initiator.",
          variant: "destructive",
        })
        return
      }

      // Check if all initiators have required fields
      const invalidInitiators = rule.initiators.filter((initiator) => {
        if (!initiator.type) return true

        const initiatorType = initiatorTypes.find((t) => t.id === initiator.type)?.type

        if (initiatorType === "measurement") {
          return !initiator.operator || (initiator.operator === "between" && initiator.value2 === null)
        }

        if (initiatorType === "tag") {
          return (initiator.tags || []).length === 0
        }

        if (initiatorType === "schedule") {
          return !initiator.scheduleType || !initiator.scheduleValue
        }

        return false
      })

      if (invalidInitiators.length > 0) {
        toast({
          title: "Missing information",
          description: "Please complete all initiator configurations.",
          variant: "destructive",
        })
        return
      }
    }

    if (currentStep === 3) {
      const rule = editRule || newRule
      if (!rule.action) {
        toast({
          title: "Missing information",
          description: "Please select an action.",
          variant: "destructive",
        })
        return
      }
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      // Submit the form
      if (isEditRuleDialogOpen) {
        handleEditRule()
      } else {
        handleAddRule()
      }
    }
  }

  // Handle previous step in rule creation/editing
  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else {
      // Close the dialog
      if (isEditRuleDialogOpen) {
        setIsEditRuleDialogOpen(false)
      } else {
        setIsAddRuleDialogOpen(false)
      }
      resetForm()
    }
  }

  // Reset form state
  const resetForm = () => {
    setCurrentStep(1)
    setNewRule({
      name: "",
      description: "",
      initiators: [
        {
          id: `i${Date.now()}`,
          type: "",
          operator: "",
          value: 0,
          value2: null,
          scheduleType: "daily",
          scheduleValue: "",
          tags: [],
        },
      ],
      logicalOperator: "and",
      action: "",
      actionParams: {
        severity: "medium",
        template: "",
        customMessage: "",
        amount: 0,
        tagId: "",
        scheduleTitle: "",
        scheduleDescription: "",
        scheduleCategory: "",
        scheduleSeason: "",
        schedulePriority: "medium",
        scheduleDate: "",
        scheduleTime: "",
        scheduleId: "",
        targetValue: 0,
        progressType: "linear",
        incrementAmount: 10,
        healthType: "static",
      },
      isActive: true,
      tags: [],
      ruleSet: "none",
      priority: 5,
    })
    setEditRule(null)
    setSelectedDate(new Date())
  }

  // Add a new initiator to the rule
  const addInitiator = () => {
    const newInitiator = {
      id: `i${Date.now()}`,
      type: "",
      operator: "",
      value: 0,
      value2: null,
      scheduleType: "daily",
      scheduleValue: "",
      tags: [] as string[],
    }

    if (editRule) {
      setEditRule({
        ...editRule,
        initiators: [...editRule.initiators, newInitiator],
      })
    } else {
      setNewRule({
        ...newRule,
        initiators: [...newRule.initiators, newInitiator],
      })
    }
  }

  // Remove an initiator from the rule
  const removeInitiator = (initiatorId: string) => {
    if (editRule) {
      // Don't remove if it's the only initiator
      if (editRule.initiators.length <= 1) {
        toast({
          title: "Cannot remove",
          description: "A rule must have at least one initiator.",
          variant: "destructive",
        })
        return
      }

      setEditRule({
        ...editRule,
        initiators: editRule.initiators.filter((i) => i.id !== initiatorId),
      })
    } else {
      // Don't remove if it's the only initiator
      if (newRule.initiators.length <= 1) {
        toast({
          title: "Cannot remove",
          description: "A rule must have at least one initiator.",
          variant: "destructive",
        })
        return
      }

      setNewRule({
        ...newRule,
        initiators: newRule.initiators.filter((i) => i.id !== initiatorId),
      })
    }
  }

  // Update an initiator
  const updateInitiator = (initiatorId: string, field: string, value: any) => {
    if (editRule) {
      const updatedInitiators = editRule.initiators.map((initiator) => {
        if (initiator.id === initiatorId) {
          return { ...initiator, [field]: value }
        }
        return initiator
      })

      setEditRule({
        ...editRule,
        initiators: updatedInitiators,
      })
    } else {
      const updatedInitiators = newRule.initiators.map((initiator) => {
        if (initiator.id === initiatorId) {
          return { ...initiator, [field]: value }
        }
        return initiator
      })

      setNewRule({
        ...newRule,
        initiators: updatedInitiators,
      })
    }
  }

  // Handle tag selection for an initiator
  const handleInitiatorTagSelection = (initiatorId: string, tagId: string, isAdding: boolean) => {
    if (editRule) {
      const updatedInitiators = editRule.initiators.map((initiator) => {
        if (initiator.id === initiatorId) {
          const currentTags = initiator.tags || []
          const newTags = isAdding ? [...currentTags, tagId] : currentTags.filter((id) => id !== tagId)

          return { ...initiator, tags: newTags }
        }
        return initiator
      })

      setEditRule({
        ...editRule,
        initiators: updatedInitiators,
      })
    } else {
      const updatedInitiators = newRule.initiators.map((initiator) => {
        if (initiator.id === initiatorId) {
          const currentTags = initiator.tags || []
          const newTags = isAdding ? [...currentTags, tagId] : currentTags.filter((id) => id !== tagId)

          return { ...initiator, tags: newTags }
        }
        return initiator
      })

      setNewRule({
        ...newRule,
        initiators: updatedInitiators,
      })
    }
  }

  // Add a new rule
  const handleAddRule = async () => {
    if (!newRule.name || !newRule.action || newRule.initiators.length === 0) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    try {
      // Convert schedule values to UTC before sending
      const ruleToSend = {
        ...newRule,
        initiators: newRule.initiators.map((initiator) => {
          if (initiatorTypes.find((t) => t.id === initiator.type)?.type === "schedule") {
            return {
              ...initiator,
              scheduleValue: convertScheduleValueToUTC(initiator.scheduleType, initiator.scheduleValue),
            }
          }
          return initiator
        }),
      }

      const createdRule = await createRule(ruleToSend, session)

      // Convert schedule values back from UTC for display
      const displayRule = {
        ...createdRule,
        initiators: createdRule.initiators.map((initiator) => {
          if (initiatorTypes.find((t) => t.id === initiator.type)?.type === "schedule") {
            return {
              ...initiator,
              scheduleValue: initiator.scheduleValue,
            }
          }
          return initiator
        }),
      }

      setRules([...rules, displayRule])
      setIsAddRuleDialogOpen(false)
      resetForm()

      toast({
        title: "Rule added",
        description: `${newRule.name} has been added successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error adding rule",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Handle editing a rule
  const handleEditRule = async () => {
    if (!editRule || !editRule.name || !editRule.action || editRule.initiators.length === 0) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    try {
      // Convert schedule values to UTC before sending
      const ruleToSend = {
        ...editRule,
        initiators: editRule.initiators.map((initiator) => {
          if (initiatorTypes.find((t) => t.id === initiator.type)?.type === "schedule") {
            return {
              ...initiator,
              scheduleValue: convertScheduleValueToUTC(initiator.scheduleType, initiator.scheduleValue),
            }
          }
          return initiator
        }),
      }

      const updatedRule = await updateRule(editRule.id, ruleToSend, session)

      // Convert schedule values back from UTC for display
      const displayRule = {
        ...updatedRule,
        initiators: updatedRule.initiators.map((initiator) => {
          if (initiatorTypes.find((t) => t.id === initiator.type)?.type === "schedule") {
            return {
              ...initiator,
              scheduleValue: initiator.scheduleValue,
            }
          }
          return initiator
        }),
      }

      setRules(rules.map((rule) => (rule.id === editRule.id ? displayRule : rule)))
      setIsEditRuleDialogOpen(false)
      resetForm()

      toast({
        title: "Rule updated",
        description: `${editRule.name} has been updated successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error updating rule",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Handle deleting a rule
  const handleDeleteRule = async () => {
    if (!ruleToDelete) return

    try {
      await deleteRule(ruleToDelete, session)
      setRules(rules.filter((rule) => rule.id !== ruleToDelete))
      setIsDeleteRuleDialogOpen(false)

      toast({
        title: "Rule deleted",
        description: "The rule has been deleted successfully.",
      })
    } catch (error) {
      toast({
        title: "Error deleting rule",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Handle adding a new rule set
  const handleAddRuleSet = async () => {
    if (!newRuleSet.name) {
      toast({
        title: "Missing information",
        description: "Please provide a name for the rule set.",
        variant: "destructive",
      })
      return
    }

    try {
      const createdRuleSet = await createRuleSet(newRuleSet, session)
      setRuleSets([...ruleSets, createdRuleSet])
      setIsAddRuleSetDialogOpen(false)
      setNewRuleSet({
        name: "",
        description: "",
        isActive: true,
        rules: [],
      })

      toast({
        title: "Rule set added",
        description: `${newRuleSet.name} has been added successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error adding rule set",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Handle editing a rule set
  const handleEditRuleSet = async () => {
    if (!ruleSetToEdit || !ruleSetToEdit.name) {
      toast({
        title: "Missing information",
        description: "Please provide a name for the rule set.",
        variant: "destructive",
      })
      return
    }

    try {
      const updatedRuleSet = await updateRuleSet(ruleSetToEdit.id, ruleSetToEdit, session)
      setRuleSets(ruleSets.map((ruleSet) => (ruleSet.id === ruleSetToEdit.id ? updatedRuleSet : ruleSet)))
      setIsEditRuleSetDialogOpen(false)

      toast({
        title: "Rule set updated",
        description: `${ruleSetToEdit.name} has been updated successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error updating rule set",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Handle deleting a rule set
  const handleDeleteRuleSet = async () => {
    if (!ruleSetToDelete) return

    try {
      await deleteRuleSet(ruleSetToDelete, session)

      // Update rules that were in this rule set
      const updatedRules = await Promise.all(
        rules
          .filter((rule) => rule.ruleSet === ruleSetToDelete)
          .map(async (rule) => {
            const updatedRule = { ...rule, ruleSet: "none" }
            await updateRule(rule.id, updatedRule, session)
            return updatedRule
          }),
      )

      // Update local state
      setRules(rules.map((rule) => (rule.ruleSet === ruleSetToDelete ? { ...rule, ruleSet: "none" } : rule)))

      setRuleSets(ruleSets.filter((ruleSet) => ruleSet.id !== ruleSetToDelete))
      setIsDeleteRuleSetDialogOpen(false)

      toast({
        title: "Rule set deleted",
        description: "The rule set has been deleted successfully.",
      })
    } catch (error) {
      toast({
        title: "Error deleting rule set",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Toggle rule activation
  const toggleRuleActivation = async (ruleId: string) => {
    const ruleToToggle = rules.find((rule) => rule.id === ruleId)
    if (!ruleToToggle) return

    try {
      const updatedRule = { ...ruleToToggle, isActive: !ruleToToggle.isActive }
      await updateRule(ruleId, updatedRule, session)

      setRules(
        rules.map((rule) => {
          if (rule.id === ruleId) {
            return { ...rule, isActive: !rule.isActive }
          }
          return rule
        }),
      )

      toast({
        title: `Rule ${updatedRule.isActive ? "activated" : "deactivated"}`,
        description: `${ruleToToggle.name} has been ${updatedRule.isActive ? "activated" : "deactivated"}.`,
      })
    } catch (error) {
      toast({
        title: "Error updating rule",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Toggle rule set activation
  const toggleRuleSetActivation = async (ruleSetId: string) => {
    const ruleSetToToggle = ruleSets.find((ruleSet) => ruleSet.id === ruleSetId)
    if (!ruleSetToToggle) return

    try {
      const updatedRuleSet = { ...ruleSetToToggle, isActive: !ruleSetToToggle.isActive }
      await updateRuleSet(ruleSetId, updatedRuleSet, session)

      setRuleSets(
        ruleSets.map((ruleSet) => {
          if (ruleSet.id === ruleSetId) {
            return { ...ruleSet, isActive: !ruleSet.isActive }
          }
          return ruleSet
        }),
      )

      toast({
        title: `Rule set ${updatedRuleSet.isActive ? "activated" : "deactivated"}`,
        description: `${ruleSetToToggle.name} has been ${updatedRuleSet.isActive ? "activated" : "deactivated"}.`,
      })
    } catch (error) {
      toast({
        title: "Error updating rule set",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Get initiator icon
  const getInitiatorIcon = (type) => {
    const initiator = initiatorTypes.find((i) => i.id === type)
    if (!initiator) return null

    const Icon = initiator.icon
    return <Icon className="h-4 w-4 mr-2" />
  }

  // Get initiator type icon
  const getInitiatorTypeIcon = (initiatorId) => {
    const initiator = initiatorTypes.find((i) => i.id === initiatorId)
    if (!initiator) return null

    const Icon = initiator.icon
    return <Icon className="h-4 w-4 mr-2" />
  }

  // Get initiator type badge variant
  const getInitiatorTypeBadgeVariant = (initiatorId) => {
    const initiator = initiatorTypes.find((i) => i.id === initiatorId)
    if (!initiator) return "outline"

    switch (initiator.type) {
      case "measurement":
        return "default"
      case "schedule":
        return "secondary"
      case "tag":
        return "outline"
      default:
        return "outline"
    }
  }

  // Get action type icon
  const getActionTypeIcon = (type: string) => {
    const action = actionTypes.find((a) => a.id === type)
    if (!action) return null

    const Icon = action.icon
    return <Icon className="h-4 w-4 mr-2" />
  }

  // Format condition
  const formatCondition = (initiator) => {
    const initiatorType = initiatorTypes.find((i) => i.id === initiator.type)
    if (!initiatorType) return "Invalid condition"

    if (initiatorType.type === "schedule") {
      const scheduleValue = initiator.scheduleValue || ""

      if (initiator.scheduleType === "daily") {
        return `Daily at ${scheduleValue}`
      } else if (initiator.scheduleType === "weekly") {
        const [day, time] = scheduleValue.split(",")
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        const dayName = dayNames[Number.parseInt(day)] || "Unknown"
        return `Weekly on ${dayName} at ${time}`
      } else if (initiator.scheduleType === "monthly") {
        const [day, time] = scheduleValue.split(",")
        return `Monthly on day ${day} at ${time}`
      } else if (initiator.scheduleType === "yearly") {
        const [dayMonth, time] = scheduleValue.split(",")
        return `Yearly on ${dayMonth} at ${time}`
      }

      return `${initiator.scheduleType}: ${scheduleValue}`
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

  // Format all conditions for a rule
  const formatAllConditions = (rule) => {
    if (rule.initiators.length === 1) {
      return formatCondition(rule.initiators[0])
    }

    const conditions = rule.initiators.map((initiator) => formatCondition(initiator))
    const operator = rule.logicalOperator === "and" ? "AND" : "OR"

    return conditions.join(` ${operator} `)
  }

  // Format action for display
  const formatAction = (rule: Rule) => {
    const action = actionTypes.find((a) => a.id === rule.action)
    if (!action) return "Invalid action"

    switch (rule.action) {
      case "alert":
      case "email":
      case "tip":
        return `${action.name} (${rule.actionParams.severity || "medium"})`
      case "health":
        const amount = rule.actionParams.amount || 0
        const type = rule.actionParams.healthType || "static"
        return `${action.name} (${type}: ${amount > 0 ? "+" : ""}${amount}%)`
      case "tag":
        const tagId = rule.actionParams.tagId
        const tag = tags.find((t) => t.id === tagId)
        return `${action.name} (${tag ? tag.name : "Unknown"})`
      case "schedule":
      case "maintenance":
      case "inspection":
        return `${action.name} (${rule.actionParams.scheduleTitle || "Untitled"})`
      case "progress":
        return `${action.name} (${rule.actionParams.scheduleId ? "Schedule: " + rule.actionParams.scheduleId : "No schedule selected"})`
      default:
        return action.name
    }
  }

  // Handle tag selection for tagged groups

  // Get template text for a given template ID
  const getTemplateText = (templateId: string) => {
    const template = textTemplates.find((t) => t.id === templateId)
    return template ? template.text : ""
  }

  // Get filtered templates based on measurement type
  const getFilteredTemplates = (initiatorType: string) => {
    return textTemplates.filter((template) => {
      if (!initiatorType) return true
      return template.condition.startsWith(initiatorType)
    })
  }

  // Get schedule category icon
  const getScheduleCategoryIcon = (categoryId: string) => {
    const category = scheduleCategories.find((c) => c.id === categoryId)
    if (!category) return <Calendar className="h-4 w-4 mr-2" />

    const Icon = category.icon
    return <Icon className="h-4 w-4 mr-2" />
  }

  // Handle export rules
  const handleExportRules = () => {
    setSelectedRulesToExport(
      rules.reduce((acc, rule) => {
        acc[rule.id] = true
        return acc
      }, {}),
    )
    setSelectedRuleSetsToExport(
      ruleSets.reduce((acc, ruleSet) => {
        acc[ruleSet.id] = true
        return acc
      }, {}),
    )
    setIsExportDialogOpen(true)
  }

  // Execute export
  const executeExport = () => {
    const selectedRules = rules.filter((rule) => selectedRulesToExport[rule.id])
    const selectedRuleSets = ruleSets.filter((ruleSet) => selectedRuleSetsToExport[ruleSet.id])

    const exportData = {
      rules: selectedRules,
      ruleSets: selectedRuleSets,
      version: "1.0",
      exportDate: new Date().toISOString(),
    }

    downloadJson(exportData, `group-rules-${new Date().toISOString().split("T")[0]}.json`)

    toast({
      title: "Rules exported",
      description: `${selectedRules.length} rules and ${selectedRuleSets.length} rule sets exported successfully.`,
    })

    setIsExportDialogOpen(false)
  }

  // Handle import rules
  const handleImportRules = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)

        // Validate the imported data
        if (!data.rules || !Array.isArray(data.rules)) {
          throw new Error("Invalid rules data format")
        }

        if (!data.ruleSets || !Array.isArray(data.ruleSets)) {
          throw new Error("Invalid rule sets data format")
        }

        // Store the imported data and open the selection dialog
        setImportedData(data)

        // Initialize all rules and rule sets as selected
        setSelectedRulesToImport(
          data.rules.reduce((acc, rule) => {
            acc[rule.id] = true
            return acc
          }, {}),
        )

        setSelectedRuleSetsToImport(
          data.ruleSets.reduce((acc, ruleSet) => {
            acc[ruleSet.id] = true
            return acc
          }, {}),
        )

        setIsImportDialogOpen(true)
      } catch (error) {
        toast({
          title: "Import failed",
          description: `Failed to import rules: ${error.message}`,
          variant: "destructive",
        })
      }
    }

    reader.readAsText(file)

    // Reset the file input
    if (event.target) {
      event.target.value = ""
    }
  }

  // Execute import
  const executeImport = async () => {
    if (!importedData) return

    try {
      const selectedRules = importedData.rules.filter((rule) => selectedRulesToImport[rule.id])
      const selectedRuleSets = importedData.ruleSets.filter((ruleSet) => selectedRuleSetsToImport[ruleSet.id])

      // Check for ID conflicts and generate new IDs if needed
      const existingRuleIds = new Set(rules.map((r) => r.id))
      const existingRuleSetIds = new Set(ruleSets.map((rs) => rs.id))

      // First import rule sets
      const importedRuleSets = await Promise.all(
        selectedRuleSets.map(async (ruleSet) => {
          // If ID conflict, create with new ID
          if (existingRuleSetIds.has(ruleSet.id)) {
            const { id, ...ruleSetWithoutId } = ruleSet
            return await createRuleSet(ruleSetWithoutId, session)
          } else {
            // Try to create with existing ID
            try {
              return await createRuleSet(ruleSet, session)
            } catch (error) {
              // If fails, create without ID
              const { id, ...ruleSetWithoutId } = ruleSet
              return await createRuleSet(ruleSetWithoutId, session)
            }
          }
        }),
      )

      // Then import rules
      const importedRules = await Promise.all(
        selectedRules.map(async (rule) => {
          // If ID conflict, create with new ID
          if (existingRuleIds.has(rule.id)) {
            const { id, ...ruleWithoutId } = rule
            return await createRule(ruleWithoutId, session)
          } else {
            // Try to create with existing ID
            try {
              return await createRule(rule, session)
            } catch (error) {
              // If fails, create without ID
              const { id, ...ruleWithoutId } = rule
              return await createRule(ruleWithoutId, session)
            }
          }
        }),
      )

      // Update the state with imported data
      setRules([...rules, ...importedRules])
      setRuleSets([...ruleSets, ...importedRuleSets])

      toast({
        title: "Rules imported",
        description: `${importedRules.length} rules and ${importedRuleSets.length} rule sets imported successfully.`,
      })

      setIsImportDialogOpen(false)
      setImportedData(null)
    } catch (error) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Toggle all rules to export
  const toggleAllRulesToExport = (checked) => {
    setSelectedRulesToExport(
      rules.reduce((acc, rule) => {
        acc[rule.id] = checked
        return acc
      }, {}),
    )
  }

  // Toggle all rule sets to export
  const toggleAllRuleSetsToExport = (checked) => {
    setSelectedRuleSetsToExport(
      ruleSets.reduce((acc, ruleSet) => {
        acc[ruleSet.id] = checked
        return acc
      }, {}),
    )
  }

  // Toggle all rules to import
  const toggleAllRulesToImport = (checked) => {
    if (!importedData) return

    setSelectedRulesToImport(
      importedData.rules.reduce((acc, rule) => {
        acc[rule.id] = checked
        return acc
      }, {}),
    )
  }

  // Toggle all rule sets to import
  const toggleAllRuleSetsToImport = (checked) => {
    if (!importedData) return

    setSelectedRuleSetsToImport(
      importedData.ruleSets.reduce((acc, ruleSet) => {
        acc[ruleSet.id] = checked
        return acc
      }, {}),
    )
  }

  // Filtered lists for search functionality
  const filteredRulesToExport = useMemo(() => {
    return rules.filter(
      (rule) =>
        rule.name.toLowerCase().includes(searchExport.toLowerCase()) ||
        rule.description.toLowerCase().includes(searchExport.toLowerCase()),
    )
  }, [rules, searchExport])

  const filteredRuleSetsToExport = useMemo(() => {
    return ruleSets.filter(
      (ruleSet) =>
        ruleSet.name.toLowerCase().includes(searchExport.toLowerCase()) ||
        ruleSet.description.toLowerCase().includes(searchExport.toLowerCase()),
    )
  }, [ruleSets, searchExport])

  const filteredRulesToImport = useMemo(() => {
    if (!importedData) return []

    return importedData.rules.filter(
      (rule) =>
        rule.name.toLowerCase().includes(searchImport.toLowerCase()) ||
        rule.description.toLowerCase().includes(searchImport.toLowerCase()),
    )
  }, [importedData, searchImport])

  const filteredRuleSetsToImport = useMemo(() => {
    if (!importedData) return []

    return importedData.ruleSets.filter(
      (ruleSet) =>
        ruleSet.name.toLowerCase().includes(searchImport.toLowerCase()) ||
        ruleSet.description.toLowerCase().includes(searchImport.toLowerCase()),
    )
  }, [importedData, searchImport])

  // Trigger file input
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Check if any data is still loading
  const isLoading = loading.rules || loading.ruleSets || loading.tags || loading.groups

  // Check if there are any errors
  const hasErrors = error.rules || error.ruleSets || error.tags || error.groups

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Rule Management</h1>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={handleImportRules} accept=".json" className="hidden" />
          <Button variant="outline" onClick={triggerFileInput}>
            <Upload className="h-4 w-4 mr-2" />
            Import Rules
          </Button>
          <Button variant="outline" onClick={handleExportRules}>
            <Download className="h-4 w-4 mr-2" />
            Export Rules
          </Button>
          <Button onClick={() => setIsAddRuleSetDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Rule Set
          </Button>
          <Button
            onClick={() => {
              resetForm()
              setIsAddRuleDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading rule management data...</p>
        </div>
      ) : hasErrors ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <AlertDescription>
            There was an error loading the data. Please try refreshing the page. {hasErrors}
            <Button variant="outline" size="sm" className="ml-4" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="sets" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="sets">Rule Sets</TabsTrigger>
            <TabsTrigger value="single">Single Rules</TabsTrigger>
            <TabsTrigger value="by-type">By Type</TabsTrigger>
          </TabsList>

          <TabsContent value="sets">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Rule Sets</h2>
              <p className="text-muted-foreground">Manage groups of related rules.</p>

              {ruleSets.length === 0 ? (
                <Alert>
                  <AlertDescription>No rule sets found. Create a rule set to get started.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {ruleSets.map((ruleSet) => {
                    const rulesInSet = getRulesForRuleSet(ruleSet.id)
                    const isExpanded = expandedRuleSets[ruleSet.id]

                    return (
                      <Card key={ruleSet.id}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => toggleRuleSetExpansion(ruleSet.id)}>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                              <CardTitle>{ruleSet.name}</CardTitle>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setRuleSetToEdit(ruleSet)
                                  setIsEditRuleSetDialogOpen(true)
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  resetForm()
                                  setNewRule({
                                    ...newRule,
                                    ruleSet: ruleSet.id,
                                  })
                                  setIsAddRuleDialogOpen(true)
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setRuleSetToDelete(ruleSet.id)
                                  setIsDeleteRuleSetDialogOpen(true)
                                }}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-muted-foreground">{ruleSet.description}</div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary">{rulesInSet.length} Rules</Badge>
                            {!ruleSet.isActive && <Badge variant="outline">Inactive</Badge>}
                            <Switch
                              checked={ruleSet.isActive}
                              onCheckedChange={() => toggleRuleSetActivation(ruleSet.id)}
                            />
                          </div>

                          {isExpanded && (
                            <div className="mt-4">
                              {rulesInSet.length === 0 ? (
                                <Alert>
                                  <AlertDescription>No rules in this set. Add a rule to get started.</AlertDescription>
                                </Alert>
                              ) : (
                                <div className="rounded-md border">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="border-b bg-muted/50">
                                        <th className="p-2 text-left">Active</th>
                                        <th className="p-2 text-left">Name</th>
                                        <th className="p-2 text-left">Type</th>
                                        <th className="p-2 text-left">Condition</th>
                                        <th className="p-2 text-left">Action</th>
                                        <th className="p-2 text-left">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rulesInSet.map((rule) => (
                                        <tr key={rule.id} className="border-b">
                                          <td className="p-2">
                                            <Switch
                                              checked={rule.isActive}
                                              onCheckedChange={() => toggleRuleActivation(rule.id)}
                                            />
                                          </td>
                                          <td className="p-2">
                                            <div className="font-medium">{rule.name}</div>
                                            <div className="text-sm text-muted-foreground">{rule.description}</div>
                                          </td>
                                          <td className="p-2">
                                            {initiatorTypes.find((m) => m.id === rule.initiators[0]?.type)?.name ||
                                              "Unknown"}
                                          </td>
                                          <td className="p-2">{formatAllConditions(rule)}</td>
                                          <td className="p-2">
                                            <div className="flex items-center">
                                              {getActionTypeIcon(rule.action)}
                                              {formatAction(rule)}
                                            </div>
                                          </td>
                                          <td className="p-2">
                                            <div className="flex gap-2">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  // Convert schedule values from UTC for editing
                                                  const ruleForEditing = {
                                                    ...rule,
                                                    initiators: rule.initiators.map((initiator) => {
                                                      if (
                                                        initiatorTypes.find((t) => t.id === initiator.type)?.type ===
                                                        "schedule"
                                                      ) {
                                                        return {
                                                          ...initiator,
                                                          scheduleValue: initiator.scheduleValue
                                                        }
                                                      }
                                                      return initiator
                                                    }),
                                                  }
                                                  setEditRule(ruleForEditing)
                                                  setCurrentStep(1)
                                                  setIsEditRuleDialogOpen(true)
                                                }}
                                              >
                                                <Edit className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={async () => {
                                                  // Duplicate rule logic
                                                  try {
                                                    const { id, ...ruleCopy } = rule
                                                    const newRule = {
                                                      ...ruleCopy,
                                                      name: `${rule.name} (Copy)`,
                                                    }
                                                    const createdRule = await createRule(newRule, session)
                                                    setRules([...rules, createdRule])
                                                    toast({
                                                      title: "Rule duplicated",
                                                      description: `${rule.name} has been duplicated.`,
                                                    })
                                                  } catch (error) {
                                                    toast({
                                                      title: "Error duplicating rule",
                                                      description: error.message,
                                                      variant: "destructive",
                                                    })
                                                  }
                                                }}
                                              >
                                                <Copy className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  setRuleToDelete(rule.id)
                                                  setIsDeleteRuleDialogOpen(true)
                                                }}
                                              >
                                                <Trash className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              <Button
                                className="mt-4"
                                onClick={() => {
                                  resetForm()
                                  setNewRule({
                                    ...newRule,
                                    ruleSet: ruleSet.id,
                                  })
                                  setIsAddRuleDialogOpen(true)
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Rule to Set
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="single">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Single Rules</h2>
              <p className="text-muted-foreground">Rules that don't belong to any rule set.</p>

              {rules.filter((rule) => !rule.ruleSet || rule.ruleSet === "none").length === 0 ? (
                <Alert>
                  <AlertDescription>No single rules found. Add a rule to get started.</AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Active</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Initiator</th>
                        <th className="p-2 text-left">Condition</th>
                        <th className="p-2 text-left">Action</th>
                        <th className="p-2 text-left">Priority</th>
                        <th className="p-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules
                        .filter((rule) => !rule.ruleSet || rule.ruleSet === "none")
                        .map((rule) => (
                          <tr key={rule.id} className="border-b">
                            <td className="p-2">
                              <Switch checked={rule.isActive} onCheckedChange={() => toggleRuleActivation(rule.id)} />
                            </td>
                            <td className="p-2">
                              <div className="font-medium">{rule.name}</div>
                              <div className="text-sm text-muted-foreground">{rule.description}</div>
                            </td>
                            <td className="p-2">
                              {initiatorTypes.find((m) => m.id === rule.initiators[0]?.type)?.name || "Unknown"}
                            </td>
                            <td className="p-2">{formatAllConditions(rule)}</td>
                            <td className="p-2">
                              <div className="flex items-center">
                                {getActionTypeIcon(rule.action)}
                                {formatAction(rule)}
                              </div>
                            </td>

                            <td className="p-2">{rule.priority}</td>
                            <td className="p-2">
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    // Convert schedule values from UTC for editing
                                    const ruleForEditing = {
                                      ...rule,
                                      initiators: rule.initiators.map((initiator) => {
                                        if (initiatorTypes.find((t) => t.id === initiator.type)?.type === "schedule") {
                                          return {
                                            ...initiator,
                                            scheduleValue: initiator.scheduleValue
                                          }
                                        }
                                        return initiator
                                      }),
                                    }
                                    setEditRule(ruleForEditing)
                                    setCurrentStep(1)
                                    setIsEditRuleDialogOpen(true)
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    // Duplicate rule logic
                                    try {
                                      const { id, ...ruleCopy } = rule
                                      const newRule = {
                                        ...ruleCopy,
                                        name: `${rule.name} (Copy)`,
                                      }
                                      const createdRule = await createRule(newRule, session)
                                      setRules([...rules, createdRule])
                                      toast({
                                        title: "Rule duplicated",
                                        description: `${rule.name} has been duplicated.`,
                                      })
                                    } catch (error) {
                                      toast({
                                        title: "Error duplicating rule",
                                        description: error.message,
                                        variant: "destructive",
                                      })
                                    }
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setRuleToDelete(rule.id)
                                    setIsDeleteRuleDialogOpen(true)
                                  }}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Additional TabsContent components would go here */}
        </Tabs>
      )}

      {/* Dialogs would go here */}
      {/* Add Rule Set Dialog */}
      <Dialog open={isAddRuleSetDialogOpen} onOpenChange={setIsAddRuleSetDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Rule Set</DialogTitle>
            <DialogDescription>Create a new set of rules that can be managed together.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Rule Set Name</Label>
              <Input
                id="name"
                placeholder="Enter rule set name"
                value={newRuleSet.name}
                onChange={(e) => setNewRuleSet({ ...newRuleSet, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter rule set description"
                value={newRuleSet.description}
                onChange={(e) => setNewRuleSet({ ...newRuleSet, description: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={newRuleSet.isActive}
                onCheckedChange={(checked) => setNewRuleSet({ ...newRuleSet, isActive: checked })}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRuleSetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRuleSet}>Create Rule Set</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Rule Dialog */}
      <Dialog open={isAddRuleDialogOpen} onOpenChange={setIsAddRuleDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Rule</DialogTitle>
            <DialogDescription>
              Step {currentStep} of {totalSteps}:{" "}
              {currentStep === 1
                ? "Basic Information"
                : currentStep === 2
                  ? "Define Initiators"
                  : currentStep === 3
                    ? "Choose Action"
                    : currentStep === 4
                      ? "Configure Action"
                      : "Apply To"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter rule name"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter rule description"
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ruleSet">Rule Set (Optional)</Label>
                  <Select
                    value={newRule.ruleSet}
                    onValueChange={(value) => {
                      if (value === "create_new") {
                        // Don't update the ruleSet value yet, just show the form
                      } else {
                        setNewRule({ ...newRule, ruleSet: value })
                      }
                    }}
                  >
                    <SelectTrigger id="ruleSet">
                      <SelectValue placeholder="Select a rule set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="create_new" className="text-primary font-medium">
                        <div className="flex items-center">
                          <Plus className="h-4 w-4 mr-2" />
                          Create New Rule Set
                        </div>
                      </SelectItem>
                      <SelectItem value="divider" disabled>
                        <div className="h-[1px] bg-muted my-1" />
                      </SelectItem>
                      {ruleSets.map((ruleSet) => (
                        <SelectItem key={ruleSet.id} value={ruleSet.id}>
                          {ruleSet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newRule.ruleSet === "create_new" && (
                  <div className="border rounded-md p-4 space-y-4 mt-2">
                    <h4 className="font-medium">Create New Rule Set</h4>
                    <div className="grid gap-2">
                      <Label htmlFor="newRuleSetName">Name</Label>
                      <Input
                        id="newRuleSetName"
                        placeholder="Enter rule set name"
                        value={newRuleSet.name}
                        onChange={(e) => setNewRuleSet({ ...newRuleSet, name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="newRuleSetDescription">Description</Label>
                      <Textarea
                        id="newRuleSetDescription"
                        placeholder="Enter rule set description"
                        value={newRuleSet.description}
                        onChange={(e) => setNewRuleSet({ ...newRuleSet, description: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="newRuleSetActive"
                        checked={newRuleSet.isActive}
                        onCheckedChange={(checked) => setNewRuleSet({ ...newRuleSet, isActive: !!checked })}
                      />
                      <Label htmlFor="newRuleSetActive">Active</Label>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setNewRule({ ...newRule, ruleSet: "none" })}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!newRuleSet.name) {
                            toast({
                              title: "Missing information",
                              description: "Please provide a name for the rule set.",
                              variant: "destructive",
                            })
                            return
                          }

                          try {
                            const createdRuleSet = await createRuleSet(newRuleSet, session)
                            setRuleSets([...ruleSets, createdRuleSet])
                            setNewRule({ ...newRule, ruleSet: createdRuleSet.id })

                            // Reset the newRuleSet state
                            setNewRuleSet({
                              name: "",
                              description: "",
                              isActive: true,
                              rules: [],
                            })

                            toast({
                              title: "Rule set created",
                              description: `${newRuleSet.name} has been created successfully.`,
                            })
                          } catch (error) {
                            toast({
                              title: "Error creating rule set",
                              description: error.message,
                              variant: "destructive",
                            })
                          }
                        }}
                      >
                        Create
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Define Initiators */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Initiators</h3>
                  <Button onClick={addInitiator} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Initiator
                  </Button>
                </div>

                {newRule.initiators.length > 1 && (
                  <div className="grid gap-2">
                    <Label>Logical Operator</Label>
                    <Select
                      value={newRule.logicalOperator}
                      onValueChange={(value) => setNewRule({ ...newRule, logicalOperator: value as "and" | "or" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {logicalOperators.map((op) => (
                          <SelectItem key={op.id} value={op.id}>
                            {op.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      {newRule.logicalOperator === "and"
                        ? "All conditions must be met for the rule to trigger"
                        : "At least one condition must be met for the rule to trigger"}
                    </p>
                  </div>
                )}

                {newRule.initiators.map((initiator, index) => (
                  <Card key={initiator.id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base">Initiator {index + 1}</CardTitle>
                        {newRule.initiators.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeInitiator(initiator.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2">
                        <Label>Select Initiator Type</Label>
                        <Select
                          value={initiator.type}
                          onValueChange={(value) => updateInitiator(initiator.id, "type", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select initiator type" />
                          </SelectTrigger>
                          <SelectContent>
                            {initiatorTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                <div className="flex items-center">
                                  <type.icon className="h-4 w-4 mr-2" />
                                  <span>{type.name}</span>
                                  {type.unit && <span className="ml-1">({type.unit})</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {initiator.type && (
                        <>
                          {initiatorTypes.find((i) => i.id === initiator.type)?.type === "measurement" && (
                            <div className="space-y-4">
                              <div className="grid gap-2">
                                <Label>Condition</Label>
                                <Select
                                  value={initiator.operator}
                                  onValueChange={(value) => updateInitiator(initiator.id, "operator", value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select condition" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {conditionOperators.map((op) => (
                                      <SelectItem key={op.id} value={op.id}>
                                        <div className="flex items-center">
                                          <span className="mr-2">{op.symbol}</span>
                                          <span>{op.name}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid gap-2">
                                <Label>Value</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    placeholder="Enter value"
                                    value={initiator.value}
                                    onChange={(e) =>
                                      updateInitiator(initiator.id, "value", Number.parseFloat(e.target.value))
                                    }
                                  />
                                  {initiator.type && (
                                    <span className="text-muted-foreground">
                                      {initiatorTypes.find((m) => m.id === initiator.type)?.unit}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {initiator.operator === "between" && (
                                <div className="grid gap-2">
                                  <Label>Second Value (for Between)</Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      placeholder="Enter second value"
                                      value={initiator.value2 || ""}
                                      onChange={(e) =>
                                        updateInitiator(initiator.id, "value2", Number.parseFloat(e.target.value))
                                      }
                                    />
                                    {initiator.type && (
                                      <span className="text-muted-foreground">
                                        {initiatorTypes.find((m) => m.id === initiator.type)?.unit}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {initiatorTypes.find((i) => i.id === initiator.type)?.type === "schedule" && (
                            <div className="space-y-4">
                              <div className="grid gap-2">
                                <Label>Schedule Type</Label>
                                <Select
                                  value={initiator.scheduleType}
                                  onValueChange={(value) => updateInitiator(initiator.id, "scheduleType", value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select schedule type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="yearly">Yearly</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {initiator.scheduleType === "daily" && (
                                <div className="grid gap-2">
                                  <Label>Time (HH:MM)</Label>
                                  <Input
                                    placeholder="16:01"
                                    value={initiator.scheduleValue}
                                    onChange={(e) => updateInitiator(initiator.id, "scheduleValue", e.target.value)}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Enter time in 24-hour format (e.g., 16:01 for 4:01 PM) - {userTimezone}
                                  </p>
                                </div>
                              )}

                              {initiator.scheduleType === "weekly" && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label>Day of Week</Label>
                                    <Select
                                      value={initiator.scheduleValue?.split(",")[0] || ""}
                                      onValueChange={(value) => {
                                        const time = initiator.scheduleValue?.split(",")[1] || ""
                                        updateInitiator(initiator.id, "scheduleValue", `${value},${time}`)
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select day" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="0">Sunday</SelectItem>
                                        <SelectItem value="1">Monday</SelectItem>
                                        <SelectItem value="2">Tuesday</SelectItem>
                                        <SelectItem value="3">Wednesday</SelectItem>
                                        <SelectItem value="4">Thursday</SelectItem>
                                        <SelectItem value="5">Friday</SelectItem>
                                        <SelectItem value="6">Saturday</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>Time (HH:MM)</Label>
                                    <Input
                                      placeholder="16:01"
                                      value={initiator.scheduleValue?.split(",")[1] || ""}
                                      onChange={(e) => {
                                        const day = initiator.scheduleValue?.split(",")[0] || ""
                                        updateInitiator(initiator.id, "scheduleValue", `${day},${e.target.value}`)
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              {initiator.scheduleType === "monthly" && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label>Day of Month (1-31)</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      max="31"
                                      placeholder="15"
                                      value={initiator.scheduleValue?.split(",")[0] || ""}
                                      onChange={(e) => {
                                        const time = initiator.scheduleValue?.split(",")[1] || ""
                                        updateInitiator(initiator.id, "scheduleValue", `${e.target.value},${time}`)
                                      }}
                                    />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>Time (HH:MM)</Label>
                                    <Input
                                      placeholder="16:01"
                                      value={initiator.scheduleValue?.split(",")[1] || ""}
                                      onChange={(e) => {
                                        const day = initiator.scheduleValue?.split(",")[0] || ""
                                        updateInitiator(initiator.id, "scheduleValue", `${day},${e.target.value}`)
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              {initiator.scheduleType === "yearly" && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                    <Label>Day and Month</Label>
                                    <Input
                                      placeholder="15/06 (DD/MM)"
                                      value={initiator.scheduleValue?.split(",")[0] || ""}
                                      onChange={(e) => {
                                        const time = initiator.scheduleValue?.split(",")[1] || ""
                                        updateInitiator(initiator.id, "scheduleValue", `${e.target.value},${time}`)
                                      }}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Enter day and month (e.g., 15/06 for June 15th)
                                    </p>
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>Time (HH:MM)</Label>
                                    <Input
                                      placeholder="16:01"
                                      value={initiator.scheduleValue?.split(",")[1] || ""}
                                      onChange={(e) => {
                                        const dayMonth = initiator.scheduleValue?.split(",")[0] || ""
                                        updateInitiator(initiator.id, "scheduleValue", `${dayMonth},${e.target.value}`)
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {initiatorTypes.find((i) => i.id === initiator.type)?.type === "tag" && (
                            <div className="space-y-4">
                              <div className="grid gap-2">
                                <Label>Select Tags</Label>
                                <div className="border rounded-md p-4 space-y-2">
                                  {tags.map((tag) => (
                                    <div key={tag.id} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`tag-${tag.id}-${initiator.id}`}
                                        checked={(initiator.tags || []).includes(tag.id)}
                                        onCheckedChange={(checked) =>
                                          handleInitiatorTagSelection(initiator.id, tag.id, !!checked)
                                        }
                                      />
                                      <Label
                                        htmlFor={`tag-${tag.id}-${initiator.id}`}
                                        className="flex items-center justify-between w-full cursor-pointer"
                                      >
                                        <span>{tag.name}</span>
                                        <Badge variant="outline">{tag.type}</Badge>
                                      </Label>
                                    </div>
                                  ))}
                                  {tags.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                      No tags available. Create tags in the tag management page.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Step 3: Choose Action */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Select Action</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {actionTypes.map((action) => (
                      <div
                        key={action.id}
                        className={`border rounded-md p-4 cursor-pointer transition-colors ${
                          newRule.action === action.id ? "border-primary bg-primary/5" : "hover:border-primary/50"
                        }`}
                        onClick={() => setNewRule({ ...newRule, action: action.id })}
                      >
                        <div className="flex items-center gap-2">
                          <action.icon className="h-5 w-5" />
                          <span className="font-medium">{action.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Configure Action */}
            {currentStep === 4 && (
              <div className="space-y-6">
                {(newRule.action === "alert" || newRule.action === "email" || newRule.action === "tip") && (
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Alert Severity</Label>
                      <Select
                        value={newRule.actionParams.severity}
                        onValueChange={(value) =>
                          setNewRule({
                            ...newRule,
                            actionParams: { ...newRule.actionParams, severity: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Message Type</Label>
                      <RadioGroup
                        value={newRule.actionParams.template ? "template" : "custom"}
                        onValueChange={(value) => {
                          if (value === "template") {
                            setNewRule({
                              ...newRule,
                              actionParams: {
                                ...newRule.actionParams,
                                template: newRule.initiators[0]?.type
                                  ? getFilteredTemplates(newRule.initiators[0].type)[0]?.id || ""
                                  : "",
                                customMessage: "",
                              },
                            })
                          } else {
                            setNewRule({
                              ...newRule,
                              actionParams: { ...newRule.actionParams, template: "", customMessage: "" },
                            })
                          }
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="template" id="template" />
                          <Label htmlFor="template">Use Template</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id="custom" />
                          <Label htmlFor="custom">Custom Message</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {newRule.actionParams.template ? (
                      <div className="grid gap-2">
                        <Label>Message Template</Label>
                        <Select
                          value={newRule.actionParams.template}
                          onValueChange={(value) =>
                            setNewRule({
                              ...newRule,
                              actionParams: { ...newRule.actionParams, template: value },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                          <SelectContent>
                            {newRule.initiators.length > 0 &&
                              getFilteredTemplates(newRule.initiators[0].type).map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {newRule.actionParams.template && (
                          <div className="p-3 bg-muted rounded-md text-sm">
                            {getTemplateText(newRule.actionParams.template)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <Label>Custom Message</Label>
                        <Textarea
                          placeholder="Enter custom message"
                          value={newRule.actionParams.customMessage}
                          onChange={(e) =>
                            setNewRule({
                              ...newRule,
                              actionParams: { ...newRule.actionParams, customMessage: e.target.value },
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Use {"{group}"} for group name, {"{value}"} for measurement value
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {newRule.action === "health" && (
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Health Adjustment Type</Label>
                      <Select
                        value={newRule.actionParams.healthType || "static"}
                        onValueChange={(value) =>
                          setNewRule({
                            ...newRule,
                            actionParams: { ...newRule.actionParams, healthType: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select adjustment type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="static">Static Adjustment</SelectItem>
                          <SelectItem value="dynamic">Dynamic Adjustment</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {newRule.actionParams.healthType === "dynamic"
                          ? "Health adjustment based on measurement value and thresholds"
                          : "Fixed health adjustment amount"}
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label>Health Adjustment (%)</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[newRule.actionParams.amount || 0]}
                          min={-50}
                          max={50}
                          step={1}
                          onValueChange={(value) =>
                            setNewRule({
                              ...newRule,
                              actionParams: { ...newRule.actionParams, amount: value[0] },
                            })
                          }
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          min={-50}
                          max={50}
                          value={newRule.actionParams.amount || 0}
                          onChange={(e) =>
                            setNewRule({
                              ...newRule,
                              actionParams: { ...newRule.actionParams, amount: Number(e.target.value) },
                            })
                          }
                          className="w-20"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                )}

                {newRule.action === "tag" && (
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Tag to Apply</Label>
                      <Select
                        value={newRule.actionParams.tagId}
                        onValueChange={(value) =>
                          setNewRule({
                            ...newRule,
                            actionParams: { ...newRule.actionParams, tagId: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select tag" />
                        </SelectTrigger>
                        <SelectContent>
                          {tags
                            .filter((tag) => tag.type === "status")
                            .map((tag) => (
                              <SelectItem key={tag.id} value={tag.id}>
                                <div className="flex items-center">
                                  <Tag className="h-4 w-4 mr-2" />
                                  {tag.name}
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {tags.filter((tag) => tag.type === "status").length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No status tags available. Create status tags in the tag management page.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {(newRule.action === "schedule" ||
                  newRule.action === "maintenance" ||
                  newRule.action === "inspection") && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Schedule Title</Label>
                        <Input
                          placeholder="Enter schedule title"
                          value={newRule.actionParams.scheduleTitle}
                          onChange={(e) =>
                            setNewRule({
                              ...newRule,
                              actionParams: { ...newRule.actionParams, scheduleTitle: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Description</Label>
                        <Textarea
                          placeholder="Enter schedule description"
                          value={newRule.actionParams.scheduleDescription}
                          onChange={(e) =>
                            setNewRule({
                              ...newRule,
                              actionParams: { ...newRule.actionParams, scheduleDescription: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Category</Label>
                      <Select
                        value={newRule.actionParams.scheduleCategory}
                        onValueChange={(value) =>
                          setNewRule({
                            ...newRule,
                            actionParams: { ...newRule.actionParams, scheduleCategory: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {scheduleCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className="flex items-center">
                                {getScheduleCategoryIcon(category.id)}
                                {category.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Priority</Label>
                      <Select
                        value={newRule.actionParams.schedulePriority}
                        onValueChange={(value) =>
                          setNewRule({
                            ...newRule,
                            actionParams: { ...newRule.actionParams, schedulePriority: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {newRule.action === "progress" && (
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Select Schedule</Label>
                      <Select
                        value={newRule.actionParams.scheduleId || ""}
                        onValueChange={(value) =>
                          setNewRule({
                            ...newRule,
                            actionParams: { ...newRule.actionParams, scheduleId: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a schedule" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spring-expansion">Spring Expansion</SelectItem>
                          <SelectItem value="summer-extraction">Summer Extraction</SelectItem>
                          <SelectItem value="curing-treatment">Curing & Treatment</SelectItem>
                          <SelectItem value="winter-preparation">Winter Preparation</SelectItem>
                          <SelectItem value="inspection">Inspection</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Target Value (100% Progress)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Enter target value"
                          value={newRule.actionParams.targetValue || ""}
                          onChange={(e) =>
                            setNewRule({
                              ...newRule,
                              actionParams: { ...newRule.actionParams, targetValue: Number(e.target.value) },
                            })
                          }
                        />
                        {newRule.initiators[0]?.type && (
                          <span className="text-muted-foreground">
                            {initiatorTypes.find((m) => m.id === newRule.initiators[0].type)?.unit}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        When this value is reached, the schedule will be marked as 100% complete.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label>Progress Calculation</Label>
                      <Select
                        value={newRule.actionParams.progressType || "linear"}
                        onValueChange={(value) =>
                          setNewRule({
                            ...newRule,
                            actionParams: { ...newRule.actionParams, progressType: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select calculation method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linear">Linear (Direct Percentage)</SelectItem>
                          <SelectItem value="threshold">Threshold (All or Nothing)</SelectItem>
                          <SelectItem value="incremental">Incremental (Add to Current)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {newRule.actionParams.progressType === "linear" &&
                          "Linear: Progress is calculated as a direct percentage of the current value compared to the target."}
                        {newRule.actionParams.progressType === "threshold" &&
                          "Threshold: Schedule is marked 100% complete when target is reached, 0% otherwise."}
                        {newRule.actionParams.progressType === "incremental" &&
                          "Incremental: Adds a percentage to the current progress each time the rule is triggered."}
                      </p>
                    </div>

                    {newRule.actionParams.progressType === "incremental" && (
                      <div className="grid gap-2">
                        <Label>Increment Amount (%)</Label>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[newRule.actionParams.incrementAmount || 10]}
                            min={1}
                            max={100}
                            step={1}
                            onValueChange={(value) =>
                              setNewRule({
                                ...newRule,
                                actionParams: { ...newRule.actionParams, incrementAmount: value[0] },
                              })
                            }
                          />
                          <span className="w-12 text-center font-medium">
                            {newRule.actionParams.incrementAmount || 10}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Apply To */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Rule Priority</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Lowest</span>
                      <Slider
                        value={[newRule.priority]}
                        min={1}
                        max={10}
                        step={1}
                        onValueChange={(value) => setNewRule({ ...newRule, priority: value[0] })}
                        className="flex-1"
                      />
                      <span className="text-sm">Highest</span>
                      <span className="w-8 text-center font-medium">{newRule.priority}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Higher priority rules (10) will override lower priority rules (1) when conflicts occur.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="active"
                      checked={newRule.isActive}
                      onCheckedChange={(checked) => setNewRule({ ...newRule, isActive: !!checked })}
                    />
                    <Label htmlFor="active">Active</Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handlePreviousStep}>
              {currentStep === 1 ? "Cancel" : "Back"}
            </Button>
            <Button onClick={handleNextStep}>{currentStep < totalSteps ? "Next" : "Save Rule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog open={isEditRuleDialogOpen} onOpenChange={setIsEditRuleDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Rule</DialogTitle>
            <DialogDescription>
              Step {currentStep} of {totalSteps}:{" "}
              {currentStep === 1
                ? "Basic Information"
                : currentStep === 2
                  ? "Define Initiators"
                  : currentStep === 3
                    ? "Choose Action"
                    : currentStep === 4
                      ? "Configure Action"
                      : "Apply To"}
            </DialogDescription>
          </DialogHeader>

          {editRule && (
            <div className="py-4">
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Rule Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter rule name"
                      value={editRule.name}
                      onChange={(e) => setEditRule({ ...editRule, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter rule description"
                      value={editRule.description}
                      onChange={(e) => setEditRule({ ...editRule, description: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ruleSet">Rule Set (Optional)</Label>
                    <Select
                      value={editRule.ruleSet}
                      onValueChange={(value) => {
                        if (value === "create_new") {
                          // Don't update the ruleSet value yet, just show the form
                        } else {
                          setEditRule({ ...editRule, ruleSet: value })
                        }
                      }}
                    >
                      <SelectTrigger id="ruleSet">
                        <SelectValue placeholder="Select a rule set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="create_new" className="text-primary font-medium">
                          <div className="flex items-center">
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Rule Set
                          </div>
                        </SelectItem>
                        <SelectItem value="divider" disabled>
                          <div className="h-[1px] bg-muted my-1" />
                        </SelectItem>
                        {ruleSets.map((ruleSet) => (
                          <SelectItem key={ruleSet.id} value={ruleSet.id}>
                            {ruleSet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editRule.ruleSet === "create_new" && (
                    <div className="border rounded-md p-4 space-y-4 mt-2">
                      <h4 className="font-medium">Create New Rule Set</h4>
                      <div className="grid gap-2">
                        <Label htmlFor="newRuleSetName">Name</Label>
                        <Input
                          id="newRuleSetName"
                          placeholder="Enter rule set name"
                          value={newRuleSet.name}
                          onChange={(e) => setNewRuleSet({ ...newRuleSet, name: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="newRuleSetDescription">Description</Label>
                        <Textarea
                          id="newRuleSetDescription"
                          placeholder="Enter rule set description"
                          value={newRuleSet.description}
                          onChange={(e) => setNewRuleSet({ ...newRuleSet, description: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="newRuleSetActive"
                          checked={newRuleSet.isActive}
                          onCheckedChange={(checked) => setNewRuleSet({ ...newRuleSet, isActive: !!checked })}
                        />
                        <Label htmlFor="newRuleSetActive">Active</Label>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditRule({ ...editRule, ruleSet: "none" })}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (!newRuleSet.name) {
                              toast({
                                title: "Missing information",
                                description: "Please provide a name for the rule set.",
                                variant: "destructive",
                              })
                              return
                            }

                            try {
                              const createdRuleSet = await createRuleSet(newRuleSet, session)
                              setRuleSets([...ruleSets, createdRuleSet])
                              setEditRule({ ...editRule, ruleSet: createdRuleSet.id })

                              // Reset the newRuleSet state
                              setNewRuleSet({
                                name: "",
                                description: "",
                                isActive: true,
                                rules: [],
                              })

                              toast({
                                title: "Rule set created",
                                description: `${newRuleSet.name} has been created successfully.`,
                              })
                            } catch (error) {
                              toast({
                                title: "Error creating rule set",
                                description: error.message,
                                variant: "destructive",
                              })
                            }
                          }}
                        >
                          Create
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Define Initiators */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Initiators</h3>
                    <Button onClick={addInitiator} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Initiator
                    </Button>
                  </div>

                  {editRule.initiators.length > 1 && (
                    <div className="grid gap-2">
                      <Label>Logical Operator</Label>
                      <Select
                        value={editRule.logicalOperator}
                        onValueChange={(value) => setEditRule({ ...editRule, logicalOperator: value as "and" | "or" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {logicalOperators.map((op) => (
                            <SelectItem key={op.id} value={op.id}>
                              {op.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {editRule.logicalOperator === "and"
                          ? "All conditions must be met for the rule to trigger"
                          : "At least one condition must be met for the rule to trigger"}
                      </p>
                    </div>
                  )}

                  {editRule.initiators.map((initiator, index) => (
                    <Card key={initiator.id} className="relative">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base">Initiator {index + 1}</CardTitle>
                          {editRule.initiators.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => removeInitiator(initiator.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-2">
                          <Label>Select Initiator Type</Label>
                          <Select
                            value={initiator.type}
                            onValueChange={(value) => updateInitiator(initiator.id, "type", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select initiator type" />
                            </SelectTrigger>
                            <SelectContent>
                              {initiatorTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  <div className="flex items-center">
                                    <type.icon className="h-4 w-4 mr-2" />
                                    <span>{type.name}</span>
                                    {type.unit && <span className="ml-1">({type.unit})</span>}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {initiator.type && (
                          <>
                            {initiatorTypes.find((i) => i.id === initiator.type)?.type === "measurement" && (
                              <div className="space-y-4">
                                <div className="grid gap-2">
                                  <Label>Condition</Label>
                                  <Select
                                    value={initiator.operator}
                                    onValueChange={(value) => updateInitiator(initiator.id, "operator", value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select condition" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {conditionOperators.map((op) => (
                                        <SelectItem key={op.id} value={op.id}>
                                          <div className="flex items-center">
                                            <span className="mr-2">{op.symbol}</span>
                                            <span>{op.name}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="grid gap-2">
                                  <Label>Value</Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      placeholder="Enter value"
                                      value={initiator.value}
                                      onChange={(e) =>
                                        updateInitiator(initiator.id, "value", Number.parseFloat(e.target.value))
                                      }
                                    />
                                    {initiator.type && (
                                      <span className="text-muted-foreground">
                                        {initiatorTypes.find((m) => m.id === initiator.type)?.unit}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {initiator.operator === "between" && (
                                  <div className="grid gap-2">
                                    <Label>Second Value (for Between)</Label>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        placeholder="Enter second value"
                                        value={initiator.value2 || ""}
                                        onChange={(e) =>
                                          updateInitiator(initiator.id, "value2", Number.parseFloat(e.target.value))
                                        }
                                      />
                                      {initiator.type && (
                                        <span className="text-muted-foreground">
                                          {initiatorTypes.find((m) => m.id === initiator.type)?.unit}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {initiatorTypes.find((i) => i.id === initiator.type)?.type === "schedule" && (
                              <div className="space-y-4">
                                <div className="grid gap-2">
                                  <Label>Schedule Type</Label>
                                  <Select
                                    value={initiator.scheduleType}
                                    onValueChange={(value) => updateInitiator(initiator.id, "scheduleType", value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select schedule type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="daily">Daily</SelectItem>
                                      <SelectItem value="weekly">Weekly</SelectItem>
                                      <SelectItem value="monthly">Monthly</SelectItem>
                                      <SelectItem value="yearly">Yearly</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {initiator.scheduleType === "daily" && (
                                  <div className="grid gap-2">
                                    <Label>Time (HH:MM)</Label>
                                    <Input
                                      placeholder="16:01"
                                      value={initiator.scheduleValue}
                                      onChange={(e) => updateInitiator(initiator.id, "scheduleValue", e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Enter time in 24-hour format (e.g., 16:01 for 4:01 PM) - {userTimezone}
                                    </p>
                                  </div>
                                )}

                                {initiator.scheduleType === "weekly" && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                      <Label>Day of Week</Label>
                                      <Select
                                        value={initiator.scheduleValue?.split(",")[0] || ""}
                                        onValueChange={(value) => {
                                          const time = initiator.scheduleValue?.split(",")[1] || ""
                                          updateInitiator(initiator.id, "scheduleValue", `${value},${time}`)
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select day" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="0">Sunday</SelectItem>
                                          <SelectItem value="1">Monday</SelectItem>
                                          <SelectItem value="2">Tuesday</SelectItem>
                                          <SelectItem value="3">Wednesday</SelectItem>
                                          <SelectItem value="4">Thursday</SelectItem>
                                          <SelectItem value="5">Friday</SelectItem>
                                          <SelectItem value="6">Saturday</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="grid gap-2">
                                      <Label>Time (HH:MM)</Label>
                                      <Input
                                        placeholder="16:01"
                                        value={initiator.scheduleValue?.split(",")[1] || ""}
                                        onChange={(e) => {
                                          const day = initiator.scheduleValue?.split(",")[0] || ""
                                          updateInitiator(initiator.id, "scheduleValue", `${day},${e.target.value}`)
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {initiator.scheduleType === "monthly" && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                      <Label>Day of Month (1-31)</Label>
                                      <Input
                                        type="number"
                                        min="1"
                                        max="31"
                                        placeholder="15"
                                        value={initiator.scheduleValue?.split(",")[0] || ""}
                                        onChange={(e) => {
                                          const time = initiator.scheduleValue?.split(",")[1] || ""
                                          updateInitiator(initiator.id, "scheduleValue", `${e.target.value},${time}`)
                                        }}
                                      />
                                    </div>
                                    <div className="grid gap-2">
                                      <Label>Time (HH:MM)</Label>
                                      <Input
                                        placeholder="16:01"
                                        value={initiator.scheduleValue?.split(",")[1] || ""}
                                        onChange={(e) => {
                                          const day = initiator.scheduleValue?.split(",")[0] || ""
                                          updateInitiator(initiator.id, "scheduleValue", `${day},${e.target.value}`)
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {initiator.scheduleType === "yearly" && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                      <Label>Day and Month</Label>
                                      <Input
                                        placeholder="15/06 (DD/MM)"
                                        value={initiator.scheduleValue?.split(",")[0] || ""}
                                        onChange={(e) => {
                                          const time = initiator.scheduleValue?.split(",")[1] || ""
                                          updateInitiator(initiator.id, "scheduleValue", `${e.target.value},${time}`)
                                        }}
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        Enter day and month (e.g., 15/06 for June 15th)
                                      </p>
                                    </div>
                                    <div className="grid gap-2">
                                      <Label>Time (HH:MM)</Label>
                                      <Input
                                        placeholder="16:01"
                                        value={initiator.scheduleValue?.split(",")[1] || ""}
                                        onChange={(e) => {
                                          const dayMonth = initiator.scheduleValue?.split(",")[0] || ""
                                          updateInitiator(
                                            initiator.id,
                                            "scheduleValue",
                                            `${dayMonth},${e.target.value}`,
                                          )
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {initiatorTypes.find((i) => i.id === initiator.type)?.type === "tag" && (
                              <div className="space-y-4">
                                <div className="grid gap-2">
                                  <Label>Select Tags</Label>
                                  <div className="border rounded-md p-4 space-y-2">
                                    {tags.map((tag) => (
                                      <div key={tag.id} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`tag-${tag.id}-${initiator.id}`}
                                          checked={(initiator.tags || []).includes(tag.id)}
                                          onCheckedChange={(checked) =>
                                            handleInitiatorTagSelection(initiator.id, tag.id, !!checked)
                                          }
                                        />
                                        <Label
                                          htmlFor={`tag-${tag.id}-${initiator.id}`}
                                          className="flex items-center justify-between w-full cursor-pointer"
                                        >
                                          <span>{tag.name}</span>
                                          <Badge variant="outline">{tag.type}</Badge>
                                        </Label>
                                      </div>
                                    ))}
                                    {tags.length === 0 && (
                                      <p className="text-sm text-muted-foreground">
                                        No tags available. Create tags in the tag management page.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Step 3: Choose Action */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Select Action</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {actionTypes.map((action) => (
                        <div
                          key={action.id}
                          className={`border rounded-md p-4 cursor-pointer transition-colors ${
                            editRule.action === action.id ? "border-primary bg-primary/5" : "hover:border-primary/50"
                          }`}
                          onClick={() => setEditRule({ ...editRule, action: action.id })}
                        >
                          <div className="flex items-center gap-2">
                            <action.icon className="h-5 w-5" />
                            <span className="font-medium">{action.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Configure Action */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  {(editRule.action === "alert" || editRule.action === "email" || editRule.action === "tip") && (
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label>Alert Severity</Label>
                        <Select
                          value={editRule.actionParams.severity}
                          onValueChange={(value) =>
                            setEditRule({
                              ...editRule,
                              actionParams: { ...editRule.actionParams, severity: value },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select severity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Message Type</Label>
                        <RadioGroup
                          value={editRule.actionParams.template ? "template" : "custom"}
                          onValueChange={(value) => {
                            if (value === "template") {
                              setEditRule({
                                ...editRule,
                                actionParams: {
                                  ...editRule.actionParams,
                                  template: editRule.initiators[0]?.type
                                    ? getFilteredTemplates(editRule.initiators[0].type)[0]?.id || ""
                                    : "",
                                  customMessage: "",
                                },
                              })
                            } else {
                              setEditRule({
                                ...editRule,
                                actionParams: { ...editRule.actionParams, template: "", customMessage: "" },
                              })
                            }
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="template" id="template" />
                            <Label htmlFor="template">Use Template</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="custom" id="custom" />
                            <Label htmlFor="custom">Custom Message</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {editRule.actionParams.template ? (
                        <div className="grid gap-2">
                          <Label>Message Template</Label>
                          <Select
                            value={editRule.actionParams.template}
                            onValueChange={(value) =>
                              setEditRule({
                                ...editRule,
                                actionParams: { ...editRule.actionParams, template: value },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select template" />
                            </SelectTrigger>
                            <SelectContent>
                              {editRule.initiators.length > 0 &&
                                getFilteredTemplates(editRule.initiators[0].type).map((template) => (
                                  <SelectItem key={template.id} value={template.id}>
                                    {template.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {editRule.actionParams.template && (
                            <div className="p-3 bg-muted rounded-md text-sm">
                              {getTemplateText(editRule.actionParams.template)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <Label>Custom Message</Label>
                          <Textarea
                            placeholder="Enter custom message"
                            value={editRule.actionParams.customMessage}
                            onChange={(e) =>
                              setEditRule({
                                ...editRule,
                                actionParams: { ...editRule.actionParams, customMessage: e.target.value },
                              })
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            Use {"{group}"} for group name, {"{value}"} for measurement value
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {editRule.action === "health" && (
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label>Health Adjustment Type</Label>
                        <Select
                          value={editRule.actionParams.healthType || "static"}
                          onValueChange={(value) =>
                            setEditRule({
                              ...editRule,
                              actionParams: { ...editRule.actionParams, healthType: value },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select adjustment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="static">Static Adjustment</SelectItem>
                            <SelectItem value="dynamic">Dynamic Adjustment</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          {editRule.actionParams.healthType === "dynamic"
                            ? "Health adjustment based on measurement value and thresholds"
                            : "Fixed health adjustment amount"}
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label>Health Adjustment (%)</Label>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[editRule.actionParams.amount || 0]}
                            min={-50}
                            max={50}
                            step={1}
                            onValueChange={(value) =>
                              setEditRule({
                                ...editRule,
                                actionParams: { ...editRule.actionParams, amount: value[0] },
                              })
                            }
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            min={-50}
                            max={50}
                            value={editRule.actionParams.amount || 0}
                            onChange={(e) =>
                              setEditRule({
                                ...editRule,
                                actionParams: { ...editRule.actionParams, amount: Number(e.target.value) },
                              })
                            }
                            className="w-20"
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {editRule.action === "tag" && (
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label>Tag to Apply</Label>
                        <Select
                          value={editRule.actionParams.tagId}
                          onValueChange={(value) =>
                            setEditRule({
                              ...editRule,
                              actionParams: { ...editRule.actionParams, tagId: value },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select tag" />
                          </SelectTrigger>
                          <SelectContent>
                            {tags
                              .filter((tag) => tag.type === "status")
                              .map((tag) => (
                                <SelectItem key={tag.id} value={tag.id}>
                                  <div className="flex items-center">
                                    <Tag className="h-4 w-4 mr-2" />
                                    {tag.name}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {tags.filter((tag) => tag.type === "status").length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No status tags available. Create status tags in the tag management page.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {(editRule.action === "schedule" ||
                    editRule.action === "maintenance" ||
                    editRule.action === "inspection") && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Schedule Title</Label>
                          <Input
                            placeholder="Enter schedule title"
                            value={editRule.actionParams.scheduleTitle}
                            onChange={(e) =>
                              setEditRule({
                                ...editRule,
                                actionParams: { ...editRule.actionParams, scheduleTitle: e.target.value },
                              })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Description</Label>
                          <Textarea
                            placeholder="Enter schedule description"
                            value={editRule.actionParams.scheduleDescription}
                            onChange={(e) =>
                              setEditRule({
                                ...editRule,
                                actionParams: { ...editRule.actionParams, scheduleDescription: e.target.value },
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Category</Label>
                        <Select
                          value={editRule.actionParams.scheduleCategory}
                          onValueChange={(value) =>
                            setEditRule({
                              ...editRule,
                              actionParams: { ...editRule.actionParams, scheduleCategory: value },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {scheduleCategories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center">
                                  {getScheduleCategoryIcon(category.id)}
                                  {category.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Priority</Label>
                        <Select
                          value={editRule.actionParams.schedulePriority}
                          onValueChange={(value) =>
                            setEditRule({
                              ...editRule,
                              actionParams: { ...editRule.actionParams, schedulePriority: value },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {editRule.action === "progress" && (
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label>Select Schedule</Label>
                        <Select
                          value={editRule.actionParams.scheduleId || ""}
                          onValueChange={(value) =>
                            setEditRule({
                              ...editRule,
                              actionParams: { ...editRule.actionParams, scheduleId: value },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a schedule" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spring-expansion">Spring Expansion</SelectItem>
                            <SelectItem value="summer-extraction">Summer Extraction</SelectItem>
                            <SelectItem value="curing-treatment">Curing & Treatment</SelectItem>
                            <SelectItem value="winter-preparation">Winter Preparation</SelectItem>
                            <SelectItem value="inspection">Inspection</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Target Value (100% Progress)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Enter target value"
                            value={editRule.actionParams.targetValue || ""}
                            onChange={(e) =>
                              setEditRule({
                                ...editRule,
                                actionParams: { ...editRule.actionParams, targetValue: Number(e.target.value) },
                              })
                            }
                          />
                          {editRule.initiators[0]?.type && (
                            <span className="text-muted-foreground">
                              {initiatorTypes.find((m) => m.id === editRule.initiators[0].type)?.unit}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          When this value is reached, the schedule will be marked as 100% complete.
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label>Progress Calculation</Label>
                        <Select
                          value={editRule.actionParams.progressType || "linear"}
                          onValueChange={(value) =>
                            setEditRule({
                              ...editRule,
                              actionParams: { ...editRule.actionParams, progressType: value },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select calculation method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="linear">Linear (Direct Percentage)</SelectItem>
                            <SelectItem value="threshold">Threshold (All or Nothing)</SelectItem>
                            <SelectItem value="incremental">Incremental (Add to Current)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          {editRule.actionParams.progressType === "linear" &&
                            "Linear: Progress is calculated as a direct percentage of the current value compared to the target."}
                          {editRule.actionParams.progressType === "threshold" &&
                            "Threshold: Schedule is marked 100% complete when target is reached, 0% otherwise."}
                          {editRule.actionParams.progressType === "incremental" &&
                            "Incremental: Adds a percentage to the current progress each time the rule is triggered."}
                        </p>
                      </div>

                      {editRule.actionParams.progressType === "incremental" && (
                        <div className="grid gap-2">
                          <Label>Increment Amount (%)</Label>
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[editRule.actionParams.incrementAmount || 10]}
                              min={1}
                              max={100}
                              step={1}
                              onValueChange={(value) =>
                                setEditRule({
                                  ...editRule,
                                  actionParams: { ...editRule.actionParams, incrementAmount: value[0] },
                                })
                              }
                            />
                            <span className="w-12 text-center font-medium">
                              {editRule.actionParams.incrementAmount || 10}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Apply To */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Rule Priority</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Lowest</span>
                        <Slider
                          value={[editRule.priority]}
                          min={1}
                          max={10}
                          step={1}
                          onValueChange={(value) => setEditRule({ ...editRule, priority: value[0] })}
                          className="flex-1"
                        />
                        <span className="text-sm">Highest</span>
                        <span className="w-8 text-center font-medium">{editRule.priority}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Higher priority rules (10) will override lower priority rules (1) when conflicts occur.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="active"
                        checked={editRule.isActive}
                        onCheckedChange={(checked) => setEditRule({ ...editRule, isActive: !!checked })}
                      />
                      <Label htmlFor="active">Active</Label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handlePreviousStep}>
              {currentStep === 1 ? "Cancel" : "Back"}
            </Button>
            <Button onClick={handleNextStep}>{currentStep < totalSteps ? "Next" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Rule Dialog */}
      <Dialog open={isDeleteRuleDialogOpen} onOpenChange={setIsDeleteRuleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this rule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteRuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRule}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Rule Set Dialog */}
      <Dialog open={isDeleteRuleSetDialogOpen} onOpenChange={setIsDeleteRuleSetDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Rule Set</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this rule set? This action cannot be undone. Rules in this set will not be
              deleted, but they will no longer be part of any set.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteRuleSetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRuleSet}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Set Dialog */}
      <Dialog open={isEditRuleSetDialogOpen} onOpenChange={setIsEditRuleSetDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Rule Set</DialogTitle>
            <DialogDescription>Update the rule set details.</DialogDescription>
          </DialogHeader>
          {ruleSetToEdit && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Rule Set Name</Label>
                <Input
                  id="edit-name"
                  placeholder="Enter rule set name"
                  value={ruleSetToEdit.name}
                  onChange={(e) => setRuleSetToEdit({ ...ruleSetToEdit, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  placeholder="Enter rule set description"
                  value={ruleSetToEdit.description}
                  onChange={(e) => setRuleSetToEdit({ ...ruleSetToEdit, description: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  checked={ruleSetToEdit.isActive}
                  onCheckedChange={(checked) => setRuleSetToEdit({ ...ruleSetToEdit, isActive: checked })}
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditRuleSetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRuleSet}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Rules Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Export Rules</DialogTitle>
            <DialogDescription>Select the rules and rule sets you want to export.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="export-search">Search</Label>
              <Input
                id="export-search"
                placeholder="Search rules and rule sets"
                value={searchExport}
                onChange={(e) => setSearchExport(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Rules</h3>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleAllRulesToExport(true)}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleAllRulesToExport(false)}>
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                {filteredRulesToExport.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rules found.</p>
                ) : (
                  filteredRulesToExport.map((rule) => (
                    <div key={rule.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`export-rule-${rule.id}`}
                        checked={selectedRulesToExport[rule.id] || false}
                        onCheckedChange={(checked) =>
                          setSelectedRulesToExport({ ...selectedRulesToExport, [rule.id]: !!checked })
                        }
                      />
                      <Label htmlFor={`export-rule-${rule.id}`} className="cursor-pointer">
                        {rule.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Rule Sets</h3>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleAllRuleSetsToExport(true)}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleAllRuleSetsToExport(false)}>
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                {filteredRuleSetsToExport.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rule sets found.</p>
                ) : (
                  filteredRuleSetsToExport.map((ruleSet) => (
                    <div key={ruleSet.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`export-ruleset-${ruleSet.id}`}
                        checked={selectedRuleSetsToExport[ruleSet.id] || false}
                        onCheckedChange={(checked) =>
                          setSelectedRuleSetsToExport({ ...selectedRuleSetsToExport, [ruleSet.id]: !!checked })
                        }
                      />
                      <Label htmlFor={`export-ruleset-${ruleSet.id}`} className="cursor-pointer">
                        {ruleSet.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={executeExport}>Export Selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Rules Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Import Rules</DialogTitle>
            <DialogDescription>Select the rules and rule sets you want to import.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="import-search">Search</Label>
              <Input
                id="import-search"
                placeholder="Search rules and rule sets"
                value={searchImport}
                onChange={(e) => setSearchImport(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Rules</h3>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleAllRulesToImport(true)}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleAllRulesToImport(false)}>
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                {filteredRulesToImport.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rules found in the imported file.</p>
                ) : (
                  filteredRulesToImport.map((rule) => (
                    <div key={rule.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`import-rule-${rule.id}`}
                        checked={selectedRulesToImport[rule.id] || false}
                        onCheckedChange={(checked) =>
                          setSelectedRulesToImport({ ...selectedRulesToImport, [rule.id]: !!checked })
                        }
                      />
                      <Label htmlFor={`import-rule-${rule.id}`} className="cursor-pointer">
                        {rule.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Rule Sets</h3>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleAllRuleSetsToImport(true)}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleAllRuleSetsToImport(false)}>
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                {filteredRuleSetsToImport.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rule sets found in the imported file.</p>
                ) : (
                  filteredRuleSetsToImport.map((ruleSet) => (
                    <div key={ruleSet.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`import-ruleset-${ruleSet.id}`}
                        checked={selectedRuleSetsToImport[ruleSet.id] || false}
                        onCheckedChange={(checked) =>
                          setSelectedRuleSetsToImport({ ...selectedRuleSetsToImport, [ruleSet.id]: !!checked })
                        }
                      />
                      <Label htmlFor={`import-ruleset-${ruleSet.id}`} className="cursor-pointer">
                        {ruleSet.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false)
                setImportedData(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={executeImport} disabled={!importedData}>
              Import Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
