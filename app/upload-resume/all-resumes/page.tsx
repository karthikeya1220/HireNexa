"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/auth-context"
import apiClient from "@/lib/api-client"
import { motion } from "framer-motion"
import { RecentFileCard } from "@/components/recent-file-card"
import { FileText } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"


interface ResumeData {
  filename: string
  filelink: string
  uploadedAt: string
  analysis: {
    name: string
    email: string
    phone_number?: string
    social_profile_links?: string[]
    key_skills: string[]
    education_details: Array<{
      degree: string
      major: string
      institute: string
      location: string
      dates: string
    }>
    work_experience_details: Array<{
      company: string
      title: string
      location: string
      dates: string
      responsibilities: string[]
    }>
    project_experience?: Array<{
      name: string
      description: string
      technologies: string[]
    }>
    profile_summary: string
    score?: number
  }
}

export default function AllResumesPage() {
  const [resumes, setResumes] = useState<ResumeData[]>([])
  const [loading, setLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const fetchResumes = async () => {
      if (!user) return;
    
      try {
        const data = await apiClient.resumes.getUserResumes(user.uid)
        const rows = (data as Array<{
          filename: string
          filelink: string
          uploaded_at: string
          analysis: ResumeData["analysis"]
        }>) || []
    
        setResumes(rows.map((row) => ({
          filename: row.filename,
          filelink: row.filelink,
          uploadedAt: row.uploaded_at,
          analysis: row.analysis
        })));
      } catch (error) {
        console.error("Error fetching resumes:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResumes();
    
  }, [user])

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <DashboardSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <h1 className="text-3xl font-bold mb-8">All Uploaded Resumes</h1>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3">Loading resumes...</span>
        </div>
      ) : resumes.length > 0 ? (
        <div className="space-y-4">
          {resumes.map((resume, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <RecentFileCard
                filename={resume.filename}
                fileSize="N/A"
                date={formatDate(resume.uploadedAt)}
                id={resume.filelink}
                fileType={resume.filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 
                         resume.filename.toLowerCase().endsWith('.docx') ? 'docx' : 'doc'}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No resumes found</h3>
          <p className="text-muted-foreground">
            You haven&apos;t uploaded any resumes yet.
          </p>
        </div>
      )}
    </div>
  )
}
