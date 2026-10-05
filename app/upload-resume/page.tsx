"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FileText, ChevronRight, Search, BarChart2, Sparkles, Upload, Clock, Award, Zap, Sun, Moon } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DragDropUpload } from "@/components/drag-drop-upload"
import { useMobile } from "@/hooks/use-mobile"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/context/auth-context"
import { UserDropdown } from "@/components/user-dropdown"
import Link from "next/link"
import { useTheme } from "next-themes"
import { RecentFileCard } from "@/components/recent-file-card"
import apiClient from "@/lib/api-client"

// Define the RecentUpload interface
interface RecentUpload {
  id: string
  filename: string
  date: string
  fileSize: string
  fileType: "pdf" | "docx" | "doc"
  matchScore?: number
}

export default function UploadResumePage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMobile = useMobile()
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([])
  const [isLoadingUploads, setIsLoadingUploads] = useState(true)

  // Ensure theme toggle only renders client-side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Close sidebar by default on mobile
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }, [isMobile])

  // Fetch recent uploads via the API
  useEffect(() => {
    const fetchRecentUploads = async () => {
      if (!user) return

      setIsLoadingUploads(true)
      try {
        const data = await apiClient.resumes.getUserResumes(user.uid)
        const rows = (data as Array<{
          _id: string
          filename: string
          uploaded_at: string
        }>) || []

        const uploads: RecentUpload[] = rows.slice(0, 5).map((row) => {
          // Format the date
          const uploadDate = row.uploaded_at ? new Date(row.uploaded_at) : new Date()
          const formattedDate = formatDate(uploadDate)

          // Format the file size (mock for now)
          const fileSize = "250 KB" // This would ideally come from the actual file metadata

          // Determine file type from filename
          const filename = row.filename || "Unknown"
          const fileExtension = filename.split(".").pop()?.toLowerCase()
          const fileType = fileExtension === "pdf" ? "pdf" : fileExtension === "docx" ? "docx" : "doc"

          // Calculate match score (mock for now)
          const matchScore = Math.floor(Math.random() * 30) + 70 // Random score between 70-100

          return {
            id: row._id,
            filename,
            date: formattedDate,
            fileSize,
            fileType: fileType as "pdf" | "docx" | "doc",
            matchScore,
          }
        })

        setRecentUploads(uploads)
      } catch (error) {
        console.error("Error fetching recent uploads:", error)
      } finally {
        setIsLoadingUploads(false)
      }
    }

    if (user) {
      fetchRecentUploads()
    }
  }, [user])

  // Format date helper function
  const formatDate = (date: Date): string => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // If less than a minute ago
    if (diff < 60 * 1000) {
      return "Just now"
    }

    // If less than an hour ago
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000))
      return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`
    }

    // If today
    if (date.toDateString() === now.toDateString()) {
      return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    }

    // If yesterday
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    }

    // Otherwise show full date
    return date.toLocaleDateString() + ", " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24,
      },
    },
  }

  // Determine if we have recent uploads to show
  const hasRecentUploads = recentUploads.length > 0

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex overflow-hidden">
        {/* Decorative background elements */}
        <div className="fixed inset-0 -z-10 dot-pattern opacity-5"></div>
        {theme === "dark" && (
          <>
            {/* Dark mode background elements - matching landing page */}
            <div className="fixed top-0 left-0 w-full h-full bg-gray-900 z-[-1]"></div>
            <div className="fixed top-20 right-1/4 w-96 h-96 bg-gradient-to-r from-violet-600/5 to-blue-500/5 rounded-full filter blur-[100px] animate-pulse-slow"></div>
            <div className="fixed bottom-20 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-500/5 to-violet-600/5 rounded-full filter blur-[100px] animate-pulse-slow delay-1000"></div>
          </>
        )}

        {/* Sidebar */}
        <DashboardSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

        {/* Main Content */}
        <motion.div
          className="flex-1 min-h-screen relative"
          initial={false}
          animate={{
            marginLeft: isMobile ? 0 : isSidebarOpen ? "16rem" : "4.5rem",
            width: isMobile ? "100%" : isSidebarOpen ? "calc(100% - 16rem)" : "calc(100% - 4.5rem)",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <header
            className={`backdrop-blur-xl border-b sticky top-0 z-30 ${
              theme === "dark" ? "bg-gray-900/70 border-gray-800/50" : "bg-background/70 border-primary/10"
            }`}
          >
            <div className="max-w-full px-4 md:px-8 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-500 to-blue-500">
                    Dashboard
                  </h1>
                  <p className="text-muted-foreground text-sm">Upload and analyze your resume</p>
                </div>

                <div className="flex items-center space-x-4">
                  <motion.div
                    className="relative hidden md:block"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <input
                      type="text"
                      placeholder="Search..."
                      className={`py-2 pl-9 pr-4 rounded-lg focus:outline-none focus:ring-1 transition-colors w-[200px] ${
                        theme === "dark"
                          ? "bg-gray-800/50 border border-gray-700 text-gray-200 placeholder-gray-500 focus:border-violet-500 focus:ring-violet-500/30"
                          : "bg-muted/50 border border-border focus:border-primary focus:ring-primary"
                      }`}
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </motion.div>

                  {/* Theme toggle button */}
                  {mounted && (
                    <motion.button
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        theme === "dark" ? "bg-gray-800 hover:bg-gray-700" : "bg-muted/50 hover:bg-muted"
                      } transition-colors`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? (
                        <Sun className="w-5 h-5 text-yellow-400" />
                      ) : (
                        <Moon className="w-5 h-5 text-primary" />
                      )}
                    </motion.button>
                  )}

                  {user && <UserDropdown user={user} />}
                </div>
              </div>
            </div>
          </header>

          <motion.main
            className="max-w-full px-4 md:px-8 py-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div className="mb-8" variants={itemVariants}>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-violet-500/20 to-blue-500/20 text-violet-500 mb-4 text-sm font-medium">
                <Sparkles className="w-4 h-4 mr-2" />
                ATS Resume Analyzer
              </div>
              <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-violet-500 to-blue-500">
                Upload Your Resume
              </h2>
              <p className="text-muted-foreground">
                Our AI will analyze your resume against ATS systems and provide detailed feedback
              </p>
            </motion.div>

            {/* Upload Section */}
            <div className="grid md:grid-cols-3 gap-8">
              <motion.div className="md:col-span-2" variants={itemVariants}>
                <DragDropUpload />

                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">Recent Uploads</h3>
                    <Link
                      href="/upload-resume/all-resumes"
                      className="text-sm text-violet-500 flex items-center hover:underline group"
                    >
                      View all
                      <motion.div
                        animate={{ x: [0, 3, 0] }}
                        transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, repeatType: "loop" }}
                      >
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:ml-2 transition-all" />
                      </motion.div>
                    </Link>
                  </div>

                  {isLoadingUploads ? (
                    <div className="space-y-4">
                      {[1, 2].map((i) => (
                        <div key={i} className="glass-card border border-border animate-pulse">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-lg bg-primary/10"></div>
                              <div className="ml-3">
                                <div className="h-4 w-40 bg-muted rounded"></div>
                                <div className="h-3 w-24 bg-muted rounded mt-2"></div>
                              </div>
                            </div>
                            <div className="w-12 h-8 bg-muted rounded"></div>
                          </div>
                          <div className="h-8 w-full bg-muted rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : hasRecentUploads ? (
                    <div className="grid gap-4">
                      {recentUploads.map((file) => (
                        <RecentFileCard
                          key={file.id}
                          filename={file.filename}
                          date={file.date}
                          fileSize={file.fileSize}
                          fileType={file.fileType}
                          matchScore={file.matchScore}
                          id={file.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <motion.div
                      className={`rounded-xl p-6 shadow-lg border text-center py-12 ${
                        theme === "dark" ? "bg-gray-900/50 backdrop-blur-md border-gray-800" : "glass-card"
                      }`}
                      variants={itemVariants}
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="w-16 h-16 mx-auto bg-violet-500/10 rounded-full flex items-center justify-center mb-4">
                        <Upload className="w-8 h-8 text-violet-500" />
                      </div>
                      <h4 className="text-lg font-medium mb-2">No Recent Uploads</h4>
                      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        Upload your first resume to get started with ATS analysis and optimization
                      </p>
                      <motion.button
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 text-white font-medium"
                        whileHover={{ scale: 1.05, boxShadow: "0 10px 25px -5px rgba(139, 92, 246, 0.4)" }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Upload Resume
                        <Upload className="w-4 h-4 ml-2" />
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <motion.div
                  className={`mb-6 rounded-xl p-6 shadow-lg border ${
                    theme === "dark"
                      ? "bg-gray-900/50 backdrop-blur-md border-gray-800"
                      : "glass-card border border-primary/10"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-violet-500" />
                    Analysis Overview
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Upload your resume to see how it performs against ATS systems and get recommendations.
                  </p>

                  <div className="space-y-5">
                    <motion.div
                      className={`flex items-start p-3 rounded-lg ${
                        theme === "dark" ? "hover:bg-gray-800/50" : "hover:bg-violet-500/5"
                      } transition-colors`}
                      whileHover={{ x: 5 }}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                        <FileText className="w-5 h-5 text-violet-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">ATS Compatibility</h4>
                        <p className="text-sm text-muted-foreground">
                          Check if your resume can be properly parsed by ATS systems
                        </p>
                      </div>
                    </motion.div>

                    <motion.div
                      className={`flex items-start p-3 rounded-lg ${
                        theme === "dark" ? "hover:bg-gray-800/50" : "hover:bg-violet-500/5"
                      } transition-colors`}
                      whileHover={{ x: 5 }}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                        <Search className="w-5 h-5 text-violet-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">Keyword Analysis</h4>
                        <p className="text-sm text-muted-foreground">
                          Identify missing keywords for your target positions
                        </p>
                      </div>
                    </motion.div>

                    <motion.div
                      className={`flex items-start p-3 rounded-lg ${
                        theme === "dark" ? "hover:bg-gray-800/50" : "hover:bg-violet-500/5"
                      } transition-colors`}
                      whileHover={{ x: 5 }}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                        <BarChart2 className="w-5 h-5 text-violet-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">Content Scoring</h4>
                        <p className="text-sm text-muted-foreground">
                          Get section-by-section scoring and recommendations
                        </p>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>

                <motion.div
                  className={`rounded-xl p-6 shadow-lg border ${
                    theme === "dark"
                      ? "bg-gray-900/50 backdrop-blur-md border-gray-800"
                      : "glass-card border border-primary/10"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <div className="flex items-center mb-4">
                    <Zap className="w-5 h-5 mr-2 text-violet-500" />
                    <h3 className="text-lg font-semibold">Pro Tips</h3>
                  </div>

                  <div className="space-y-4">
                    <motion.div className="flex items-start group" whileHover={{ x: 3 }}>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center mr-3 flex-shrink-0 group-hover:from-violet-500/30 group-hover:to-blue-500/30 transition-colors">
                        <Clock className="w-4 h-4 text-violet-500" />
                      </div>
                      <p className="text-sm">Use a clean, simple format that ATS systems can easily parse</p>
                    </motion.div>

                    <motion.div className="flex items-start group" whileHover={{ x: 3 }}>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center mr-3 flex-shrink-0 group-hover:from-violet-500/30 group-hover:to-blue-500/30 transition-colors">
                        <Search className="w-4 h-4 text-violet-500" />
                      </div>
                      <p className="text-sm">Include keywords from the job description you&apos;re applying to</p>
                    </motion.div>

                    <motion.div className="flex items-start group" whileHover={{ x: 3 }}>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center mr-3 flex-shrink-0 group-hover:from-violet-500/30 group-hover:to-blue-500/30 transition-colors">
                        <Award className="w-4 h-4 text-violet-500" />
                      </div>
                      <p className="text-sm">Quantify your achievements with numbers and metrics</p>
                    </motion.div>

                    <motion.div className="flex items-start group" whileHover={{ x: 3 }}>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center mr-3 flex-shrink-0 group-hover:from-violet-500/30 group-hover:to-blue-500/30 transition-colors">
                        <FileText className="w-4 h-4 text-violet-500" />
                      </div>
                      <p className="text-sm">Tailor your resume for each job application</p>
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </motion.main>
        </motion.div>
      </div>
    </ProtectedRoute>
  )
}

