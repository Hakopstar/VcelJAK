import type { Session } from "next-auth";
import type { Group, Sensor, Rule, Event } from "../types"; // Adjust path as needed

// Use the same extended Session type
interface AppSession extends Session {
  accessToken?: string;
  csrfToken?: string; // Assuming you name it csrfToken in your next-auth callbacks
}

// Use environment variable for API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';


/**
 * Helper function to create headers, including Auth and CSRF if available
 * (Ensure this is IDENTICAL to the one in apis.ts or move to a shared helper)
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

// Fetch a specific group by ID
export async function fetchGroupById(groupId: string, session: AppSession | null): Promise<Group> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/detail`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ id: groupId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch group detail: ${response.status} - ${errorText}`);
      if (response.status === 401) console.warn("Unauthorized fetching group detail.");
      let description = response.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        description = errorJson.description || errorJson.message || description;
      } catch (e) { /* ignore */ }
       // Handle 404 specifically
       if (response.status === 404) {
           throw new Error(`Group with ID "${groupId}" not found.`);
       }
      throw new Error(`Fetch group detail failed: ${response.status} - ${description}`);
    }

    const data = await response.json();
    if (!data.group) {
        // Handle cases where API returns 200 but no group data
        console.error("API returned success but no group data for ID:", groupId);
        throw new Error("Group data not found in API response.");
    }
    return data.group;
  } catch (error) {
    console.error("Error in fetchGroupById:", error);
    throw error; // Re-throw
  }
}

// Fetch sensors for a specific group
export async function fetchGroupSensors(groupId: string, session: AppSession | null): Promise<Sensor[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/group-sensors`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch group sensors: ${response.status} - ${errorText}`);
      if (response.status === 401) console.warn("Unauthorized fetching group sensors.");
      let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
      throw new Error(`Fetch group sensors failed: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.sensors || [];
  } catch (error) {
    console.error("Error in fetchGroupSensors:", error);
    throw error; // Re-throw
  }
}

// Fetch subgroups for a specific group
export async function fetchSubgroups(parentId: string, session: AppSession | null): Promise<Group[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/subgroups`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ parentId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch subgroups: ${response.status} - ${errorText}`);
      if (response.status === 401) console.warn("Unauthorized fetching subgroups.");
      let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
      throw new Error(`Fetch subgroups failed: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.groups || [];
  } catch (error) {
    console.error("Error in fetchSubgroups:", error);
    throw error; // Re-throw
  }
}

// Fetch events for a specific group
export async function fetchGroupEvents(groupId: string, session: AppSession | null): Promise<Event[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/events`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch group events: ${response.status} - ${errorText}`);
      if (response.status === 401) console.warn("Unauthorized fetching group events.");
      let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
      throw new Error(`Fetch group events failed: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error("Error in fetchGroupEvents:", error);
    throw error; // Re-throw
  }
}

// Fetch rules for a specific group
export async function fetchGroupRules(groupId: string, session: AppSession | null): Promise<Rule[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/group-rules`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch group rules: ${response.status} - ${errorText}`);
      if (response.status === 401) console.warn("Unauthorized fetching group rules.");
      let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
      throw new Error(`Fetch group rules failed: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.rules || [];
  } catch (error) {
    console.error("Error in fetchGroupRules:", error);
    throw error; // Re-throw
  }
}

// Fetch sensor history data
export async function fetchSensorHistory(
  sensorId: string,
  timeRange: string,
  session: AppSession | null
): Promise<{ timestamp: string; value: number }[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/sensor-history`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ sensorId, timeRange }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch sensor history: ${response.status} - ${errorText}`);
      if (response.status === 401) console.warn("Unauthorized fetching sensor history.");
       // Handle 510 specifically if backend sends it
       if (response.status === 510) {
           throw new Error("Sensor history feature is unavailable (server configuration error).");
       }
       let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
      throw new Error(`Fetch sensor history failed: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.history || [];
  } catch (error) {
    console.error("Error in fetchSensorHistory:", error);
    throw error; // Re-throw
  }
}

// Fetch connected groups for a specific group
export async function fetchConnectedGroups(groupId: string, session: AppSession | null): Promise<Group[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/connected-groups`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId }),
    });

    if (!response.ok) {
       const errorText = await response.text();
       console.error(`Failed to fetch connected groups: ${response.status} - ${errorText}`);
       if (response.status === 401) console.warn("Unauthorized fetching connected groups.");
       let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
       throw new Error(`Fetch connected groups failed: ${response.status} - ${description}`);
    }

    const data = await response.json();
    return data.groups || [];
  } catch (error) {
    console.error("Error in fetchConnectedGroups:", error);
    throw error; // Re-throw
  }
}

// Update group health status
export async function updateGroupHealth(groupId: string, health: number, session: AppSession | null): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/access/groups/update-health`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId, health }),
    });

    if (!response.ok) {
       const errorText = await response.text();
       console.error(`Failed to update group health: ${response.status} - ${errorText}`);
       if (response.status === 401) console.warn("Unauthorized updating group health.");
       let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
       throw new Error(`Update group health failed: ${response.status} - ${description}`);
    }
     // Assuming success returns 200 OK with JSON body
     const data = await response.json();
     if (!data.success) {
        console.warn(`Update health request returned 200 but success was false.`);
     }
  } catch (error) {
    console.error("Error in updateGroupHealth:", error);
    throw error; // Re-throw
  }
}

// Add event to a group
// Ensure the 'event' type matches the backend expectation (e.g., date format)
export async function addGroupEvent(groupId: string, event: Omit<Event, "id">, session: AppSession | null): Promise<Event> {
  try {
    // Ensure date is in ISO format expected by backend
    const eventPayload = {
        ...event,
        event_date: new Date(event.event_date).toISOString(), // Ensure ISO format
    };

    const response = await fetch(`${API_BASE_URL}/access/groups/add-event`, {
      method: "POST",
      headers: createAuthHeaders(session), 
      body: JSON.stringify({ groupId, event: eventPayload }), // Send modified payload
    });

    if (!response.ok) {
       const errorText = await response.text();
       console.error(`Failed to add group event: ${response.status} - ${errorText}`);
       if (response.status === 401) console.warn("Unauthorized adding group event.");
       let description = response.statusText;
       try {
         const errorJson = JSON.parse(errorText);
         description = errorJson.description || errorJson.message || description;
       } catch (e) { /* ignore */ }
       throw new Error(`Add group event failed: ${response.status} - ${description}`);
    }

    const data = await response.json();
     if (!data.event) {
        console.error("API returned success but no event data on add.");
        throw new Error("Event data not found in API response.");
    }
    return data.event;
  } catch (error) {
    console.error("Error in addGroupEvent:", error);
    throw error; // Re-throw
  }
}