import type { Session } from "next-auth";

// Define the extended Session type (same as in apis-detail.ts)
interface AppSession extends Session {
  accessToken?: string;
  csrfToken?: string;
}

// Use environment variable for API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// --- Types ---
// (Consider renaming Tagu and Groups if they conflict with types used elsewhere)
// Renamed for clarity within this file:
export interface Rule {
  id: string;
  name: string;
  description: string;
  initiators: {
    id: string;
    type: string;
    operator: string;
    value: number;
    value2: number | null;
    scheduleType?: string;
    scheduleValue?: string;
    tags?: string[];
  }[];
  logicalOperator: "and" | "or";
  action: string;
  actionParams: {
    severity?: string;
    template?: string;
    customMessage?: string;
    amount?: number;
    tagId?: string;
    scheduleTitle?: string;
    scheduleDescription?: string;
    scheduleCategory?: string;
    scheduleSeason?: string;
    schedulePriority?: string;
    scheduleDate?: string;
    scheduleTime?: string;
    scheduleId?: string;
    targetValue?: number;
    progressType?: string;
    incrementAmount?: number;
  };
  isActive: boolean;
  tags: string[];
  ruleSet: string; // Assuming this is RuleSet ID
  priority: number;
}

export interface RuleSet {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  rules: string[]; // Assuming these are Rule IDs
}

export interface RuleTag { // Renamed from Tagu
  id: string;
  name: string;
  type: string;
  color?: string;
  alertLevel?: string;
}

export interface RuleGroup { // Renamed from Groups
  id: string;
  name: string;
}
// --- End Types ---


/**
 * Helper function to create headers, including Auth and CSRF if available
 * (Ensure this is IDENTICAL to the one in apis-detail.ts or move to a shared helper)
 */
function createAuthHeaders(session: AppSession | null): HeadersInit {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };
    if (session?.accessToken) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
    }
    // Add CSRF token if available (needed for POST, PUT, DELETE with Flask-WTF)
    if (session?.csrfToken) {
        headers["X-CSRFToken"] = session.csrfToken;
    }
    return headers;
}

/**
 * Helper function to handle API errors consistently
 */
async function handleApiError(response: Response, operation: string): Promise<never> {
    const errorText = await response.text();
    console.error(`Failed to ${operation}: ${response.status} - ${errorText}`);
    if (response.status === 401) console.warn(`Unauthorized ${operation}.`);

    let description = response.statusText;
    try {
        const errorJson = JSON.parse(errorText);
        description = errorJson.description || errorJson.message || description;
    } catch (e) { /* ignore JSON parsing error */ }

    throw new Error(`${operation} failed: ${response.status} - ${description}`);
}

// ==============================
// Rule Functions
// ==============================

/**
 * Fetch all rules from the API
 */
export async function fetchRules(session: AppSession | null): Promise<Rule[]> {
  const operation = "fetch rules";
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/rules`, {
        method: "GET", // Typically GET for fetching lists
        headers: createAuthHeaders(session), // Include auth even for GET if needed
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }

    // Assuming the API returns an object like { "rules": [...] }
    // If it returns the array directly, use: const data = await response.json(); return data || [];
    const data = await response.json();
    console.log("rules")
    console.log(data)
    return data.rules || []; // Return empty array if 'rules' key is missing
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error; // Re-throw
  }
}

/**
 * Fetch a specific rule by ID
 */
export async function fetchRuleById(id: string, session: AppSession | null): Promise<Rule> {
  const operation = `fetch rule by ID (${id})`;
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/rules/${id}`, {
        method: "GET",
        headers: createAuthHeaders(session),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }

    // Assuming the API returns the rule object directly or { "rule": {...} }
    const data = await response.json();
     if (!data) { // Or check for !data.rule depending on API response
        throw new Error("Rule data not found in API response.");
    }
    return data.rule || data; // Adjust based on actual API response
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Create a new rule
 */
export async function createRule(rule: Omit<Rule, "id">, session: AppSession | null): Promise<Rule> {
  const operation = "create rule";
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/rules`, {
      method: "POST",
      headers: createAuthHeaders(session), // Auth + CSRF needed
      body: JSON.stringify(rule),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }

    // Assuming API returns the created rule object like { "rule": {...} }
    const data = await response.json();
    return data.rule;
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Update an existing rule
 */
export async function updateRule(id: string, rule: Partial<Rule>, session: AppSession | null): Promise<Rule> {
  // Note: Sending the full 'rule' object including 'id' might be okay,
  // or the backend might prefer only the fields to update. Adjust 'Partial<Rule>' as needed.
  const operation = `update rule (${id})`;
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/rules/${id}`, {
      method: "PUT",
      headers: createAuthHeaders(session), // Auth + CSRF needed
      body: JSON.stringify(rule),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }

    // Assuming API returns the updated rule object like { "rule": {...} }
    const data = await response.json();
    return data.rule;
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Delete a rule
 */
export async function deleteRule(id: string, session: AppSession | null): Promise<void> {
  const operation = `delete rule (${id})`;
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/rules/${id}`, {
      method: "DELETE",
      headers: createAuthHeaders(session), // Auth + CSRF needed
    });

    if (!response.ok) {
      // Handle potential 204 No Content success case if applicable
      if (response.status === 204) {
          console.log(`Rule ${id} deleted successfully (204 No Content).`);
          return;
      }
      await handleApiError(response, operation);
    }
    // Check for other success statuses like 200 OK with a potential success message
    console.log(`Rule ${id} deleted successfully (Status: ${response.status}).`);

  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

// ==============================
// RuleSet Functions
// ==============================

/**
 * Fetch all rule sets
 */
export async function fetchRuleSets(session: AppSession | null): Promise<RuleSet[]> {
  const operation = "fetch rule sets";
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/rule_sets`, {
        method: "GET",
        headers: createAuthHeaders(session),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }
    // Assuming API returns { "rule_sets": [...] }
    const data = await response.json();
    return data.rule_sets || [];
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Fetch a specific rule set by ID
 */
export async function fetchRuleSetById(id: string, session: AppSession | null): Promise<RuleSet> {
  const operation = `fetch rule set by ID (${id})`;
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/rule_sets/${id}`, {
        method: "GET",
        headers: createAuthHeaders(session),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }
     // Assuming API returns { "rule_set": {...} } or the object directly
    const data = await response.json();
    if (!data) { // Or check !data.rule_set
        throw new Error("Rule set data not found in API response.");
    }
    return data.rule_set || data;
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Create a new rule set
 */
export async function createRuleSet(ruleSet: Omit<RuleSet, "id">, session: AppSession | null): Promise<RuleSet> {
   const operation = "create rule set";
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/rule_sets`, {
      method: "POST",
      headers: createAuthHeaders(session),
      body: JSON.stringify(ruleSet),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }
     // Assuming API returns { "rule_set": {...} }
    const data = await response.json();
    return data.rule_set;
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Update an existing rule set
 */
export async function updateRuleSet(id: string, ruleSet: Partial<RuleSet>, session: AppSession | null): Promise<RuleSet> {
  const operation = `update rule set (${id})`;
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/rule_sets/${id}`, {
      method: "PUT",
      headers: createAuthHeaders(session),
      body: JSON.stringify(ruleSet),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }
    // Assuming API returns { "rule_set": {...} }
    const data = await response.json();
    return data.rule_set;
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Delete a rule set
 */
export async function deleteRuleSet(id: string, session: AppSession | null): Promise<void> {
  const operation = `delete rule set (${id})`;
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/rule_sets/${id}`, {
      method: "DELETE",
      headers: createAuthHeaders(session),
    });

     if (!response.ok) {
      // Handle potential 204 No Content success case if applicable
      if (response.status === 204) {
          console.log(`RuleSet ${id} deleted successfully (204 No Content).`);
          return;
      }
      await handleApiError(response, operation);
    }
     console.log(`RuleSet ${id} deleted successfully (Status: ${response.status}).`);
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

// ==============================
// Tag and Group (for Rules context) Functions
// ==============================

/**
 * Fetch all tags (relevant for rules)
 */
export async function fetchTags(session: AppSession | null): Promise<RuleTag[]> { // Renamed function
  const operation = "fetch rule tags";
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/tags`, {
        method: "GET",
        headers: createAuthHeaders(session),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }
    // Assuming API returns { "tags": [...] }
    const data = await response.json();
    return data.tags || [];
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Fetch all groups (relevant for rules, e.g., for specificGroups dropdown)
 */
export async function fetchGroups(session: AppSession | null): Promise<RuleGroup[]> { // Renamed function
  const operation = "fetch rule groups";
  try {
    const response = await fetch(`${API_BASE_URL}/access/rules/groups`, {
        method: "GET",
        headers: createAuthHeaders(session),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }
     // Assuming API returns { "groups": [...] }
    const data = await response.json();
    return data.groups || [];
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}