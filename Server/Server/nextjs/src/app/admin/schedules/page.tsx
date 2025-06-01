"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Checkbox } from "~/components/ui/checkbox"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Switch } from "~/components/ui/switch"
import { Progress } from "~/components/ui/progress"
import {
  Plus,
  Trash,
  Edit,
  ChevronDown,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  CloudRain,
  Save,
  ArrowRight,
  ArrowLeft,
  Calendar,
  CalendarDays,
  Sprout,
  Snowflake,
  Flame,
  Leaf,
  Wifi,
  AlertTriangle,
  Filter,
  ChevronUp,
  Eye,
  Beaker,
  Droplet,
  Check,
  X,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FlaskRoundIcon as Flask,
  Utensils,
  Wrench,
  User,
  CheckCircle,
} from "lucide-react"
import { useToast } from "~/hooks/use-toast"
import { Badge } from "~/components/ui/badge"
import { Calendar as CalendarComponent } from "~/components/ui/calendar"
import {
  format,
  isSameDay,
  isToday,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isSameMonth,
  parseISO,
  isWithinInterval,
  isBefore,
} from "date-fns"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { fetchBeehives, fetchGroups, fetchSchedules, createSchedule, updateSchedule, deleteSchedule } from "./apis"

import { useSession } from "next-auth/react"

// Schedule categories with consistent styling
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

// Condition types for dynamic triggers
const conditionTypes = [
  { id: "temperature", name: "Temperature", unit: "°C", icon: Thermometer },
  { id: "humidity", name: "Humidity", unit: "%", icon: Droplets },
  { id: "rainfall", name: "Rainfall", unit: "mm", icon: CloudRain },
  { id: "wind", name: "Wind Speed", unit: "m/s", icon: Wind },
]

// Condition operators
const conditionOperators = [
  { id: "above", name: "Above", symbol: ">", description: "Value is above threshold" },
  { id: "below", name: "Below", symbol: "<", description: "Value is below threshold" },
  { id: "equal", name: "Equal To", symbol: "=", description: "Value is equal to threshold" },
  { id: "aboveEqual", name: "Above or Equal", symbol: ">=", description: "Value is above or equal to threshold" },
  { id: "belowEqual", name: "Below or Equal", symbol: "<=", description: "Value is below or equal to threshold" },
  { id: "observed", name: "Observed", symbol: "✓", description: "Condition is observed" },
]

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [beehives, setBeehives] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null)
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [totalSteps, setTotalSteps] = useState(3)
  const [calendarView, setCalendarView] = useState<"month" | "agenda">("month")
  const [showFilters, setShowFilters] = useState(false)
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterPriority, setFilterPriority] = useState("all")
  const [filterBeehive, setFilterBeehive] = useState("all")
  const { data: session, status } = useSession()

  const { toast } = useToast()

  const [newSchedule, setNewSchedule] = useState({
    name: "",
    description: "",
    category: "",
    season: "",
    dueDate: "",
    status: "pending",
    progress: 0,
    assignedGroups: [] as string[],
    priority: "",
    conditions: [] as any[],
    recommendations: [] as string[],
    notes: "",
    completionDate: "",
  })
  useEffect(() => {
    console.log("Selected Schedule changed:", selectedSchedule)
  }, [selectedSchedule])
  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      if (status === "authenticated" && session) {
        // Ensure session is loaded
        try {
          setLoading(true)
          const [schedulesData, beehivesData, groupsData] = await Promise.all([
            fetchSchedules(session), // Pass session
            fetchBeehives(session), // Pass session
            fetchGroups(session), // Pass session
          ])
          setSchedules(schedulesData)
          setBeehives(beehivesData)
          setGroups(groupsData)
        } catch (error) {
          console.error("Error fetching data:", error)
          toast({
            title: "Error",
            description: error.message || "Failed to load data. Please try again.", // Use error message
            variant: "destructive",
          })
        } finally {
          setLoading(false)
        }
      } else if (status === "loading") {
        // Optionally handle loading state
        setLoading(true)
      } else {
        // Handle unauthenticated state if necessary
        setLoading(false)
        toast({ title: "Unauthorized", description: "Please log in.", variant: "destructive" })
      }
    }

    fetchData()
  }, [session, status, toast])

  // Update current date every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Get in-progress schedules for the notification area
  const getInProgressSchedules = () => {
    return schedules.filter((schedule) => schedule.status === "in-progress").sort((a, b) => b.progress - a.progress)
  }

  // Get schedules for a specific date
  const getSchedulesForDate = (date: Date) => {
    return schedules.filter((schedule) => {
      if (!schedule.dueDate) return false
      const scheduleDate = parseISO(schedule.dueDate)
      return isSameDay(scheduleDate, date)
    })
  }

  // Get schedules for the current month view
  const getSchedulesForMonth = () => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)

    return schedules.filter((schedule) => {
      if (!schedule.dueDate) return false
      const scheduleDate = parseISO(schedule.dueDate)
      return isWithinInterval(scheduleDate, { start, end })
    })
  }

  // Get days with schedules for the current month
  const getDaysWithSchedules = () => {
    const monthSchedules = getSchedulesForMonth()
    const daysWithSchedules: Record<string, number> = {}

    monthSchedules.forEach((schedule) => {
      if (schedule.dueDate) {
        const dateStr = schedule.dueDate
        daysWithSchedules[dateStr] = (daysWithSchedules[dateStr] || 0) + 1
      }
    })

    return daysWithSchedules
  }

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  // Navigate to today
  const goToToday = () => {
    setCurrentMonth(new Date())
    setSelectedDate(new Date())
  }

  // Handle adding a new schedule
  const handleAddSchedule = async () => {
    if (
      !newSchedule.name ||
      !newSchedule.category ||
      !newSchedule.season ||
      !newSchedule.dueDate ||
      !newSchedule.priority ||
      newSchedule.assignedGroups.length === 0
    ) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    try {
      const newScheduleData = {
        ...newSchedule,
        createdAt: new Date().toISOString().split("T")[0],
        lastModified: new Date().toISOString().split("T")[0],
      }

      const createdSchedule = await createSchedule(newScheduleData, session)
      setSchedules([...schedules, createdSchedule])
      setIsAddDialogOpen(false)
      resetForm()
      console.log(newSchedule)
      toast({
        title: "Schedule added",
        description: `${newSchedule.name} has been added to the schedule.`,
      })
    } catch (error) {
      console.error("Error adding schedule:", error)
      toast({
        title: "Error",
        description: "Failed to add schedule. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle editing a schedule
  const handleEditSchedule = async () => {
    if (!selectedSchedule) return

    if (
      !selectedSchedule.name ||
      !selectedSchedule.category ||
      !selectedSchedule.season ||
      !selectedSchedule.dueDate ||
      !selectedSchedule.priority ||
      selectedSchedule.assignedGroups.length === 0
    ) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    try {
      const updatedSchedule = {
        ...selectedSchedule,
        lastModified: new Date().toISOString().split("T")[0],
      }

      await updateSchedule(updatedSchedule.id, updatedSchedule, session)
      setSchedules(schedules.map((schedule) => (schedule.id === selectedSchedule.id ? updatedSchedule : schedule)))
      setIsEditDialogOpen(false)
      setSelectedSchedule(null)

      toast({
        title: "Schedule updated",
        description: `${selectedSchedule.name} has been updated successfully.`,
      })
    } catch (error) {
      console.error("Error updating schedule:", error)
      toast({
        title: "Error",
        description: "Failed to update schedule. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle deleting a schedule
  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return

    try {
      await deleteSchedule(scheduleToDelete, session)
      setSchedules(schedules.filter((schedule) => schedule.id !== scheduleToDelete))
      setIsDeleteDialogOpen(false)
      setScheduleToDelete(null)

      toast({
        title: "Schedule deleted",
        description: "The schedule has been deleted from the system.",
      })
    } catch (error) {
      console.error("Error deleting schedule:", error)
      toast({
        title: "Error",
        description: "Failed to delete schedule. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Toggle schedule status
  const toggleScheduleStatus = async (scheduleId: string) => {
    const schedule = schedules.find((s) => s.id === scheduleId)
    if (!schedule) return

    try {
      const newStatus = schedule.status === "completed" ? "in-progress" : "completed"
      const completionDate = newStatus === "completed" ? new Date().toISOString().split("T")[0] : ""
      const progress = newStatus === "completed" ? 100 : schedule.progress

      const updatedSchedule = {
        ...schedule,
        status: newStatus,
        completionDate,
        progress,
        lastModified: new Date().toISOString().split("T")[0],
      }

      await updateSchedule(scheduleId, updatedSchedule, session)

      setSchedules(
        schedules.map((s) => {
          if (s.id === scheduleId) {
            return updatedSchedule
          }
          return s
        }),
      )

      toast({
        title: schedule.status === "completed" ? "Schedule marked as in progress" : "Schedule marked as completed",
        description: `${schedule.name} has been updated.`,
      })
    } catch (error) {
      console.error("Error updating schedule status:", error)
      toast({
        title: "Error",
        description: "Failed to update schedule status. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Update schedule progress
  const updateScheduleProgress = async (scheduleId: string, progress: number) => {
    const schedule = schedules.find((s) => s.id === scheduleId)
    if (!schedule) return

    try {
      const newStatus = progress >= 100 ? "completed" : progress > 0 ? "in-progress" : "pending"
      const completionDate = newStatus === "completed" ? new Date().toISOString().split("T")[0] : ""

      const updatedSchedule = {
        ...schedule,
        progress,
        status: newStatus,
        completionDate,
        lastModified: new Date().toISOString().split("T")[0],
      }

      await updateSchedule(scheduleId, updatedSchedule, session)

      setSchedules(
        schedules.map((s) => {
          if (s.id === scheduleId) {
            return updatedSchedule
          }
          return s
        }),
      )

      toast({
        title: "Progress updated",
        description: `Schedule progress has been updated to ${progress}%.`,
      })
    } catch (error) {
      console.error("Error updating schedule progress:", error)
      toast({
        title: "Error",
        description: "Failed to update schedule progress. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Reset form state
  const resetForm = () => {
    setCurrentStep(1)
    setNewSchedule({
      name: "",
      description: "",
      category: "",
      season: "",
      dueDate: "",
      status: "pending",
      progress: 0,
      assignedGroups: [],
      priority: "",
      conditions: [],
      recommendations: [],
      notes: "",
      completionDate: "",
    })

    setSelectedDate(new Date())
    setSelectedSchedule(null)
  }

  // Handle next step in schedule creation/editing
  const handleNextStep = () => {
    // Validate current step
    if (currentStep === 1) {
      const schedule = selectedSchedule || newSchedule
      if (
        !schedule.name ||
        !schedule.description ||
        !schedule.category ||
        !schedule.season ||
        !schedule.priority ||
        !schedule.dueDate
      ) {
        toast({
          title: "Missing information",
          description: "Please fill in all required fields.",
          variant: "destructive",
        })
        return
      }
    }

    if (currentStep === 2) {
      const schedule = selectedSchedule || newSchedule
      if (schedule.assignedGroups.length === 0) {
        toast({
          title: "Missing information",
          description: "Please assign this schedule to at least one beehive.",
          variant: "destructive",
        })
        return
      }
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      // Submit the form
      if (isEditDialogOpen) {
        handleEditSchedule()
      } else {
        handleAddSchedule()
      }
    }
  }

  // Handle previous step in schedule creation/editing
  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else {
      // Close the dialog
      if (isEditDialogOpen) {
        setIsEditDialogOpen(false)
        setSelectedSchedule(null)
      } else {
        setIsAddDialogOpen(false)
      }
      resetForm()
    }
  }

  // Add a condition
  const addCondition = () => {
    const newCondition = {
      type: "temperature",
      operator: "above",
      value: 0,
      unit: "°C",
      duration: 1,
      durationUnit: "days",
      groupId: groups.length > 0 ? groups[0].id : "",
    }
    console.log(selectedSchedule)
    if (selectedSchedule) {
      setSelectedSchedule({
        ...selectedSchedule,
        conditions: [...(selectedSchedule.conditions || []), newCondition],
      })
    } else {
      setNewSchedule({
        ...newSchedule,
        conditions: [...(newSchedule.conditions || []), newCondition],
      })
    }
  }

  // Remove a condition
  const removeCondition = (index: number) => {
    if (selectedSchedule) {
      const updatedConditions = [...selectedSchedule.conditions]
      updatedConditions.splice(index, 1)
      setSelectedSchedule({
        ...selectedSchedule,
        conditions: updatedConditions,
      })
    } else {
      const updatedConditions = [...newSchedule.conditions]
      updatedConditions.splice(index, 1)
      setNewSchedule({
        ...newSchedule,
        conditions: updatedConditions,
      })
    }
  }

  // Update a condition
  const updateCondition = (index: number, field: string, value: any) => {
    if (selectedSchedule) {
      const updatedConditions = [...(selectedSchedule.conditions || [])]
      if (!updatedConditions[index]) {
        updatedConditions[index] = {
          type: "temperature",
          operator: "above",
          value: 0,
          unit: "°C",
          duration: 1,
          durationUnit: "days",
          GroupId: "",
        }
      }
      updatedConditions[index] = { ...updatedConditions[index], [field]: value }

      // Update unit based on condition type
      if (field === "type") {
        const conditionType = conditionTypes.find((c) => c.id === value)
        if (conditionType) {
          updatedConditions[index].unit = conditionType.unit
        }
      }

      setSelectedSchedule({
        ...selectedSchedule,
        conditions: updatedConditions,
      })
    } else {
      const updatedConditions = [...(newSchedule.conditions || [])]
      if (!updatedConditions[index]) {
        updatedConditions[index] = {
          type: "temperature",
          operator: "above",
          value: 0,
          unit: "°C",
          duration: 1,
          durationUnit: "days",
          groupId: "",
        }
      }
      updatedConditions[index] = { ...updatedConditions[index], [field]: value }

      // Update unit based on condition type
      if (field === "type") {
        const conditionType = conditionTypes.find((c) => c.id === value)
        if (conditionType) {
          updatedConditions[index].unit = conditionType.unit
        }
      }

      setNewSchedule({
        ...newSchedule,
        conditions: updatedConditions,
      })
    }
  }

  // Add a recommendation
  const addRecommendation = () => {
    if (selectedSchedule) {
      setSelectedSchedule({
        ...selectedSchedule,
        recommendations: [...selectedSchedule.recommendations, ""],
      })
    } else {
      setNewSchedule({
        ...newSchedule,
        recommendations: [...newSchedule.recommendations, ""],
      })
    }
  }

  // Remove a recommendation
  const removeRecommendation = (index: number) => {
    if (selectedSchedule) {
      const updatedRecommendations = [...selectedSchedule.recommendations]
      updatedRecommendations.splice(index, 1)
      setSelectedSchedule({
        ...selectedSchedule,
        recommendations: updatedRecommendations,
      })
    } else {
      const updatedRecommendations = [...newSchedule.recommendations]
      updatedRecommendations.splice(index, 1)
      setNewSchedule({
        ...newSchedule,
        recommendations: updatedRecommendations,
      })
    }
  }

  // Update a recommendation
  const updateRecommendation = (index: number, value: string) => {
    if (selectedSchedule) {
      const updatedRecommendations = [...selectedSchedule.recommendations]
      updatedRecommendations[index] = value
      setSelectedSchedule({
        ...selectedSchedule,
        recommendations: updatedRecommendations,
      })
    } else {
      const updatedRecommendations = [...newSchedule.recommendations]
      updatedRecommendations[index] = value
      setNewSchedule({
        ...newSchedule,
        recommendations: updatedRecommendations,
      })
    }
  }

  // Handle beehive selection
  const handleBeehiveSelection = (beehiveId: string, isAdding: boolean) => {
    try {
      if (isAdding) {
        if (selectedSchedule) {
          setSelectedSchedule((prevState) => ({
            ...prevState,
            assignedGroups: [...(prevState.assignedGroups || []), beehiveId],
          }))
        } else {
          setNewSchedule((prevState) => ({
            ...prevState,
            assignedGroups: [...(prevState.assignedGroups || []), beehiveId],
          }))
        }
      } else {
        if (selectedSchedule) {
          setSelectedSchedule((prevState) => ({
            ...prevState,
            assignedGroups: (prevState.assignedGroups || []).filter((id) => id !== beehiveId),
          }))
        } else {
          setNewSchedule((prevState) => ({
            ...prevState,
            assignedGroups: (prevState.assignedGroups || []).filter((id) => id !== beehiveId),
          }))
        }
      }
    } catch (error) {
      console.error("Error handling beehive selection:", error)
      toast({
        title: "Error",
        description: "There was a problem updating beehive selection. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Get priority badge variant
  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive"
      case "medium":
        return "warning"
      case "low":
        return "outline"
      default:
        return "outline"
    }
  }

  // Get season badge variant
  const getSeasonBadgeVariant = (season: string) => {
    switch (season) {
      case "spring":
        return "default"
      case "summer":
        return "warning"
      case "fall":
        return "destructive"
      case "winter":
        return "secondary"
      default:
        return "outline"
    }
  }

  // Get season icon
  const getSeasonIcon = (season: string) => {
    switch (season) {
      case "spring":
        return <Sprout className="h-4 w-4 mr-2" />
      case "summer":
        return <Sun className="h-4 w-4 mr-2" />
      case "fall":
        return <Leaf className="h-4 w-4 mr-2" />
      case "winter":
        return <Snowflake className="h-4 w-4 mr-2" />
      default:
        return <Calendar className="h-4 w-4 mr-2" />
    }
  }

  // Get category icon and color
  const getCategoryInfo = (categoryId: string) => {
    const category = scheduleCategories.find((c) => c.id === categoryId)
    if (!category)
      return {
        icon: Calendar,
        color: "bg-gray-500",
        textColor: "text-gray-500",
        borderColor: "border-gray-500",
        lightBg: "bg-gray-50",
      }
    return {
      icon: category.icon,
      color: category.color,
      textColor: category.textColor,
      borderColor: category.borderColor,
      lightBg: category.lightBg,
    }
  }

  // Format condition for display
  const formatCondition = (condition: any) => {
    const conditionType = conditionTypes.find((c) => c.id === condition.type)
    const operator = conditionOperators.find((o) => o.id === condition.operator)

    if (!conditionType || !operator) return "Invalid condition"

    if (operator.id === "observed") {
      return `${conditionType.name} is observed: ${condition.value}`
    }

    return `${conditionType.name} ${operator.symbol} ${condition.value}${condition.unit} for ${condition.duration} ${condition.durationUnit}`
  }

  // Get condition type icon
  const getConditionTypeIcon = (type: string) => {
    const conditionType = conditionTypes.find((c) => c.id === type)
    if (!conditionType) return null

    const Icon = conditionType.icon
    return <Icon className="h-4 w-4 mr-2" />
  }

  // Check if a schedule is due soon (within 7 days)
  const isScheduleDueSoon = (schedule: any) => {
    if (!schedule.dueDate) return false

    const dueDate = parseISO(schedule.dueDate)
    const today = new Date()

    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays >= 0 && diffDays <= 7
  }

  // Check if a schedule is overdue
  const isScheduleOverdue = (schedule: any) => {
    if (!schedule.dueDate || schedule.status === "completed") return false

    const dueDate = parseISO(schedule.dueDate)
    const today = new Date()

    return isBefore(dueDate, today)
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return ""

    const date = parseISO(dateString)
    return format(date, "MMM d, yyyy")
  }

  // Apply filters to schedules
  const getFilteredSchedules = () => {
    return schedules.filter((schedule) => {
      // Filter by category
      if (filterCategory !== "all" && schedule.category !== filterCategory) {
        return false
      }

      // Filter by priority
      if (filterPriority !== "all" && schedule.priority !== filterPriority) {
        return false
      }

      // Filter by beehive
      if (filterBeehive !== "all" && !schedule.assignedGroups.includes(filterBeehive)) {
        return false
      }

      return true
    })
  }

  // Generate calendar days for month view
  const generateCalendarDays = () => {
    if (!currentMonth) return []

    const firstDayOfMonth = startOfMonth(currentMonth)
    const lastDayOfMonth = endOfMonth(currentMonth)

    // Get the first day of the first week (might be in previous month)
    const startDate = startOfWeek(firstDayOfMonth)
    // Get the last day of the last week (might be in next month)
    const endDate = endOfWeek(lastDayOfMonth)

    return eachDayOfInterval({ start: startDate, end: endDate })
  }

  // Get agenda days (next 30 days)
  const getAgendaDays = () => {
    const today = new Date()
    const thirtyDaysLater = addDays(today, 30)

    return eachDayOfInterval({ start: today, end: thirtyDaysLater })
  }

  const handleViewSchedule = (schedule: any) => {
    setSelectedSchedule(schedule)
    setIsViewDialogOpen(true)
  }

  const handleCompleteSchedule = (scheduleId: string) => {
    toggleScheduleStatus(scheduleId)
  }

  const handleAddDialogOpen = (open: boolean) => {
    setIsAddDialogOpen(open)
    if (!open) {
      resetForm()
    }
  }

  const handleEditDialogOpen = (open: boolean) => {
    setIsEditDialogOpen(open)
    if (!open) {
      setSelectedSchedule(null)
      resetForm()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading schedules...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Schedule Calendar</h1>
        <div className="flex flex-col items-end">
          <div className="text-2xl font-semibold">
            {currentDate.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="text-sm text-muted-foreground">
            {currentDate.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      {/* In-Progress Schedules Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">In Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules
            .filter((schedule) => schedule.status === "in-progress")
            .map((schedule) => {
              // Calculate days remaining
              const startDate = new Date(schedule.createdAt)
              const endDate = new Date(schedule.dueDate)
              const today = new Date()
              const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
              const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
              const progress = schedule.progress || 0

              // Get category-specific styling
              const getCategoryColor = (category) => {
                switch (category) {
                  case "inspection":
                    return {
                      bg: "bg-blue-100 dark:bg-blue-900",
                      text: "text-blue-800 dark:text-blue-200",
                      border: "border-blue-200 dark:border-blue-800",
                      progressBg: "bg-blue-200 dark:bg-blue-800",
                      progressFill: "bg-blue-500",
                      icon: <ClipboardCheck className="h-5 w-5 text-blue-500 dark:text-blue-400" />,
                    }
                  case "treatment":
                    return {
                      bg: "bg-green-100 dark:bg-green-900",
                      text: "text-green-800 dark:text-green-200",
                      border: "border-green-200 dark:border-green-800",
                      progressBg: "bg-green-200 dark:bg-green-800",
                      progressFill: "bg-green-500",
                      icon: <Flask className="h-5 w-5 text-green-500 dark:text-green-400" />,
                    }
                  case "summer-extraction":
                    return {
                      bg: "bg-amber-100 dark:bg-amber-900",
                      text: "text-amber-800 dark:text-amber-200",
                      border: "border-amber-200 dark:border-amber-800",
                      progressBg: "bg-amber-200 dark:bg-amber-800",
                      progressFill: "bg-amber-500",
                      icon: <Utensils className="h-5 w-5 text-amber-500 dark:text-amber-400" />,
                    }
                  case "winter-preparation":
                    return {
                      bg: "bg-purple-100 dark:bg-purple-900",
                      text: "text-purple-800 dark:text-purple-200",
                      border: "border-purple-200 dark:border-purple-800",
                      progressBg: "bg-purple-200 dark:bg-purple-800",
                      progressFill: "bg-purple-500",
                      icon: <Wrench className="h-5 w-5 text-purple-500 dark:text-purple-400" />,
                    }
                  default:
                    return {
                      bg: "bg-gray-100 dark:bg-gray-800",
                      text: "text-gray-800 dark:text-gray-200",
                      border: "border-gray-200 dark:border-gray-700",
                      progressBg: "bg-gray-200 dark:bg-gray-700",
                      progressFill: "bg-gray-500",
                      icon: <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400" />,
                    }
                }
              }

              const categoryStyle = getCategoryColor(schedule.category)

              return (
                <Card
                  key={schedule.id}
                  className={`${categoryStyle.border} border-2 overflow-hidden hover:shadow-md transition-shadow`}
                >
                  <CardContent className="p-0">
                    <div className={`${categoryStyle.bg} p-4`}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center">
                          {categoryStyle.icon}
                          <span className={`ml-2 font-medium ${categoryStyle.text}`}>{schedule.name}</span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewSchedule(schedule)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedSchedule(schedule)
                                setCurrentStep(1)
                                setIsEditDialogOpen(true)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCompleteSchedule(schedule.id)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark as Completed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setScheduleToDelete(schedule.id)
                                setIsDeleteDialogOpen(true)
                              }}
                              className="text-destructive"
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Delete Schedule
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="text-sm mb-2 flex items-center">
                        <Calendar className="h-4 w-4 mr-1 opacity-70" />
                        <span className={categoryStyle.text}>
                          {format(new Date(schedule.createdAt), "MMM d")} -{" "}
                          {format(new Date(schedule.dueDate), "MMM d, yyyy")}
                        </span>
                      </div>

                      {schedule.assignedGroups && (
                        <div className="text-sm mb-3 flex items-center">
                          <User className="h-4 w-4 mr-1 opacity-70" />
                          <span className={categoryStyle.text}>{schedule.assignedGroups.length} Beehives</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className={categoryStyle.text}>Progress</span>
                          <span className={`font-medium ${categoryStyle.text}`}>{schedule.progress}%</span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${categoryStyle.progressBg} overflow-hidden`}>
                          <div
                            className={`h-full rounded-full ${categoryStyle.progressFill}`}
                            style={{ width: `${schedule.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          {schedules.filter((schedule) => schedule.status === "in-progress").length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground bg-muted/50 rounded-lg">
              No schedules currently in progress.
            </div>
          )}
        </div>
      </div>

      {/* Calendar controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-medium">{format(currentMonth, "MMMM yyyy")}</div>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant={calendarView === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setCalendarView("month")}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Month
          </Button>
          <Button
            variant={calendarView === "agenda" ? "default" : "outline"}
            size="sm"
            onClick={() => setCalendarView("agenda")}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Agenda
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {showFilters ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Add New Schedule</DialogTitle>
                <DialogDescription>
                  Step {currentStep} of {totalSteps}:{" "}
                  {currentStep === 1
                    ? "Basic Information"
                    : currentStep === 2
                      ? "Assign Beehives"
                      : "Recommendations & Notes"}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh]">
                <div className="space-y-4 py-4 px-1">
                  {/* Step 1: Basic Information */}
                  {currentStep === 1 && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="name">Schedule Name</Label>
                        <Input
                          id="name"
                          placeholder="Enter schedule name"
                          value={newSchedule.name}
                          onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          placeholder="Enter schedule description"
                          value={newSchedule.description}
                          onChange={(e) => setNewSchedule({ ...newSchedule, description: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">Schedule Category</Label>
                        <Select onValueChange={(value) => setNewSchedule({ ...newSchedule, category: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {scheduleCategories.map((category) => (
                              <SelectItem key={category.id} value={category.id ? category.id : "default"}>
                                <div className="flex items-center">
                                  <category.icon className="mr-2 h-4 w-4" />
                                  {category.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="season">Season</Label>
                          <Select onValueChange={(value) => setNewSchedule({ ...newSchedule, season: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select season" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="spring">Spring</SelectItem>
                              <SelectItem value="summer">Summer</SelectItem>
                              <SelectItem value="fall">Fall</SelectItem>
                              <SelectItem value="winter">Winter</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="priority">Priority</Label>
                          <Select onValueChange={(value) => setNewSchedule({ ...newSchedule, priority: value })}>
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
                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Due Date</Label>
                        <div className="border rounded-md p-3">
                          <CalendarComponent
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              setSelectedDate(date)
                              if (date) {
                                setNewSchedule({ ...newSchedule, dueDate: format(date, "yyyy-MM-dd") })
                              }
                            }}
                            className="mx-auto"
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Conditions (Optional)</Label>
                          <Button variant="outline" size="sm" onClick={addCondition}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Condition
                          </Button>
                        </div>

                        {newSchedule.conditions.length > 0 && (
                          <div className="space-y-4">
                            {newSchedule.conditions.map((condition, index) => (
                              <Card key={index} className="relative">
                                <CardHeader className="pb-2">
                                  <div className="absolute top-2 right-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeCondition(index)}
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <CardTitle className="text-base flex items-center">
                                    {getConditionTypeIcon(condition.type)}
                                    Condition {index + 1}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 pb-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Condition Type</Label>
                                      <Select
                                        value={condition.type}
                                        onValueChange={(value) => updateCondition(index, "type", value)}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {conditionTypes.map((type) => (
                                            <SelectItem key={type.id} value={type.id}>
                                              <div className="flex items-center">
                                                <type.icon className="mr-2 h-4 w-4" />
                                                {type.name}
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Operator</Label>
                                      <Select
                                        value={condition.operator}
                                        onValueChange={(value) => updateCondition(index, "operator", value)}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select operator" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {conditionOperators.map((op) => (
                                            <SelectItem key={op.id} value={op.id}>
                                              <div className="flex items-center">
                                                <span className="font-mono mr-2">{op.symbol}</span>
                                                {op.name}
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Value</Label>
                                      {condition.operator === "observed" ? (
                                        <Input
                                          placeholder="Enter observation"
                                          value={condition.value}
                                          onChange={(e) => updateCondition(index, "value", e.target.value)}
                                        />
                                      ) : (
                                        <div className="flex items-center space-x-2">
                                          <Input
                                            type="number"
                                            placeholder="Enter value"
                                            value={condition.value}
                                            onChange={(e) => updateCondition(index, "value", Number(e.target.value))}
                                          />
                                          {condition.unit && (
                                            <span className="text-sm text-muted-foreground w-10">{condition.unit}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {condition.operator !== "observed" && (
                                      <div className="space-y-2">
                                        <Label>Duration</Label>
                                        <div className="flex items-center space-x-2">
                                          <Input
                                            type="number"
                                            placeholder="Duration"
                                            value={condition.duration}
                                            onChange={(e) => updateCondition(index, "duration", Number(e.target.value))}
                                          />
                                          <Select
                                            value={condition.durationUnit}
                                            onValueChange={(value) => updateCondition(index, "durationUnit", value)}
                                          >
                                            <SelectTrigger className="w-24">
                                              <SelectValue placeholder="Unit" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="hours">Hours</SelectItem>
                                              <SelectItem value="days">Days</SelectItem>
                                              <SelectItem value="weeks">Weeks</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Group</Label>
                                    <Select
                                      value={condition.groupId}
                                      onValueChange={(value) => updateCondition(index, "groupId", value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select group for monitoring" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {groups.map((station) => (
                                          <SelectItem key={station.id} value={station.id}>
                                            {station.name} ({station.location})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Step 2: Assign Beehives */}
                  {currentStep === 2 && (
                    <>
                      <div className="space-y-2">
                        <Label>Assign to Beehives</Label>
                        {beehives.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground border rounded-md">
                            No beehives available. Please add beehives first.
                          </div>
                        ) : (
                          <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                            {beehives.map((beehive) => (
                              <div key={beehive.id} className="flex items-center space-x-2 py-1">
                                <Checkbox
                                  id={`beehive-${beehive.id}`}
                                  checked={(newSchedule.assignedGroups || []).includes(beehive.id)}
                                  onCheckedChange={(checked) => {
                                    try {
                                      handleBeehiveSelection(beehive.id, !!checked)
                                    } catch (error) {
                                      console.error("Error in checkbox change:", error)
                                    }
                                  }}
                                />
                                <Label htmlFor={`beehive-${beehive.id}`} className="flex-1">
                                  <div className="font-medium">{beehive.name}</div>
                                  <div className="text-xs text-muted-foreground">{beehive.location}</div>
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Step 3: Recommendations & Notes */}
                  {currentStep === 3 && (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Recommendations</Label>
                          <Button variant="outline" size="sm" onClick={addRecommendation}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Recommendation
                          </Button>
                        </div>

                        {newSchedule.recommendations.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground border rounded-md">
                            No recommendations added. Add recommendations to guide beekeepers.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {newSchedule.recommendations.map((recommendation, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <Input
                                  value={recommendation}
                                  onChange={(e) => updateRecommendation(index, e.target.value)}
                                  placeholder={`Recommendation ${index + 1}`}
                                  className="flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeRecommendation(index)}
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          placeholder="Enter additional notes"
                          value={newSchedule.notes}
                          onChange={(e) => setNewSchedule({ ...newSchedule, notes: e.target.value })}
                          className="min-h-[100px]"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="active"
                          checked={newSchedule.status === "in-progress"}
                          onCheckedChange={(checked) =>
                            setNewSchedule({
                              ...newSchedule,
                              status: checked ? "in-progress" : "pending",
                              progress: checked ? 10 : 0,
                            })
                          }
                        />
                        <Label htmlFor="active">Start as In Progress</Label>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter className="flex justify-between">
                <Button variant="outline" onClick={handlePreviousStep}>
                  {currentStep === 1 ? (
                    "Cancel"
                  ) : (
                    <>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </>
                  )}
                </Button>
                <Button onClick={handleNextStep}>
                  {currentStep === totalSteps ? (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Schedule
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center mb-2">Category:</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {scheduleCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center">
                        <category.icon className="mr-2 h-4 w-4" />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center mb-2">Priority:</Label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center mb-2">Beehive:</Label>
              <Select value={filterBeehive} onValueChange={setFilterBeehive}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by beehive" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Beehives</SelectItem>
                  {beehives.map((beehive) => (
                    <SelectItem key={beehive.id} value={beehive.id}>
                      {beehive.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Calendar View */}
      {calendarView === "month" ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Calendar header */}
            <div className="grid grid-cols-7 bg-muted/50">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 auto-rows-fr">
              {generateCalendarDays().map((day, i) => {
                const dateStr = format(day, "yyyy-MM-dd")
                const isCurrentMonthDay = isSameMonth(day, currentMonth)
                const isTodays = isToday(day)
                const daySchedules = getSchedulesForDate(day)
                const filteredDaySchedules = daySchedules.filter((schedule) => {
                  if (filterCategory !== "all" && schedule.category !== filterCategory) return false
                  if (filterPriority !== "all" && schedule.priority !== filterPriority) return false
                  if (filterBeehive !== "all" && !schedule.assignedGroups.includes(filterBeehive)) return false
                  return true
                })

                return (
                  <div
                    key={i}
                    className={`min-h-[100px] border p-1 ${
                      isCurrentMonthDay ? "bg-background" : "bg-muted/20 text-muted-foreground"
                    } ${isTodays ? "ring-2 ring-primary ring-inset" : ""}`}
                    onClick={() => {
                      setSelectedDate(day)
                      if (filteredDaySchedules.length === 0) {
                        setNewSchedule({
                          ...newSchedule,
                          dueDate: format(day, "yyyy-MM-dd"),
                        })
                        setIsAddDialogOpen(true)
                      }
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium ${
                          isTodays ? "bg-primary text-primary-foreground" : ""
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                      {filteredDaySchedules.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {filteredDaySchedules.length}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1 space-y-1">
                      {filteredDaySchedules.slice(0, 3).map((schedule) => {
                        const { color, icon: CategoryIcon } = getCategoryInfo(schedule.category)
                        return (
                          <div
                            key={schedule.id}
                            className={`text-xs p-1 rounded flex items-center cursor-pointer ${
                              schedule.status === "completed" ? "opacity-60" : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewSchedule(schedule)
                            }}
                          >
                            <div className={`${color} w-2 h-2 rounded-full mr-1 flex-shrink-0`}></div>
                            <span className="truncate">{schedule.name}</span>
                          </div>
                        )
                      })}
                      {filteredDaySchedules.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-3">
                          +{filteredDaySchedules.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        // Agenda view
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle>Upcoming Schedule</CardTitle>
            <CardDescription>Next 30 days</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div>
              {getAgendaDays().map((day) => {
                const dateStr = format(day, "yyyy-MM-dd")
                const daySchedules = getSchedulesForDate(day)
                const filteredDaySchedules = daySchedules.filter((schedule) => {
                  if (filterCategory !== "all" && schedule.category !== filterCategory) return false
                  if (filterPriority !== "all" && schedule.priority !== filterPriority) return false
                  if (filterBeehive !== "all" && !schedule.assignedGroups.includes(filterBeehive)) return false
                  return true
                })

                if (filteredDaySchedules.length === 0) return null

                return (
                  <div key={dateStr} className="border-b last:border-b-0">
                    {/* iOS-style day header */}
                    <div className="sticky top-0 bg-background px-4 py-2 flex items-center border-b">
                      <div className="flex-1 flex items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                            isToday(day) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <span className="text-sm font-medium">{format(day, "d")}</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">
                            {format(day, "EEEE")}
                            {isToday(day) && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Today
                              </Badge>
                            )}
                          </h3>
                          <p className="text-xs text-muted-foreground">{format(day, "MMMM d, yyyy")}</p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {filteredDaySchedules.length} event{filteredDaySchedules.length !== 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* iOS-style events */}
                    <div className="px-4 py-2 space-y-2">
                      {filteredDaySchedules.map((schedule) => {
                        const {
                          icon: CategoryIcon,
                          color,
                          textColor,
                          borderColor,
                          lightBg,
                        } = getCategoryInfo(schedule.category)

                        return (
                          <div
                            key={schedule.id}
                            className={`flex items-center p-3 rounded-lg ${lightBg} ${
                              schedule.status === "completed" ? "opacity-60" : ""
                            }`}
                          >
                            <div className="flex-shrink-0 mr-3">
                              <div className={`${color} p-2 rounded-full`}>
                                <CategoryIcon className="h-4 w-4 text-white" />
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className={`font-medium truncate ${textColor}`}>{schedule.name}</h4>
                                <Badge
                                  variant={getPriorityBadgeVariant(schedule.priority)}
                                  className="ml-2 flex-shrink-0"
                                >
                                  {schedule.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{schedule.description}</p>

                              {schedule.status === "in-progress" && (
                                <div className="mt-1">
                                  <div className="flex justify-between items-center text-xs mb-1">
                                    <span className={`${textColor}`}>Progress: {schedule.progress}%</span>
                                  </div>
                                  <Progress value={schedule.progress} className="h-1" />
                                </div>
                              )}

                              <div className="flex items-center mt-1 text-xs text-muted-foreground">
                                <div className="flex flex-wrap gap-1">
                                  {schedule.assignedGroups.slice(0, 3).map((groupId) => {
                                    const beehive = beehives.find((b) => b.id === groupId)
                                    if (!beehive) return null

                                    return (
                                      <div
                                        key={beehive.id}
                                        className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary"
                                        title={beehive.name}
                                      >
                                        {beehive.name.substring(0, 1)}
                                      </div>
                                    )
                                  })}
                                  {schedule.assignedGroups.length > 3 && (
                                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                                      +{schedule.assignedGroups.length - 3}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center ml-2 space-x-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() => {
                                  handleViewSchedule(schedule)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() => toggleScheduleStatus(schedule.id)}
                              >
                                {schedule.status === "completed" ? (
                                  <X className="h-4 w-4" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setScheduleToDelete(schedule.id)
                                  setIsDeleteDialogOpen(true)
                                }}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {getAgendaDays().filter((day) => {
                const daySchedules = getSchedulesForDate(day)
                const filteredDaySchedules = daySchedules.filter((schedule) => {
                  if (filterCategory !== "all" && schedule.category !== filterCategory) return false
                  if (filterPriority !== "all" && schedule.priority !== filterPriority) return false
                  if (filterBeehive !== "all" && !schedule.assignedGroups.includes(filterBeehive)) return false
                  return true
                })
                return filteredDaySchedules.length > 0
              }).length === 0 && (
                <div className="py-12 text-center text-muted-foreground">No schedules found in the next 30 days</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Schedule Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          {selectedSchedule && (
            <>
              <DialogHeader>
                <div className="flex items-center">
                  <DialogTitle className="mr-2">{selectedSchedule.name}</DialogTitle>
                  <Badge variant={getPriorityBadgeVariant(selectedSchedule.priority)}>
                    {selectedSchedule.priority}
                  </Badge>
                  <Badge variant={getSeasonBadgeVariant(selectedSchedule.season)} className="ml-2 flex items-center">
                    {getSeasonIcon(selectedSchedule.season)}
                    {selectedSchedule.season.charAt(0).toUpperCase() + selectedSchedule.season.slice(1)}
                  </Badge>
                </div>
                <DialogDescription>{selectedSchedule.description}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-6 p-1">
                  <div className="grid grid-cols-2 gap-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Schedule Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Due Date:</span>
                          <span className="font-medium">
                            {formatDate(selectedSchedule.dueDate)}
                            {isScheduleOverdue(selectedSchedule) && " (Overdue)"}
                            {isScheduleDueSoon(selectedSchedule) && !isScheduleOverdue(selectedSchedule) && " (Soon)"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <span className="font-medium">
                            {selectedSchedule.status === "in-progress"
                              ? "In Progress"
                              : selectedSchedule.status.charAt(0).toUpperCase() + selectedSchedule.status.slice(1)}
                          </span>
                        </div>
                        {selectedSchedule.status === "in-progress" && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Progress:</span>
                            <span className="font-medium">{selectedSchedule.progress}%</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Created:</span>
                          <span className="font-medium">{formatDate(selectedSchedule.createdAt)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Modified:</span>
                          <span className="font-medium">{formatDate(selectedSchedule.lastModified)}</span>
                        </div>
                        {selectedSchedule.completionDate && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Completed:</span>
                            <span className="font-medium">{formatDate(selectedSchedule.completionDate)}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Assigned Beehives</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[150px]">
                          <div className="space-y-2">
                            {selectedSchedule.assignedGroups.length === 0 ? (
                              <div className="text-muted-foreground">No beehives assigned</div>
                            ) : (
                              selectedSchedule.assignedGroups.map((groupId) => {
                                const beehive = beehives.find((b) => b.id === groupId)
                                return beehive ? (
                                  <div key={beehive.id} className="flex items-center p-2 border rounded-md">
                                    <span className="text-primary mr-2">🐝</span>
                                    <div>
                                      <div className="font-medium">{beehive.name}</div>
                                      <div className="text-xs text-muted-foreground">{beehive.location}</div>
                                    </div>
                                  </div>
                                ) : null
                              })
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>

                  {selectedSchedule.conditions && selectedSchedule.conditions.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Conditions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {selectedSchedule.conditions.map((condition, index) => (
                            <div key={index} className="p-3 border rounded-md">
                              <div className="flex items-center mb-2">
                                <Badge variant="outline" className="mr-2 flex items-center">
                                  {getConditionTypeIcon(condition.type)}
                                  Condition {index + 1}
                                </Badge>
                                <span className="font-medium">{formatCondition(condition)}</span>
                              </div>

                              <div className="text-sm">
                                <div className="flex items-center text-muted-foreground">
                                  <Wifi className="h-4 w-4 mr-1" />
                                  Group: {groups.find((m) => m.id === condition.groupId)?.name || "None"}
                                </div>
                              </div>
                            </div>
                          ))}

                          {selectedSchedule.status === "in-progress" && (
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm">Progress:</span>
                                <span className="text-sm font-medium">{selectedSchedule.progress}%</span>
                              </div>
                              <Progress value={selectedSchedule.progress} className="h-2" />
                            </div>
                          )}

                          {selectedSchedule.groupId && (
                            <div className="flex items-center mt-2 text-sm">
                              <span className="text-muted-foreground mr-2">Primary Group: </span>
                              <span className="font-medium">
                                {groups.find((m) => m.id === selectedSchedule.groupId)?.name || "Unknown"}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 gap-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedSchedule.recommendations && selectedSchedule.recommendations.length > 0 ? (
                          <ul className="list-disc pl-5 space-y-2">
                            {selectedSchedule.recommendations.map((rec, index) => (
                              <li key={index}>{rec}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-muted-foreground">No recommendations provided</div>
                        )}
                      </CardContent>
                    </Card>

                    {selectedSchedule.notes && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-muted-foreground">{selectedSchedule.notes}</div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {selectedSchedule.status === "in-progress" && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Update Progress</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span>Current Progress: {selectedSchedule.progress}%</span>
                            <span>{selectedSchedule.progress === 100 ? "Completed" : "In Progress"}</span>
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {[0, 25, 50, 75, 100].map((value) => (
                              <Button
                                key={value}
                                variant={selectedSchedule.progress === value ? "default" : "outline"}
                                onClick={() => updateScheduleProgress(selectedSchedule.id, value)}
                              >
                                {value}%
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setIsViewDialogOpen(false)
                    setScheduleToDelete(selectedSchedule.id)
                    setIsDeleteDialogOpen(true)
                  }}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete Schedule
                </Button>
                <Button
                  onClick={() => {
                    setIsViewDialogOpen(false)
                    setSelectedDate(selectedSchedule.dueDate ? parseISO(selectedSchedule.dueDate) : undefined)
                    setCurrentStep(1)
                    setSelectedSchedule(selectedSchedule)
                    setIsEditDialogOpen(true)
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Schedule
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              Step {currentStep} of {totalSteps}:
              {currentStep === 1
                ? "Basic Information"
                : currentStep === 2
                  ? "Assign Beehives"
                  : "Recommendations & Notes"}
            </DialogDescription>
          </DialogHeader>
          {selectedSchedule && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 py-4 px-1">
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Schedule Name</Label>
                      <Input
                        id="edit-name"
                        value={selectedSchedule.name}
                        onChange={(e) => setSelectedSchedule({ ...selectedSchedule, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={selectedSchedule.description}
                        onChange={(e) => setSelectedSchedule({ ...selectedSchedule, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category">Schedule Category</Label>
                      <Select
                        value={selectedSchedule.category}
                        onValueChange={(value) => setSelectedSchedule({ ...selectedSchedule, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {scheduleCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className="flex items-center">
                                <category.icon className="mr-2 h-4 w-4" />
                                {category.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-season">Season</Label>
                        <Select
                          value={selectedSchedule.season}
                          onValueChange={(value) => setSelectedSchedule({ ...selectedSchedule, season: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select season" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spring">Spring</SelectItem>
                            <SelectItem value="summer">Summer</SelectItem>
                            <SelectItem value="fall">Fall</SelectItem>
                            <SelectItem value="winter">Winter</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-priority">Priority</Label>
                        <Select
                          value={selectedSchedule.priority}
                          onValueChange={(value) => setSelectedSchedule({ ...selectedSchedule, priority: value })}
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
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Due Date</Label>
                      <div className="border rounded-md p-3">
                        <CalendarComponent
                          mode="single"
                          selected={selectedSchedule.dueDate ? parseISO(selectedSchedule.dueDate) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              setSelectedSchedule({ ...selectedSchedule, dueDate: format(date, "yyyy-MM-dd") })
                            }
                          }}
                          className="mx-auto"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-status">Status</Label>
                      <Select
                        value={selectedSchedule.status}
                        onValueChange={(value) => {
                          const progress =
                            value === "completed"
                              ? 100
                              : value === "in-progress"
                                ? Math.max(selectedSchedule.progress, 10)
                                : 0
                          const completionDate = value === "completed" ? new Date().toISOString().split("T")[0] : ""

                          setSelectedSchedule({
                            ...selectedSchedule,
                            status: value,
                            progress,
                            completionDate,
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedSchedule.status === "in-progress" && (
                      <div className="space-y-2">
                        <Label htmlFor="edit-progress">Progress</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            id="edit-progress"
                            type="number"
                            min="0"
                            max="100"
                            value={selectedSchedule.progress}
                            onChange={(e) =>
                              setSelectedSchedule({
                                ...selectedSchedule,
                                progress: Number.parseInt(e.target.value) || 0,
                                status: Number.parseInt(e.target.value) >= 100 ? "completed" : "in-progress",
                                completionDate:
                                  Number.parseInt(e.target.value) >= 100 ? new Date().toISOString().split("T")[0] : "",
                              })
                            }
                          />
                          <span>%</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Step 2: Assign Beehives */}
                {currentStep === 2 && selectedSchedule && (
                  <>
                    <div className="space-y-2">
                      <Label>Assign to Beehives</Label>
                      {beehives.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground border rounded-md">
                          No beehives available. Please add beehives first.
                        </div>
                      ) : (
                        <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                          {beehives.map((beehive) => (
                            <div key={beehive.id} className="flex items-center space-x-2 py-1">
                              <Checkbox
                                id={`edit-beehive-${beehive.id}`}
                                checked={(selectedSchedule.assignedGroups || []).includes(beehive.id)}
                                onCheckedChange={(checked) => {
                                  try {
                                    handleBeehiveSelection(beehive.id, !!checked)
                                  } catch (error) {
                                    console.error("Error in checkbox change:", error)
                                  }
                                }}
                              />
                              <Label htmlFor={`edit-beehive-${beehive.id}`} className="flex-1">
                                <div className="font-medium">{beehive.name}</div>
                                <div className="text-xs text-muted-foreground">{beehive.location}</div>
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Step 3: Recommendations & Notes */}
                {currentStep === 3 && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Recommendations</Label>
                        <Button variant="outline" size="sm" onClick={addRecommendation}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Recommendation
                        </Button>
                      </div>

                      {selectedSchedule.recommendations.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground border rounded-md">
                          No recommendations added. Add recommendations to guide beekeepers.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedSchedule.recommendations.map((recommendation, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Input
                                value={recommendation}
                                onChange={(e) => updateRecommendation(index, e.target.value)}
                                placeholder={`Recommendation ${index + 1}`}
                                className="flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRecommendation(index)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-notes">Notes</Label>
                      <Textarea
                        id="edit-notes"
                        placeholder="Enter additional notes"
                        value={selectedSchedule.notes}
                        onChange={(e) => setSelectedSchedule({ ...selectedSchedule, notes: e.target.value })}
                        className="min-h-[100px]"
                      />
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handlePreviousStep}>
              {currentStep === 1 ? (
                "Cancel"
              ) : (
                <>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </>
              )}
            </Button>
            <Button onClick={handleNextStep}>
              {currentStep === totalSteps ? (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Schedule Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this schedule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSchedule}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
