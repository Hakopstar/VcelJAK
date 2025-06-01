// Types for the admin section

export interface Group {
    id: string
    name: string
    description: string
    location: string
    type: string
    beehiveType?: string
    mode?: string
    tags?: string[]
    sensors?: string[]
    subgroups?: string[]
    health?: number
    lastInspection?: string
    events?: Event[]
    rules?: string[]
    ruleSets?: string[]
    connectedGroups?: string[]
    parentId?: string
    automaticMode?: boolean
    isMain?: boolean
    createdAt: string
    updatedAt: string
  }
  
  export interface Sensor {
    id: string
    name: string
    type: string
    status: "active" | "inactive" | "maintenance"
    assignedTo: string | null
    readings?: {
      value: number
      unit: string
      timestamp: string
    }
    history?: {
      timestamp: string
      value: number
    }[]
    lastReading?: {
      timestamp: string
      value: number
      unit: string
    }
  }
  
  export interface Rule {
    id: string
    name: string
    description: string
    initiators: Initiator[]
    logicalOperator: string
    action: string
    actionParams: ActionParams
    isActive: boolean
    appliesTo: "all" | "specific" | "tagged"
    specificBeehives: string[]
    tags: string[]
    ruleSet: string
    priority: number
  }
  
  export interface Initiator {
    id: string
    type: string
    operator?: string
    value?: number
    value2?: number | null
    scheduleType?: string
    scheduleValue?: string
    tags?: string[]
  }
  
  export interface ActionParams {
    severity?: string
    template?: string
    customMessage?: string
    amount?: number
    tagId?: string
    scheduleTitle?: string
    scheduleDescription?: string
    scheduleCategory?: string
    scheduleSeason?: string
    schedulePriority?: string
    scheduleDate?: string
    scheduleTime?: string
    scheduleId?: string
    targetValue?: number
    progressType?: string
    incrementAmount?: number
  }
  
  export interface RuleSet {
    id: string
    name: string
    description: string
    isActive: boolean
    rules: string[]
  }
  
  export interface Tag {
    id: string
    name: string
    type: string
    color?: string
    priority?: number
    ruleOverrides?: string[]
    alertLevel?: string
  }
  
  export interface Event {
    id: string
    date: string
    type: string
    description: string
  }
  
  export interface ConditionOperator {
    id: string
    name: string
    symbol: string
    description: string
  }
  
  export interface LogicalOperator {
    id: string
    name: string
    description: string
  }
  
  export interface ActionType {
    id: string
    name: string
    icon: any
    description: string
  }
  
  export interface InitiatorType {
    id: string
    name: string
    unit?: string
    icon: any
    type: string
  }
  
  export interface ScheduleCategory {
    id: string
    name: string
    description: string
    icon: any
    color: string
    textColor: string
    borderColor: string
    lightBg: string
    season: string
  }
  
  export interface TextTemplate {
    id: string
    name: string
    text: string
    condition: string
  }
  