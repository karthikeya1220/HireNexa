"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { motion } from "framer-motion"
import { useMediaQuery } from "@/hooks/use-media-query"
import { toast } from "@/components/ui/use-toast"
import { ProfileHeader } from "@/components/profiles/profile-header"
import { ProfileSummary } from "@/components/profiles/profile-summary"
import { EducationSection } from "@/components/profiles/education-section"
import { ExperienceSection } from "@/components/profiles/experience-section"
import { SkillsSection } from "@/components/profiles/skills-section"
import { CompanyFeedback } from "@/components/profile/company-feedback"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import apiClient from "@/lib/api-client"

interface Analysis {
  name: string
  email: string
  key_skills: string[]
  education_details: Array<{
    degree: string
    major: string
    institute: string
    graduation_year?: string
    location?: string
  }>
  work_experience_details: Array<{
    company: string
    position: string
    dates: string
    responsibilities: string[]
    location?: string
  }>
  experience_years?: number
  profile_summary?: string
}

interface Profile {
  _id: string
  filename: string
  filelink: string
  uploaded_at: string | { seconds: number; nanoseconds: number }
  created_at?: string
  aiAnalysis?: string
  analysis?: Analysis
  profile_summary?: string | null
  companyFeedback?: string[]
  uploadedAt: {
    seconds: number
    nanoseconds: number
  }
}

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user || !params.filename) {
        // Stop the spinner instead of returning early (see job/page.tsx).
        setIsLoading(false)
        return
      }

      try {
        // Fetch the specific resume by ID using the API client
        const resumeData = await apiClient.resumes.getResume(params.filename as string) as Profile;
        
        if (resumeData) {
          // Convert timestamp or ISO string to a format compatible with ProfileHeader
          const uploadTimestamp: string | { seconds?: number } =
            resumeData.uploaded_at || resumeData.created_at || new Date().toISOString();
          let timestampSeconds = 0;
          
          // If it's a string date, convert to timestamp
          if (typeof uploadTimestamp === 'string') {
            timestampSeconds = Math.floor(new Date(uploadTimestamp).getTime() / 1000);
          } else if (uploadTimestamp.seconds) {
            // If it already has seconds property, use it directly
            timestampSeconds = uploadTimestamp.seconds;
          }
          
          const profileData: Profile = {
            _id: resumeData._id || '',
            filename: resumeData.filename || '',
            filelink: resumeData.filelink || '',
            uploaded_at: resumeData.uploaded_at || resumeData.created_at || new Date().toISOString(),
            aiAnalysis: resumeData.aiAnalysis,
            analysis: resumeData.analysis,
            profile_summary: resumeData.analysis?.profile_summary || undefined,
            companyFeedback: resumeData.companyFeedback,
            // Add uploadedAt property in the format expected by ProfileHeader
            uploadedAt: {
              seconds: timestampSeconds,
              nanoseconds: 0
            }
          }
          setProfile(profileData)
        } else {
          toast({
            title: "Profile not found",
            description: "The requested profile could not be found",
            variant: "destructive",
          })
          router.push("/profiles")
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
        toast({
          title: "Error",
          description: "Failed to fetch profile",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [user, params.filename, router])

  const handleViewResume = async () => {
    if (!profile?._id) {
      toast({
        title: "Error",
        description: "Resume file not found",
        variant: "destructive",
      })
      return
    }

    try {
      // First, try to get the file content directly through our API client with auth
      try {
        const response = await apiClient.resumes.getResumeContent(profile._id);
        
        // Create a blob URL from the response and open it
        if (response && response.data) {
          const blob = new Blob([response.data], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          return;
        }
      } catch (apiError) {
        console.error("Error fetching resume content through API:", apiError);
        // Fall through to alternative methods
      }

      // If the direct API method failed, try to use the file link
      if (profile.filelink) {
        // If filelink is a storage URL, we need to fetch it with authentication
        window.open(profile.filelink, "_blank");
        return;
      }

      toast({
        title: "Error",
        description: "Could not view resume. Try downloading instead.",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error viewing resume:", error)
      toast({
        title: "Error",
        description: "Failed to open resume. Please try downloading instead.",
        variant: "destructive",
      })
    }
  }

  const handleDownloadResume = async () => {
    if (!profile?._id) {
      toast({
        title: "Error",
        description: "Resume file not found",
        variant: "destructive",
      })
      return
    }

    try {
      // Try to get the file through the API client first
      try {
        const response = await apiClient.resumes.downloadResume(profile._id);
        
        if (response && response.data) {
          // Create a blob from the response data
          const blob = new Blob([response.data], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          
          // Create a temporary anchor element to trigger download
          const a = document.createElement("a");
          a.href = url;
          a.download = profile.filename || "resume.pdf";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Clean up the blob URL
          setTimeout(() => URL.revokeObjectURL(url), 100);
          
          toast({
            title: "Success",
            description: "Resume download started",
          });
          return;
        }
      } catch (apiError) {
        console.error("Error downloading through API:", apiError);
        // Fall through to alternative methods
      }

      // If API download fails, try to use the filelink directly
      if (profile.filelink) {
        const a = document.createElement("a");
        a.href = profile.filelink;
        a.download = profile.filename || "resume.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        toast({
          title: "Success",
          description: "Resume download started",
        });
        return;
      }

      toast({
        title: "Error",
        description: "Failed to download resume",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error downloading resume:", error)
      toast({
        title: "Error",
        description: "Failed to download resume",
        variant: "destructive",
      })
    }
  }

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
        <div className="py-8 px-3 md:px-5 max-w-5xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading profile details...</p>
              </div>
            </div>
          ) : profile ? (
            <div className="space-y-6">
              {/* Header Section */}
              <ProfileHeader
                profile={profile}
                onViewResume={handleViewResume}
                onDownloadResume={handleDownloadResume}
              />

              {/* Tabs Navigation */}
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid grid-cols-3 md:w-[400px]">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="feedback">Feedback</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6 mt-6">
                  {profile.analysis && <ProfileSummary analysis={profile.analysis} />}

                  {profile.analysis?.key_skills && <SkillsSection skills={profile.analysis.key_skills} />}
                </TabsContent>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-6 mt-6">
                  {profile.analysis?.work_experience_details && (
                    <ExperienceSection workExperience={profile.analysis.work_experience_details} />
                  )}

                  {profile.analysis?.education_details && (
                    <EducationSection educationDetails={profile.analysis.education_details} />
                  )}
                </TabsContent>

                {/* Feedback Tab */}
                <TabsContent value="feedback" className="mt-6">
                  <div className="rounded-lg border bg-card p-6 shadow-sm">
                    <CompanyFeedback filename={profile.filename} filelink={profile.filelink} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="text-center">
                <div className="rounded-full bg-primary/10 p-4 mb-4 mx-auto">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Profile Not Found</h3>
                <p className="text-muted-foreground mb-6">
                  The requested profile could not be found or has been deleted.
                </p>
                <button
                  onClick={() => router.push("/profiles")}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                  Return to Profiles
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

