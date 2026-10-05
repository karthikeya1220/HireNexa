"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { useMediaQuery } from "@/hooks/use-media-query"
import { motion } from "framer-motion"
import { toast } from "@/components/ui/use-toast"
import { Icons } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ProfileCard } from "@/components/profiles/profile-card"
import { EmptyState } from "@/components/profiles/empty-state"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import apiClient from "@/lib/api-client"

interface Education {
  degree: string;
  major: string;
  institute: string;
  graduation_year?: string;
  location?: string;
}

interface WorkExperience {
  company: string;
  position: string;
  dates: string;
  responsibilities: string[];
  location?: string;
}

interface Analysis {
  name: string;
  email: string;
  key_skills: string[];
  education_details: Education[];
  work_experience_details: WorkExperience[];
  experience_years?: number;
}

interface Profile {
  _id: string;
  filename: string;
  filelink: string;
  uploaded_at: string;
  analysis: Analysis;
  aiAnalysis?: string;
  companyFeedback?: string[];
}

interface ResumeApiResponse {
  _id: string;
  filename: string;
  filelink: string;
  uploaded_at?: string;
  created_at?: string;
  analysis: Analysis;
  aiAnalysis?: string;
  companyFeedback?: string[];
}

export default function ProfilesPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const { user } = useAuth()
  const router = useRouter()

  // Fetch profiles from API
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user) {
        // Stop the spinner instead of returning early (see job/page.tsx).
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      console.log('Fetching profiles for user:', user.uid);
      try {
        // Use the API client to get resumes
        const response = await apiClient.resumes.getUserResumes(user.uid);
        const resumes = response as ResumeApiResponse[];
        
        // Transform MongoDB documents to match our UI needs
        const transformedProfiles = resumes.map((resume: ResumeApiResponse) => ({
          _id: resume._id,
          filename: resume.filename,
          filelink: resume.filelink,
          uploaded_at: resume.uploaded_at || resume.created_at || new Date().toISOString(),
          analysis: resume.analysis,
          aiAnalysis: resume.aiAnalysis,
          companyFeedback: resume.companyFeedback
        }));
        
        setProfiles(transformedProfiles);
        setFilteredProfiles(transformedProfiles);
      } catch (error) {
        console.error("Error fetching profiles:", error)
        toast({
          title: "Error",
          description: "Failed to fetch profiles",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfiles()
  }, [user])

  // Filter profiles based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProfiles(profiles)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = profiles.filter((profile) => {
      const { analysis } = profile

      // Search in name and email
      if (
        (analysis?.name && analysis.name.toLowerCase().includes(query)) || 
        (analysis?.email && analysis.email.toLowerCase().includes(query))
      ) {
        return true
      }

      // Search in skills
      if (analysis?.key_skills?.some((skill) => skill && skill.toLowerCase().includes(query))) {
        return true
      }

      // Search in work experience
      if (
        analysis?.work_experience_details?.some(
          (exp) => 
            (exp.company && exp.company.toLowerCase().includes(query)) || 
            (exp.position && exp.position.toLowerCase().includes(query))
        )
      ) {
        return true
      }

      // Search in education
      if (
        analysis?.education_details?.some(
          (edu) =>
            (edu.degree && edu.degree.toLowerCase().includes(query)) ||
            (edu.major && edu.major.toLowerCase().includes(query)) ||
            (edu.institute && edu.institute.toLowerCase().includes(query))
        )
      ) {
        return true
      }

      return false
    })

    setFilteredProfiles(filtered)
  }, [searchQuery, profiles])

  // Add a delete resume function
  // const handleDeleteResume = async (id: string) => {
  //   try {
  //     await apiClient.resumes.deleteResume(id);
  //     // Update profiles list after deletion
  //     setProfiles(profiles.filter(profile => profile._id !== id));
  //     toast({
  //       title: "Success",
  //       description: "Resume deleted successfully",
  //     })
  //   } catch (error) {
  //     console.error("Error deleting resume:", error);
  //     toast({
  //       title: "Error",
  //       description: "Failed to delete resume",
  //       variant: "destructive",
  //     })
  //   }
  // }

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      <DashboardSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <motion.div
        className="flex-1 min-h-screen relative"
        initial={false}
        animate={{
          marginLeft: isMobile ? 0 : isSidebarOpen ? "16rem" : "4.5rem",
          width: isMobile ? "100%" : isSidebarOpen ? "calc(100% - 16rem)" : "calc(100% - 4.5rem)",
          paddingLeft: 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="py-8 px-3 md:px-5 max-w-[1500px] mx-auto">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold">Profile Management</h1>
                <p className="text-muted-foreground mt-1">Manage and analyze your uploaded resumes</p>
              </div>
              <Button onClick={() => router.push("/upload-resume")} className="flex items-center gap-2">
                <Icons.upload className="w-4 h-4" />
                Upload New Resume
              </Button>
            </div>

            {/* Search and Filter Section */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, skills, company..."
                className="pl-10 pr-4"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Content Section */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="border rounded-lg p-6 space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProfiles.length === 0 ? (
            searchQuery ? (
              <div className="border border-dashed rounded-lg p-8">
                <EmptyState
                  title="No matching profiles"
                  description={`No profiles found matching "${searchQuery}". Try a different search term or clear your search.`}
                  actionLabel="Clear Search"
                  actionHref="#"
                  icon="file"
                />
              </div>
            ) : (
              <div className="border border-dashed rounded-lg p-8">
                <EmptyState
                  title="No profiles yet"
                  description="Upload your first resume to get started with profile analysis"
                  actionLabel="Upload Resume"
                  actionHref="/upload-resume"
                  icon="upload"
                />
              </div>
            )
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredProfiles.length} {filteredProfiles.length === 1 ? "profile" : "profiles"}
                  {searchQuery && ` for "${searchQuery}"`}
                </p>
                {searchQuery && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")} className="text-xs h-8">
                    Clear search
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProfiles.map((profile) => (
                  <ProfileCard key={profile.filename} profile={profile} />
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

