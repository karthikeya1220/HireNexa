"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ReloadIcon } from "@radix-ui/react-icons"
import apiClient from "@/lib/api-client"

// Add interface for API error
interface ApiError {
  message: string;
  status?: number;
  code?: string;
  data?: { error?: string };
}

export function MakeUserAdmin() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      toast({
        title: "Missing information",
        description: "Enter the user's email address.",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)

    try {
      // Resolve email -> uid (the role API matches on uid). Users only get a
      // row after their first sign-in / migration.
      const users = await apiClient.auth.getAllUsers()
      const match = Array.isArray(users)
        ? users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
        : undefined
      if (!match?.uid) {
        toast({
          title: "User not found",
          description: "No account with that email has signed in yet.",
          variant: "destructive"
        })
        return
      }

      // Server enforces admin-only access (PUT /auth/users/role) — a
      // non-admin caller receives a 403 and the catch block below reports it.
      await apiClient.auth.updateUserRole({ uid: match.uid, role: "admin" })

      toast({
        title: "Success!",
        description: `${email} has been granted admin privileges.`
      })

      setEmail("")
    } catch (error: unknown) {
      console.error("Error making user admin:", error)

      // Type guard to handle the error properly — prefer the server's
      // user-facing message (e.g. 403 "Not authorized...")
      const apiError = error as ApiError
      const errorMessage = apiError?.data?.error
        || (error instanceof Error ? error.message : "")
        || apiError?.message
        || "An unexpected error occurred"

      toast({
        title: "Failed to grant admin privileges",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="border rounded-lg p-6 shadow-sm bg-card">
      <h3 className="text-lg font-medium mb-4">Grant Admin Privileges</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">User Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p className="text-sm text-muted-foreground">
            The account must have signed in at least once (magic link).
          </p>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Make Admin"
          )}
        </Button>
      </form>
    </div>
  )
}
