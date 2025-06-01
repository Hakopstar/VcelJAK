"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { RefreshCw, Clock, AlertCircle } from "lucide-react"
import { toast } from "~/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { useSession, signOut } from "next-auth/react";
// Define hardware session type
type HardwareSession = {
  id: string
  hubId: string
  hubName: string
  startTime: string
  endTime: string | null
}


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';



export default function SessionsPage() {
  const [hardwareSessions, setHardwareSessions] = useState<HardwareSession[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { data: session, status } = useSession();

  // Fetch sessions on component mount
  useEffect(() => {
    if (status === "authenticated") {
      fetchSessions();
    }
  }, [status, session]);

  const fetchSessions = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Replace with actual API endpoint when available
      const response = await fetch(`${API_BASE_URL}/access/sessions/get_sessions`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session?.accessToken}`
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.status}`)
      }

      const data = await response.json()
      setHardwareSessions(data)
      console.log("Faile:")
      console.log(data)
    } catch (err) {
      console.error("Error fetching sessions:", err)
      setError("Failed to load sessions. Please try again later.")
      toast({
        title: "Error",
        description: "Failed to load sessions. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchSessions()
    setIsRefreshing(false)
  }

  const handleTerminateSession = async (sessionId: string) => {
    try {
      // Replace with actual API endpoint when available
      const response = await fetch(`${API_BASE_URL}/access/sessions/terminate_session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`,
          "X-CSRF-TOKEN": session?.csrftoken
        },
        body: JSON.stringify({ sessionId }),
      })
      if (response.status === 401) {
        signOut();
      }
      if (!response.ok) {
        throw new Error(`Failed to terminate session: ${response.status}`)
      }

      // Refresh the sessions list
      await fetchSessions()

      toast({
        title: "Session terminated",
        description: "The session has been terminated successfully.",
      })
    } catch (err) {
      console.error("Error terminating session:", err)
      toast({
        title: "Error",
        description: "Failed to terminate session. Please try again.",
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("en-GB")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Hardware Sessions</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Hardware Sessions</CardTitle>
          <CardDescription>Monitor active connections from hardware hubs.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : ((hardwareSessions.length === 0) || (!Array.isArray(hardwareSessions))) ? (
            <div className="text-center py-8 text-muted-foreground">No active hardware sessions found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hub</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                
                {hardwareSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{session.hubName}</span>
                        <span className="text-xs text-muted-foreground">ID: {session.hubId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{formatDate(session.startTime)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{session.endTime ? formatDate(session.endTime) : "Active"}</TableCell>
                    <TableCell>
                      {session.endTime && (
                        <Button variant="destructive" size="sm" onClick={() => handleTerminateSession(session.id)}>
                          Terminate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

