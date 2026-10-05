"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import apiClient from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface UserProfile {
  name: string
  email: string
  role: string
  updatedAt?: string
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    email: "",
    role: ""
  })

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        // Stop the spinner instead of returning early (see job/page.tsx).
        setIsLoading(false)
        return
      }

      try {
        const data = await apiClient.auth.getCurrentUser() as Partial<UserProfile> | null
        if (data) {
          setProfile({
            name: data.name || "",
            email: data.email || "",
            role: data.role || ""
          })
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
        toast.error("Failed to load profile")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [user])

  const handleSave = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      // Never write `role` from the client — roles are server-managed only.
      await apiClient.auth.updateUser({ name: profile.name })
      toast.success("Profile updated successfully")
      setIsEditing(false)
    } catch (error) {
      console.error("Error updating profile:", error)
      toast.error("Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">
            Manage your account settings
          </p>
        </div>

        <div className="space-y-6 p-6 border rounded-lg">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Full Name
            </label>
            <Input
              id="name"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              disabled={!isEditing}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium">
              Role
            </label>
            <Input
              id="role"
              value={profile.role}
              disabled
              className="bg-muted capitalize"
              title="Roles are managed by an administrator"
            />
          </div>

          <div className="flex justify-end gap-4">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>

          {profile.updatedAt && (
            <p className="text-sm text-muted-foreground text-right">
              Last updated: {new Date(profile.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}