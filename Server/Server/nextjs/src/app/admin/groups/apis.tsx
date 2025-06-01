import type { Session } from "next-auth";
import type { Group, Sensor, Rule, RuleSet, Tag } from "../types"; // Adjust path as needed


interface AppSession extends Session {
  accessToken?: string;
  csrfToken?: string; // Assuming you name it csrfToken in your next-auth callbacks
}


// Use environment variable for API base URL for flexibility
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';


/**
 * Helper function to create headers, including Auth and CSRF if available
 */
function createAuthHeaders(session: AppSession | null): HeadersInit {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };
    if (session?.accessToken) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
    }

    if (session?.csrfToken) {
        headers["X-CSRFToken"] = session.csrfToken;
    }

    return headers;
}

// Fetch all groups
export async function fetchGroups(session: AppSession | null): Promise<Group[]> {
  try {
    // Removed useSession hook call
    const response = await fetch(`${API_BASE_URL}/access/groups/list`, {
      method: "POST",
      headers: createAuthHeaders(session), 
    });

    if (!response.ok) {
      const errorText = await response.text(); // Get error text for better debugging
      console.error(`Failed to fetch groups: ${response.status} - ${errorText}`);
      if (response.status === 401) console.warn("Unauthorized fetching groups.");
      // Try to parse JSON description, fallback to status text
      let description = response.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        description = errorJson.description || errorJson.message || description;
      } catch (e) { /* ignore json parse error */ }
      throw new Error(`Failed to fetch groups: ${response.status} - ${description}`);
    }

    const data = await response.json();
    // console.log("Fetched groups data:", data.groups); // Keep console log if needed for debug
    return data.groups || [];
  } catch (error) {
    console.error("Error in fetchGroups:", error);
    // Re-throw the error so the calling component knows something went wrong
    throw error;
  }
}

// Fetch all sensors (for assignment)
export async function fetchSensors(session: AppSession | null): Promise<Sensor[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/sensors`, {
      method: "POST",
      headers: createAuthHeaders(session), 
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch sensors: ${response.status} - ${errorText}`);
      if (response.status === 401) console.warn("Unauthorized fetching sensors.");
      let description = response.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        description = errorJson.description || errorJson.message || description;
      } catch (e) { /* ignore */ }
      throw new Error(`Failed to fetch sensors: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.sensors || [];
  } catch (error) {
    console.error("Error in fetchSensors:", error);
    throw error;
  }
}

// Fetch all rules (for assignment)
export async function fetchRules(session: AppSession | null): Promise<Rule[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/rules`, {
      method: "POST",
      headers: createAuthHeaders(session), 
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch rules: ${response.status} - ${errorText}`);
      if (response.status === 401) console.warn("Unauthorized fetching rules.");
       let description = response.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        description = errorJson.description || errorJson.message || description;
      } catch (e) { /* ignore */ }
      throw new Error(`Failed to fetch rules: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.rules || [];
  } catch (error) {
    console.error("Error in fetchRules:", error);
    throw error;
  }
}

// Fetch all rule sets (for assignment)
export async function fetchRuleSets(session: AppSession | null): Promise<RuleSet[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/rulesets`, {
      method: "POST",
      headers: createAuthHeaders(session), 
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch rule sets: ${response.status} - ${errorText}`);
      if (response.status === 401) console.warn("Unauthorized fetching rulesets.");
       let description = response.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        description = errorJson.description || errorJson.message || description;
      } catch (e) { /* ignore */ }
      throw new Error(`Failed to fetch rule sets: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.ruleSets || [];
  } catch (error) {
    console.error("Error in fetchRuleSets:", error);
    throw error;
  }
}

// Fetch all tags (for assignment)
export async function fetchTags(session: AppSession | null): Promise<Tag[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/tags`, {
      method: "POST",
      headers: createAuthHeaders(session), 
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch tags: ${response.status} - ${errorText}`);
       if (response.status === 401) console.warn("Unauthorized fetching tags.");
       let description = response.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        description = errorJson.description || errorJson.message || description;
      } catch (e) { /* ignore */ }
      throw new Error(`Failed to fetch tags: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.tags || [];
  } catch (error) {
    console.error("Error in fetchTags:", error);
    throw error;
  }
}

// Create a new group
export async function createGroup(group: Omit<Group, "id" | "subgroups" | "health" | "lastInspection">, session: AppSession | null): Promise<Group> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/create`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify(group),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to create group: ${response.status} - ${errorText}`);
      if (response.status === 401) console.warn("Unauthorized creating group.");
      let description = response.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        description = errorJson.description || errorJson.message || description;
      } catch (e) { /* ignore json parsing error */ }
      throw new Error(`Create group failed: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.group;
  } catch (error) {
    console.error("Error in createGroup:", error);
    throw error; // Re-throw
  }
}

// Update an existing group
export async function updateGroup(group: Group, session: AppSession | null): Promise<Group> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/update`, {
      method: "PUT",
      headers: createAuthHeaders(session), 
      body: JSON.stringify(group),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to update group: ${response.status} - ${errorText}`);
       if (response.status === 401) console.warn("Unauthorized updating group.");
       let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
       throw new Error(`Update group failed: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.group;
  } catch (error) {
    console.error("Error in updateGroup:", error);
    throw error; // Re-throw
  }
}

// Delete a group
export async function deleteGroup(groupId: string, session: AppSession | null): Promise<void> {
    const functionName = 'deleteGroup'; // For easier log searching
    console.log(`[${functionName}] Called with group ID:`, groupId);
    console.log(`[${functionName}] Session object received:`, session); // Log the session object
    if (!session?.accessToken) console.warn(`[${functionName}] WARNING: No accessToken in session!`);
    if (!session?.csrfToken) console.warn(`[${functionName}] WARNING: No csrfToken in session!`);
  
    let requestHeaders: HeadersInit = {}; // To store headers for logging
    try {
      const bodyToSend = JSON.stringify({ id: groupId });
      console.log(`[${functionName}] Body being sent:`, bodyToSend); // Log the exact body
  
      requestHeaders = createAuthHeaders(session);
      console.log(`[${functionName}] Headers being sent:`, JSON.stringify(requestHeaders)); // Log the exact headers
  
      const response = await fetch(`${API_BASE_URL}/access/groups/delete`, {
        method: "DELETE",
        headers: requestHeaders, // Use the logged headers
        body: bodyToSend,
      });
  
      console.log(`[${functionName}] Response status: ${response.status}`); // Log status
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${functionName}] Failed: ${response.status} - ${errorText}`);
         let description = response.statusText;
         try {
           const errorJson = JSON.parse(errorText);
           description = errorJson.description || errorJson.message || description;
         } catch (e) { /* ignore */ }
         throw new Error(`Delete group failed: ${response.status} - ${description}`);
      }
  
       if (response.status === 204) {
          console.log(`[${functionName}] Success (204 No Content).`);
          return;
       }
       const data = await response.json();
       console.log(`[${functionName}] Success (200 OK), response data:`, data);
       if (!data.success) {
          console.warn(`[${functionName}] Delete group request returned 200 but success was false.`);
       }
  
    } catch (error) {
      console.error(`[${functionName}] Error during fetch/processing:`, error);
      console.error(`[${functionName}] Details - Group ID: ${groupId}, Headers used: ${JSON.stringify(requestHeaders)}`); // Log context on error
      throw error; // Re-throw
    }
  }

// Assign a sensor to a group
export async function assignSensor(groupId: string, sensorId: string, session: AppSession | null): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/assign-sensor`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId, sensorId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to assign sensor: ${response.status} - ${errorText}`);
       if (response.status === 401) console.warn("Unauthorized assigning sensor.");
       let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
       throw new Error(`Assign sensor failed: ${response.status} - ${description}`);
    }
     // Assuming success returns 200 OK with JSON body
     const data = await response.json();
     if (!data.success) {
        console.warn(`Assign sensor request returned 200 but success was false: ${data.msg}`);
        // Throw error based on message if needed
        if (data.msg) throw new Error(data.msg)
     }

  } catch (error) {
    console.error("Error in assignSensor:", error);
    throw error; // Re-throw
  }
}

// Unassign a sensor from a group
export async function unassignSensor(groupId: string, sensorId: string, session: AppSession | null): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/unassign-sensor`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId, sensorId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to unassign sensor: ${response.status} - ${errorText}`);
       if (response.status === 401) console.warn("Unauthorized unassigning sensor.");
       let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
       throw new Error(`Unassign sensor failed: ${response.status} - ${description}`);
    }
    // Assuming success returns 200 OK with JSON body
     const data = await response.json();
     if (!data.success) {
        console.warn(`Unassign sensor request returned 200 but success was false: ${data.msg}`);
        // Throw error based on message if needed
        if (data.msg) throw new Error(data.msg);
     }
  } catch (error) {
    console.error("Error in unassignSensor:", error);
    throw error; // Re-throw
  }
}

// Assign a rule to a group
export async function assignRule(groupId: string, ruleId: string, session: AppSession | null): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/assign-rule`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId, ruleId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to assign rule: ${response.status} - ${errorText}`);
       if (response.status === 401) console.warn("Unauthorized assigning rule.");
       let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
       throw new Error(`Assign rule failed: ${response.status} - ${description}`);
    }
     // Assuming success returns 200 OK with JSON body
     const data = await response.json();
     if (!data.success) {
        console.warn(`Assign rule request returned 200 but success was false: ${data.msg}`);
        // Throw error based on message if needed
        if (data.msg) throw new Error(data.msg);
     }
  } catch (error) {
    console.error("Error in assignRule:", error);
    throw error; // Re-throw
  }
}

// Unassign a rule from a group
export async function unassignRule(groupId: string, ruleId: string, session: AppSession | null): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/unassign-rule`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId, ruleId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to unassign rule: ${response.status} - ${errorText}`);
       if (response.status === 401) console.warn("Unauthorized unassigning rule.");
       let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
       throw new Error(`Unassign rule failed: ${response.status} - ${description}`);
    }
     // Assuming success returns 200 OK with JSON body
     const data = await response.json();
     if (!data.success) {
        console.warn(`Unassign rule request returned 200 but success was false: ${data.msg}`);
        // Throw error based on message if needed
        if (data.msg) throw new Error(data.msg);
     }
  } catch (error) {
    console.error("Error in unassignRule:", error);
    throw error; // Re-throw
  }
}

// Set inspection date for a group
export async function setInspectionDate(groupId: string, date: string | null, session: AppSession | null): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/set-inspection`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId, date }), // Send date (can be null)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to set inspection date: ${response.status} - ${errorText}`);
       if (response.status === 401) console.warn("Unauthorized setting inspection date.");
       let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
       throw new Error(`Set inspection date failed: ${response.status} - ${description}`);
    }
     // Assuming success returns 200 OK with JSON body
     const data = await response.json();
     if (!data.success) {
        console.warn(`Set inspection date request returned 200 but success was false.`);
     }
  } catch (error) {
    console.error("Error in setInspectionDate:", error);
    throw error; // Re-throw
  }
}

// Set main meteostation for a group
export async function setMainMeteostation(groupId: string, meteoStationGroupId: string | null, session: AppSession | null): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/set-main-meteostation`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId, meteoStationGroupId }), // Sending meteoStationGroupId
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to set main meteostation: ${response.status} - ${errorText}`);
       if (response.status === 401) console.warn("Unauthorized setting meteostation.");
       let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
       throw new Error(`Set main meteostation failed: ${response.status} - ${description}`);
    }
     // Assuming success returns 200 OK with JSON body
     const data = await response.json();
     if (!data.success) {
        console.warn(`Set main meteostation request returned 200 but success was false.`);
     }
  } catch (error) {
    console.error("Error in setMainMeteostation:", error);
    throw error; // Re-throw
  }
}

// --- ADD MISSING FUNCTIONS (RuleSet, Tag assignment) ---

// Assign a RuleSet to a group
export async function assignRuleSet(groupId: string, rulesetId: string, session: AppSession | null): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/access/groups/assign-ruleset`, {
        method: "POST",
        headers: createAuthHeaders(session), 
        body: JSON.stringify({ groupId, rulesetId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to assign ruleset: ${response.status} - ${errorText}`);
        if (response.status === 401) console.warn("Unauthorized assigning ruleset.");
        let description = response.statusText;
        try {
           const errorJson = JSON.parse(errorText);
           description = errorJson.description || errorJson.message || description;
         } catch (e) { /* ignore */ }
         throw new Error(`Assign ruleset failed: ${response.status} - ${description}`);
      }
       // Assuming success returns 200 OK with JSON body
       const data = await response.json();
       if (!data.success) {
          console.warn(`Assign ruleset request returned 200 but success was false: ${data.msg}`);
          if (data.msg) throw new Error(data.msg);
       }
    } catch (error) {
      console.error("Error in assignRuleSet:", error);
      throw error; // Re-throw
    }
  }

  // Unassign a RuleSet from a group
  export async function unassignRuleSet(groupId: string, rulesetId: string, session: AppSession | null): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/access/groups/unassign-ruleset`, {
        method: "POST",
        headers: createAuthHeaders(session), 
        body: JSON.stringify({ groupId, rulesetId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to unassign ruleset: ${response.status} - ${errorText}`);
        if (response.status === 401) console.warn("Unauthorized unassigning ruleset.");
        let description = response.statusText;
        try {
           const errorJson = JSON.parse(errorText);
           description = errorJson.description || errorJson.message || description;
         } catch (e) { /* ignore */ }
         throw new Error(`Unassign ruleset failed: ${response.status} - ${description}`);
      }
       // Assuming success returns 200 OK with JSON body
       const data = await response.json();
       if (!data.success) {
          console.warn(`Unassign ruleset request returned 200 but success was false: ${data.msg}`);
          if (data.msg) throw new Error(data.msg);
       }
    } catch (error) {
      console.error("Error in unassignRuleSet:", error);
      throw error; // Re-throw
    }
  }

  // Assign a Tag to a group
  export async function assignTag(groupId: string, tagId: string, session: AppSession | null): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/access/groups/assign-tag`, {
        method: "POST",
        headers: createAuthHeaders(session), 
        body: JSON.stringify({ groupId, tagId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to assign tag: ${response.status} - ${errorText}`);
        if (response.status === 401) console.warn("Unauthorized assigning tag.");
        let description = response.statusText;
        try {
           const errorJson = JSON.parse(errorText);
           description = errorJson.description || errorJson.message || description;
         } catch (e) { /* ignore */ }
         throw new Error(`Assign tag failed: ${response.status} - ${description}`);
      }
       // Assuming success returns 200 OK with JSON body
       const data = await response.json();
       if (!data.success) {
          console.warn(`Assign tag request returned 200 but success was false: ${data.msg}`);
          if (data.msg) throw new Error(data.msg);
       }
    } catch (error) {
      console.error("Error in assignTag:", error);
      throw error; // Re-throw
    }
  }

  // Unassign a Tag from a group
  export async function unassignTag(groupId: string, tagId: string, session: AppSession | null): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/access/groups/unassign-tag`, {
        method: "POST",
        headers: createAuthHeaders(session), 
        body: JSON.stringify({ groupId, tagId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to unassign tag: ${response.status} - ${errorText}`);
        if (response.status === 401) console.warn("Unauthorized unassigning tag.");
        let description = response.statusText;
        try {
           const errorJson = JSON.parse(errorText);
           description = errorJson.description || errorJson.message || description;
         } catch (e) { /* ignore */ }
         throw new Error(`Unassign tag failed: ${response.status} - ${description}`);
      }
       // Assuming success returns 200 OK with JSON body
       const data = await response.json();
       if (!data.success) {
          console.warn(`Unassign tag request returned 200 but success was false: ${data.msg}`);
          if (data.msg) throw new Error(data.msg);
       }
    } catch (error) {
      console.error("Error in unassignTag:", error);
      throw error; // Re-throw
    }
  }