"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Mail, Shield, Upload, CheckCircle, Sun, Moon, ArrowLeft } from 'lucide-react'
import Link from "next/link"
import { useRouter } from "next/navigation"
import { auth } from "@/FirebaseConfig"
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth"
import type { FirebaseError } from "firebase/app"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/auth-context"
import { useTheme } from "next-themes"

export default function LoginPage() {
  const { user } = useAuth()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Ensure theme toggle only renders client-side
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (user) {
      router.push("/upload-resume")
    }
  }, [user, router])

  // Check if the user is coming back from email link
  useEffect(() => {
    // Get the email from localStorage
    const savedEmail = window.localStorage.getItem("emailForSignIn")

    if (isSignInWithEmailLink(auth, window.location.href)) {
      // Additional state check
      if (!savedEmail) {
        toast({
          title: "Error",
          description: "Could not find your email. Please try signing in again.",
          variant: "destructive",
        })
        return
      }

      setIsLoading(true)
      // Sign in with email link
      signInWithEmailLink(auth, savedEmail, window.location.href)
        .then(() => {
          // Clear email from storage
          window.localStorage.removeItem("emailForSignIn")
          // Redirect to dashboard
          router.push("/upload-resume")
          toast({
            title: "Success",
            description: "You have been successfully signed in!",
          })
        })
        .catch((error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to sign in. Please try again.",
            variant: "destructive",
          })
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [router, toast])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`, // Redirect back to login page to handle the sign-in
        handleCodeInApp: true,
      }

      await sendSignInLinkToEmail(auth, email, actionCodeSettings)

      // Save the email for later use
      window.localStorage.setItem("emailForSignIn", email)

      setSubmitted(true)
      toast({
        title: "Check your email",
        description: "We've sent you a magic link to sign in.",
      })
    } catch (error: unknown) {
      const firebaseError = error as FirebaseError
      toast({
        title: "Error",
        description: firebaseError.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // If loading, show loading state
  if (isLoading && isSignInWithEmailLink(auth, window.location.href)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 rounded-full bg-violet-500 opacity-30 animate-ping"></div>
            <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-foreground mt-6 text-lg">Signing you in...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      {/* Decorative Elements */}
      <div className="absolute inset-0 -z-10">
        {theme === "dark" ? (
          <>
            {/* Dark mode background elements */}
            <div className="absolute top-0 left-0 w-full h-full bg-gray-900 z-[-1]"></div>
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-violet-600/10 to-transparent rounded-full filter blur-[80px]"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full filter blur-[80px]"></div>
            <div className="absolute inset-0 dot-pattern opacity-[0.03]"></div>
          </>
        ) : (
          <>
            {/* Light mode background elements - improved for visibility */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 via-purple-100 to-blue-100 z-[-1]"></div>
            <div className="absolute inset-0 dot-pattern opacity-10"></div>
          </>
        )}
      </div>

      {/* Header with theme toggle and back button */}
      <header className="w-full py-4 px-6 flex justify-between items-center relative z-10">
        <Link 
          href="/" 
          className={`flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-gray-800"} hover:opacity-80 transition-opacity`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Home</span>
        </Link>
        
        {mounted && (
          <motion.button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              theme === "dark" 
                ? "bg-gray-800 hover:bg-gray-700" 
                : "bg-white shadow-md hover:bg-gray-50"
            } backdrop-blur-sm transition-colors`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-yellow-300" />
            ) : (
              <Moon className="w-5 h-5 text-gray-700" />
            )}
          </motion.button>
        )}
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={submitted ? "submitted" : "form"}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="w-full"
            >
              {/* Logo */}
              <motion.div
                className="text-center mb-8"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Link href="/" className="inline-flex items-center gap-3">
                  <div className={`w-14 h-14 ${theme === "dark" ? "bg-gray-800" : "bg-violet-600"} rounded-2xl flex items-center justify-center shadow-xl`}>
                    <Upload className={`w-7 h-7 ${theme === "dark" ? "text-violet-400" : "text-white"}`} />
                  </div>
                  <span className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>ResumeAI</span>
                </Link>
              </motion.div>

              {!submitted ? (
                <motion.div
                  className={`rounded-2xl backdrop-blur-md shadow-2xl overflow-hidden ${
                    theme === "dark" 
                      ? "bg-gray-900/70 border border-gray-800" 
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <div className="p-8">
                    <div className="text-center mb-8">
                      <h1 className={`text-2xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>Welcome Back</h1>
                      <p className={`${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                        Sign in with magic link - no password required
                      </p>
                    </div>

                    <form onSubmit={handleSignIn} className="space-y-6">
                      <div>
                        <label htmlFor="email" className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-white" : "text-gray-700"}`}>
                          Email Address
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl pl-12 ${
                              theme === "dark"
                                ? "bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
                                : "bg-white border border-gray-300 text-gray-800 placeholder-gray-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
                            } transition-colors`}
                            placeholder="john@example.com"
                            required
                          />
                          <Mail className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${theme === "dark" ? "text-violet-400" : "text-violet-500"}`} />
                        </div>
                      </div>

                      <motion.button
                        type="submit"
                        disabled={isLoading}
                        className="w-full relative py-3 rounded-xl font-medium text-white shadow-lg overflow-hidden"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {/* Button background with animated gradient */}
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-blue-500"></div>
                        
                        {/* Animated shine effect */}
                        <motion.div 
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          animate={{ 
                            x: ["0%", "100%"],
                            opacity: [0, 0.5, 0]
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity, 
                            repeatType: "loop",
                            repeatDelay: 1
                          }}
                        />
                        
                        {/* Button content */}
                        <div className="relative flex items-center justify-center">
                          {isLoading ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex items-center justify-center"
                            >
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            </motion.div>
                          ) : (
                            <span className="flex items-center justify-center">
                              Sign In with Email
                              <motion.div
                                animate={{ x: [0, 5, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, repeatType: "loop" }}
                              >
                                <ArrowRight className="ml-2 w-5 h-5" />
                              </motion.div>
                            </span>
                          )}
                        </div>
                      </motion.button>
                    </form>
                  </div>

                  <div className={`px-8 py-4 ${theme === "dark" ? "bg-gray-800/70 border-t border-gray-700" : "bg-gray-50 border-t border-gray-200"}`}>
                    <div className="flex items-center justify-center text-sm">
                      <Shield className={`w-4 h-4 mr-2 ${theme === "dark" ? "text-violet-400" : "text-violet-500"}`} />
                      <span className={`${theme === "dark" ? "text-white/80" : "text-gray-600"}`}>
                        Secure, passwordless sign in
                      </span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  className={`rounded-2xl backdrop-blur-md shadow-2xl p-8 ${
                    theme === "dark" 
                      ? "bg-gray-900/70 border border-gray-800" 
                      : "bg-white border border-gray-200"
                  }`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <motion.div
                    className="w-20 h-20 mx-auto mb-6 relative"
                    animate={{
                      boxShadow: [
                        "0px 0px 0px rgba(139, 92, 246, 0.3)",
                        "0px 0px 30px rgba(139, 92, 246, 0.6)",
                        "0px 0px 0px rgba(139, 92, 246, 0.3)",
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 opacity-20 animate-pulse"></div>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 flex items-center justify-center">
                      <Mail className="w-10 h-10 text-white" />
                    </div>
                  </motion.div>
                  
                  <h2 className={`text-2xl font-bold mb-3 text-center ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                    Check Your Email
                  </h2>
                  
                  <p className={`text-center mb-8 ${theme === "dark" ? "text-white/80" : "text-gray-600"}`}>
                    We&apos;ve sent a magic link to:
                    <br />
                    <span className={`font-medium ${theme === "dark" ? "text-white" : "text-gray-800"}`}>{email}</span>
                  </p>
                  
                  <div className="flex flex-col items-center gap-4">
                    <motion.button
                      onClick={() => setSubmitted(false)}
                      className={`text-sm flex items-center ${theme === "dark" ? "text-violet-400 hover:text-violet-300" : "text-violet-600 hover:text-violet-700"}`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Use a different email
                    </motion.button>
                    
                    <div className={`text-xs ${theme === "dark" ? "text-white/60" : "text-gray-500"}`}>
                      The magic link will expire in 15 minutes
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.div
                className="mt-8 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center justify-center mb-3">
                  <CheckCircle className={`w-4 h-4 mr-2 ${theme === "dark" ? "text-violet-400" : "text-violet-500"}`} />
                  <span className={`text-sm ${theme === "dark" ? "text-white/80" : "text-gray-600"}`}>
                    No password to remember
                  </span>
                </div>
                
                <div className={`text-sm ${theme === "dark" ? "text-white/60" : "text-gray-500"}`}>
                  Accounts are provisioned by an administrator
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}