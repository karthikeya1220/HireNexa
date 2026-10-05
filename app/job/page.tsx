"use client"

import { useState, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { Plus, Briefcase, Search, Filter, ArrowUpDown, List } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"
import apiClient from "@/lib/api-client"

// Import components
import { JobCard } from "@/components/job/job-card"
import { JobCardSkeleton } from "@/components/job/job-card-skeleton"
import { EmptyState } from "@/components/job/empty-state"
import { JobPagination } from "@/components/job/job-pagination"
import { JobDetailsSheet } from "@/components/job/job-details-sheet"

// Import types
import type { Job } from "@/types/jobs"

interface JobApiResponse {
  _id: string;
  title: string;
  company: string;
  location: string;
  employment_type: string;
  experience_required: string;
  salary_range: string;
  created_at: string;
  description: string;
  status: string;
  total_applications?: number;
  shortlisted?: number;
  rejected?: number;
  in_progress?: number;
  benefits?: string[];
  requirements?: string[];
  skills_required?: string[];
  working_hours: string;
  mode_of_work: string;
  key_responsibilities: string[];
  nice_to_have_skills: string[];
  about_company: string;
  deadline: string;
  metadata?: {
    created_by?: string;
    created_by_id?: string;
    last_modified_by?: string;
  };
  assigned_recruiters?: string[];
}

export default function JobPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const { user } = useAuth()
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [jobsPerPage, setJobsPerPage] = useState(9)
  const [paginatedJobs, setPaginatedJobs] = useState<Job[]>([])
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    const fetchJobs = async () => {
      if (!user) {
        // Stop the spinner instead of returning early — a signed-out visit
        // would otherwise spin forever (this return used to skip the finally).
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        
        // Use API client to fetch jobs
        const response = await apiClient.jobs.getAll();
        // The API returns an array of jobs directly, not a { jobs: Job[] } object
        const jobsArray = Array.isArray(response) ? response : [];
        
        // Transform the data to match the Job type
        const transformedJobs: Job[] = jobsArray.map((job) => {
          // Explicitly cast the job to JobApiResponse to access _id property
          const jobData = job as unknown as JobApiResponse;
          return {
            job_id: jobData._id,
            title: jobData.title,
            company: jobData.company,
            location: jobData.location,
            employment_type: jobData.employment_type,
            experience_required: jobData.experience_required,
            salary_range: jobData.salary_range,
            created_at: new Date(jobData.created_at),
            description: jobData.description,
            status: jobData.status,
            total_applications: jobData.total_applications || 0,
            shortlisted: jobData.shortlisted || 0,
            rejected: jobData.rejected || 0,
            in_progress: jobData.in_progress || 0,
            benefits: jobData.benefits || [],
            requirements: jobData.requirements || [],
            skills_required: jobData.skills_required || [],
            working_hours: jobData.working_hours,
            mode_of_work: jobData.mode_of_work,
            key_responsibilities: jobData.key_responsibilities,
            nice_to_have_skills: jobData.nice_to_have_skills,
            about_company: jobData.about_company,
            deadline: jobData.deadline,
            metadata: {
              created_by: jobData.metadata?.created_by || "",
              created_by_id: jobData.metadata?.created_by_id || "",
              last_modified_by: jobData.metadata?.last_modified_by || "",
            },
            assigned_recruiters: jobData.assigned_recruiters || [],
          }
        });

        setJobs(transformedJobs)
        setFilteredJobs(transformedJobs)
      } catch (error) {
        console.error("Error fetching jobs:", error)
        toast({
          title: "Error",
          description: "Failed to load jobs",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchJobs()
  }, [user])

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false)
      setJobsPerPage(6)
    } else {
      setJobsPerPage(viewMode === "grid" ? 9 : 6)
    }
  }, [isMobile, viewMode])

  useEffect(() => {
    let result = [...jobs]

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (job) =>
          job.title?.toLowerCase().includes(query) ||
          job.company?.toLowerCase().includes(query) ||
          job.location?.toLowerCase().includes(query) ||
          job.skills_required?.some((skill: string) => skill && skill.toLowerCase().includes(query)),
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((job) => job.status === statusFilter)
    }

    // Apply sort
    result.sort((a, b) => {
      if (sortOrder === "newest") {
        return b.created_at.getTime() - a.created_at.getTime()
      } else {
        return a.created_at.getTime() - b.created_at.getTime()
      }
    })

    setFilteredJobs(result)
    setTotalPages(Math.ceil(result.length / jobsPerPage))
    setCurrentPage(1) // Reset to first page when filters change
  }, [jobs, searchQuery, statusFilter, sortOrder, jobsPerPage])

  // Update paginated jobs when filtered jobs or pagination changes
  useEffect(() => {
    const startIndex = (currentPage - 1) * jobsPerPage
    const endIndex = startIndex + jobsPerPage
    setPaginatedJobs(filteredJobs.slice(startIndex, endIndex))
  }, [filteredJobs, currentPage, jobsPerPage])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setIsSheetOpen(true)
  }

  const handleJobUpdate = (updatedJob: Job) => {
    setJobs((prevJobs) => prevJobs.map((job) => (job.job_id === updatedJob.job_id ? updatedJob : job)))
  }

  // Add job deletion function after the handleJobUpdate function
  const handleJobDelete = async (jobId: string) => {
    try {
      // Call the API to delete the job
      await apiClient.jobs.delete(jobId);
      
      // Update the state by filtering out the deleted job
      setJobs((prevJobs) => prevJobs.filter((job) => job.job_id !== jobId));
      
      toast({
        title: "Success",
        description: "Job deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting job:", error);
      toast({
        title: "Error",
        description: "Failed to delete job",
        variant: "destructive",
      });
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
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="container mx-auto py-8 px-4 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">Job Management</h1>
              <p className="text-muted-foreground">Create and manage your job postings</p>
            </div>
            <Button
              onClick={() => router.push("/create-job")}
              className="flex items-center bg-gradient-to-r from-primary to-primary/80 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Job
            </Button>
          </div>

          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-auto flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search jobs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center">
                        <Filter className="w-4 h-4 mr-2" />
                        {statusFilter === "all" ? "All Status" : statusFilter === "active" ? "Active" : "Inactive"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter("active")}>Active</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter("inactive")}>Inactive</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center">
                        <ArrowUpDown className="w-4 h-4 mr-2" />
                        {sortOrder === "newest" ? "Newest First" : "Oldest First"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSortOrder("newest")}>Newest First</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortOrder("oldest")}>Oldest First</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center"
                    onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                  >
                    {viewMode === "grid" ? (
                      <>
                        <List className="w-4 h-4 mr-2" />
                        List View
                      </>
                    ) : (
                      <>
                        <Briefcase className="w-4 h-4 mr-2" />
                        Grid View
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array(6)
                .fill(0)
                .map((_, index) => (
                  <JobCardSkeleton key={index} />
                ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <EmptyState
              hasFilters={searchQuery !== "" || statusFilter !== "all"}
              onCreateJob={() => router.push("/create-job")}
            />
          ) : (
            <>
              <AnimatePresence>
                <div
                  className={
                    viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "grid gap-4"
                  }
                >
                  {paginatedJobs.map((job) => (
                    <JobCard
                      key={job.job_id}
                      job={job}
                      viewMode={viewMode}
                      onClick={handleJobClick}
                      isAssignedToCurrentUser={(job.assigned_recruiters || []).includes(user?.uid || "")}
                    />
                  ))}
                </div>
              </AnimatePresence>

              <JobPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                isMobile={isMobile}
              />
            </>
          )}
        </div>
      </motion.div>

      <JobDetailsSheet
        job={selectedJob}
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onJobUpdate={handleJobUpdate}
        onDeleteJob={handleJobDelete}
        currentUserId={user?.uid}
      />
    </div>
  )
}

