// src/app/schedule/apis.ts

import type { Session } from "next-auth";

// Define the extended Session type (same as in rules api)
interface AppSession extends Session {
  accessToken?: string;
  csrfToken?: string;
}

// Use environment variable for API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// --- Types ---
// Define basic types based on usage in page.tsx
// Refine these to match your actual backend data structure

export interface Condition {
    type: string;
    operator: string;
    value: number | string; // Can be number or observed string
    unit?: string;
    duration?: number;
    durationUnit?: string;
    groupId?: string;
    // Add other condition fields if necessary
}

export interface Schedule {
    id: string;
    name: string;
    description: string;
    category: string;
    season: string;
    dueDate: string; // ISO date string (e.g., "YYYY-MM-DD")
    status: "pending" | "in-progress" | "completed";
    progress: number; // Percentage 0-100
    assignedGroups: string[]; // Array of Beehive/Group IDs
    priority: "high" | "medium" | "low";
    conditions?: Condition[];
    recommendations?: string[];
    notes?: string;
    completionDate?: string; // ISO date string (e.g., "YYYY-MM-DD") or null/undefined
    createdAt: string; // ISO date string
    lastModified: string; // ISO date string
}

export interface Beehive { // Corresponds to 'Group' in Rules API?
    id: string;
    name: string;
    location?: string; // Add other fields if needed
}

export interface Group {
    id: string;
    name: string;
    location?: string; // Add other fields if needed
}
// --- End Types ---


/**
 * Helper function to create headers, including Auth and CSRF if available
 * (Ensure this is IDENTICAL to the one in rules api or move to a shared helper)
 */
function createAuthHeaders(session: AppSession | null): HeadersInit {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };
    if (session?.accessToken) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
    }
    // Add CSRF token if available (needed for POST, PUT, DELETE)
    if (session?.csrfToken) {
        headers["X-CSRFToken"] = session.csrfToken;
    }
    return headers;
}

/**
 * Helper function to handle API errors consistently
 * (Ensure this is IDENTICAL to the one in rules api or move to a shared helper)
 */
async function handleApiError(response: Response, operation: string): Promise<never> {
    const errorText = await response.text();
    console.error(`Failed to ${operation}: ${response.status} - ${errorText}`);
    if (response.status === 401) console.warn(`Unauthorized ${operation}.`);

    let description = response.statusText;
    try {
        // Attempt to parse backend's JSON error response
        const errorJson = JSON.parse(errorText);
        description = errorJson.description || errorJson.message || description;
    } catch (e) { /* ignore JSON parsing error, use original text/status */ }

    throw new Error(`${operation} failed: ${response.status} - ${description}`);
}

// ==============================
// Schedule Functions
// ==============================

/**
 * Fetch all schedules from the API
 * @param session The authenticated user session
 * @returns Promise resolving to an array of Schedules
 */
export async function fetchSchedules(session: AppSession | null): Promise<Schedule[]> {
  const operation = "fetch schedules";
  try {
    // NOTE: Changed endpoint from '/all' to '/' (standard REST)
    const response = await fetch(`${API_BASE_URL}/access/schedules/schedules`, {
        method: "GET",
        headers: createAuthHeaders(session), // Use helper for auth
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }

    // Assuming the API returns the array directly.
    // If it returns { "schedules": [...] }, use: const data = await response.json(); return data.schedules || [];
    const data: Schedule[] = await response.json();
    return data || []; // Return empty array if data is null/undefined
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    // Re-throw the error so the calling component can handle it (e.g., show toast)
    throw error;
  }
}

/**
 * Fetch a specific schedule by ID
 * @param id Schedule ID
 * @param session The authenticated user session
 * @returns Promise resolving to a Schedule object
 */
export async function fetchScheduleById(id: string, session: AppSession | null): Promise<Schedule> {
  const operation = `fetch schedule by ID (${id})`;
  if (!id) throw new Error("Schedule ID is required."); // Basic validation
  try {
    const response = await fetch(`${API_BASE_URL}/access/schedules/${id}`, {
        method: "GET",
        headers: createAuthHeaders(session),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }

    // Assuming API returns the schedule object directly
    const data: Schedule = await response.json();
    if (!data) { // Check if data is null/undefined after successful response
        throw new Error("Schedule data not found in API response.");
    }
    return data;
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Create a new schedule
 * @param scheduleData Schedule data to create (excluding generated fields like id, createdAt, lastModified)
 * @param session The authenticated user session
 * @returns Promise resolving to the created Schedule object
 */
export async function createSchedule(
    // Adjust Omit<> based on fields generated by backend vs. sent by frontend
    scheduleData: Omit<Schedule, "id" | "createdAt" | "lastModified" | "completionDate" | "status" | "progress"> & Partial<Pick<Schedule, "status" | "progress">>,
    session: AppSession | null
): Promise<Schedule> {
  const operation = "create schedule";
  try {
    // NOTE: Changed endpoint from '/create' to '/' (standard REST)
    const response = await fetch(`${API_BASE_URL}/access/schedules`, {
      method: "POST",
      headers: createAuthHeaders(session), // Auth + CSRF needed
      body: JSON.stringify(scheduleData),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }

    // Assuming API returns the created schedule object directly
    const data: Schedule = await response.json();
    return data;
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Update an existing schedule
 * @param id Schedule ID to update
 * @param scheduleData Updated schedule data (can be partial)
 * @param session The authenticated user session
 * @returns Promise resolving to the updated Schedule object
 */
export async function updateSchedule(
    id: string,
    // Send only the fields that might change. Exclude id.
    scheduleData: Partial<Omit<Schedule, "id" | "createdAt">>,
    session: AppSession | null
): Promise<Schedule> {
  const operation = `update schedule (${id})`;
  if (!id) throw new Error("Schedule ID is required for update.");
  try {
    // NOTE: Changed endpoint from '/update/{id}' to '/{id}' (standard REST)
    const response = await fetch(`${API_BASE_URL}/access/schedules/${id}`, {
      method: "PUT",
      headers: createAuthHeaders(session), // Auth + CSRF needed
      body: JSON.stringify(scheduleData),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }

    // Assuming API returns the updated schedule object directly
    const data: Schedule = await response.json();
    return data;
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Delete a schedule
 * @param id Schedule ID to delete
 * @param session The authenticated user session
 * @returns Promise resolving when deletion is successful
 */
export async function deleteSchedule(id: string, session: AppSession | null): Promise<void> {
  const operation = `delete schedule (${id})`;
  if (!id) throw new Error("Schedule ID is required for deletion.");
  try {
     // NOTE: Changed endpoint from '/delete/{id}' to '/{id}' (standard REST)
    const response = await fetch(`${API_BASE_URL}/access/schedules/${id}`, {
      method: "DELETE",
      headers: createAuthHeaders(session), // Auth + CSRF needed
    });

    // Check for specific success status codes
    if (response.status === 204) {
        console.log(`Schedule ${id} deleted successfully (204 No Content).`);
        return; // Successful deletion, no content expected
    }

    if (!response.ok) {
      // Handle other errors
      await handleApiError(response, operation);
    }

    // Handle unexpected success codes (e.g., 200 OK with body, though 204 is preferred)
    console.log(`Schedule ${id} deletion request successful (Status: ${response.status}).`);
    // You might want to read response.text() or .json() here if backend sends confirmation

  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

// ==============================
// Related Data Functions
// ==============================

/**
 * Fetch all beehives (groups) relevant for schedules
 * @param session The authenticated user session
 * @returns Promise resolving to an array of Beehives
 */
export async function fetchBeehives(session: AppSession | null): Promise<Beehive[]> {
  const operation = "fetch beehives for schedules";
  try {
    const response = await fetch(`${API_BASE_URL}/access/schedules/beehives`, {
        method: "GET",
        headers: createAuthHeaders(session),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }

    // Assuming direct array response
    const data: Beehive[] = await response.json();
    return data || [];
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

/**
 * Fetch all group stations relevant for schedules
 * @param session The authenticated user session
 * @returns Promise resolving to an array of Groups
 */
export async function fetchGroups(session: AppSession | null): Promise<Group[]> {
  const operation = "fetch group stations for schedules";
  try {
    const response = await fetch(`${API_BASE_URL}/access/schedules/groups`, {
        method: "GET",
        headers: createAuthHeaders(session),
    });

    if (!response.ok) {
      await handleApiError(response, operation);
    }

     // Assuming direct array response
    const data: Group[] = await response.json();
    return data || [];
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}