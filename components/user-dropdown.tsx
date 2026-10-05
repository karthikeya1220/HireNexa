"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  User as UserIcon, 
  Settings, 
  FileText, 
  LogOut, 
  ChevronDown 
} from "lucide-react"
import type { AuthUser } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface UserDropdownProps {
  user: AuthUser
}

export function UserDropdown({ user }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      toast({
        title: "Signed out successfully",
        variant: "default",
      })
      router.push('/login')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred while signing out"
      toast({
        title: "Error signing out",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 hover:bg-muted rounded-lg p-2 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <UserIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium">{user?.email}</p>
          <p className="text-xs text-muted-foreground">Account Settings</p>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 mt-2 w-64 rounded-lg border bg-background shadow-lg"
          >
            <div className="p-3 border-b">
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Manage your account</p>
            </div>

            <div className="p-2">
              <Link
                href="/upload-resume"
                className="flex items-center space-x-2 rounded-md p-2 hover:bg-muted transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm">Dashboard</span>
              </Link>

              <Link
                href="/settings"
                className="flex items-center space-x-2 rounded-md p-2 hover:bg-muted transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">Settings</span>
              </Link>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center space-x-2 rounded-md p-2 hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Sign out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
