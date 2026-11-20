"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  ArrowLeft,
  LayoutGrid,
  Grid3X3,
  List,
  Search,
  Filter,
  SlidersHorizontal,
  User,
  Briefcase,
  GraduationCap,
  Clock,
  Mail,
  Calendar,
  DollarSign,
  Building,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { analyzeBatchMatches } from "@/utils/analyze-match"
import { toast } from "sonner"
import { format } from "date-fns"
import { HiringStagesBoard } from "@/components/hiring-stages-board"
import { useHiringStages } from "@/store/hiring-stages"
import { Input } from "@/components/ui/input"
import { CandidateDetailsSheet } from "@/components/candidate-details-sheet"
import { CandidateGridView } from "@/components/candidate-grid-view"
import { Pagination } from "@/components/pagination"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { filterDuplicateCandidates } from "@/utils/filter-duplicates"
import apiClient from "@/lib/api-client"

interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

interface TransformedResume {
  filename: string;
  analysis: ResumeAnalysis;
  userId: string;
  userEmail: string;
}

import {
  type MatchAnalysis,
  type RubricCategoryScore,
  type RubricBonus,
  type GitHubProfileData,
} from "@/utils/analyze-match"

interface WorkExperience {
  company: string
  position: string
  duration?: {
    start: string
    end?: string
  }
  responsibilities?: string[]
  technologies?: string[]
}

interface EducationDetail {
  degree: string;
  major: string;
  institute: string;
}

interface ResumeAnalysis {
  name: string;
  email: string;
  key_skills: string[];
  education_details: EducationDetail[];
  work_experience_details: WorkExperience[];
}

interface Resume {
  filename: string;
  analysis: ResumeAnalysis;
  userId: string;
  userEmail: string;
}

interface User {
  uid: string;
  email: string;
  role?: string;
}

export interface Candidate {
  filename: string
  name: string
  email: string
  matchAnalysis: MatchAnalysis
  analysis: {
    key_skills: string[]
    education_details: Array<{
      degree: string
      major: string
      institute: string
    }>
    work_experience_details: WorkExperience[]
  }
  tracking?: CandidateTracking
  userId?: string
  userEmail?: string
}

export type CandidateStatus =
  | "shortlisted"
  | "contacted"
  | "interested"
  | "not_interested"
  | "rate_confirmed"
  | "interview_scheduled"
  | "approved"
  | "disapproved"
  | "pending"

interface AdditionalStatusData {
  rateConfirmed?: number
  interviewDate?: string
  contactedDate?: string
  notes?: string
  reason?: string
  feedback?: string
}

interface StatusHistoryEntry {
  status: CandidateStatus
  timestamp: string
  updatedBy: string
  additionalData?: AdditionalStatusData
}

export interface CandidateTracking {
  status: CandidateStatus
  statusHistory: StatusHistoryEntry[]
  lastUpdated: string
  updatedBy: string
  rateConfirmed?: number
  interviewDate?: string
  contactedDate?: string
  notes?: string
  additionalData?: AdditionalStatusData
}

// Number of candidates to show per page
const CANDIDATES_PER_PAGE = 9

// Define JobDetails interface for the job data
interface JobDetails {
  id: string;
  title: string;
  company: string;
  location: string;
  employment_type: string;
  experience_required: string;
  mode_of_work: string;
  required_skills: string[];
  education_requirements?: string[];
  job_description?: string;
  minimum_experience_years?: number;
  salary_range?: {
    min: number;
    max: number;
    currency: string;
  };
}


export default function CandidatesPage() {
  const params = useParams()
  const jobId = params.jobId as string
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<"match" | "name" | "date">("match")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0)
  const { currentView, setCurrentView, statusFilter, searchQuery, setSearchQuery } = useHiringStages()

  const fetchResumesFallback = useCallback(async () => {
    try {
      let allResumes: TransformedResume[] = [];
      
      if (user && user.uid) {
        console.log("Fetching current user's resumes");
        try {
          const userResumes = await apiClient.resumes.getUserResumes(user.uid) as Resume[];
          
          if (userResumes && userResumes.length > 0) {
            console.log(`Found ${userResumes.length} resumes for current user`);
            
            const transformedResumes = userResumes.map((resume: Resume) => ({
              filename: resume.filename,
              analysis: resume.analysis || {
                name: "Unknown",
                email: "unknown@example.com",
                key_skills: [],
                education_details: [],
                work_experience_details: []
              },
              userId: user.uid,
              userEmail: user.email || "unknown@example.com"
            }));
            
            allResumes = transformedResumes;
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error 
            ? error.message 
            : (error as ApiError)?.message || "Unknown error";
          console.error("Error fetching user resumes:", errorMessage);
        }
      }
      
      return allResumes;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error as ApiError)?.message || "Unknown error";
      console.error("Error in fetchResumesFallback:", errorMessage);
      return [];
    }
  }, [user]);

  const fetchResumes = useCallback(async () => {
    try {
      const candidates = await apiClient.jobs.getCandidates(jobId) as Candidate[];
      const existingCandidateFilenames = candidates.map(c => c.filename);
      console.log(`Found ${existingCandidateFilenames.length} existing candidates for job`);
      
      let allResumes = [];
      
      try {
        allResumes = await apiClient.resumes.getAllForMatching() as TransformedResume[];
        if (allResumes && allResumes.length > 0) {
          console.log(`Found ${allResumes.length} total resumes in the system`);
        } else {
          allResumes = await fetchResumesFallback();
        }
      } catch (error) {
        console.error("Error fetching all resumes:", error);
        allResumes = await fetchResumesFallback();
      }
      
      const newResumes = allResumes.filter(resume => 
        !existingCandidateFilenames.includes(resume.filename)
      );
      
      console.log(`Found ${newResumes.length} new resumes that need analysis`);
      
      return {
        resumes: newResumes,
        isNew: newResumes.length > 0
      };
    } catch (error) {
      console.error("Error in fetchResumes:", error);
      return {
        resumes: [],
        isNew: false
      };
    }
  }, [jobId, fetchResumesFallback]);

  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        const jobData = await apiClient.jobs.getById(jobId) as JobDetails;
        if (jobData) {
          setJobDetails(jobData);
        }
      } catch (error) {
        console.error("Error fetching job details:", error);
      }
    }

    fetchJobDetails();
  }, [jobId]);

  const analyzeCandidates = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in to view candidates")
      return
    }

    setIsLoading(true)
    setIsAnalyzing(true)

    try {
      const jobData = await apiClient.jobs.getById(jobId) as JobDetails;
      
      if (!jobData) {
        toast.error("Job not found");
        setIsLoading(false);
        setIsAnalyzing(false);
        return;
      }
      
      setJobDetails(jobData);
      console.log("Job data retrieved:", jobData.title);
      
      const { resumes: resumesData, isNew } = await fetchResumes();
      
      if (resumesData.length === 0) {
        toast.error("No resumes found. Please upload resumes to find matching candidates.");
        setIsLoading(false);
        setIsAnalyzing(false);
        return;
      }
      
      if (!isNew && resumesData.length > 0) {
        console.log("Using existing candidate analysis");
        
        const uniqueCandidates = filterDuplicateCandidates(resumesData as unknown as Candidate[]);
        setDuplicatesRemoved(resumesData.length - uniqueCandidates.length);

        const sortedCandidates = uniqueCandidates.sort((a, b) => 
          b.matchAnalysis.matchPercentage - a.matchAnalysis.matchPercentage
        );

        setCandidates(sortedCandidates);
        setIsAnalyzing(false);
        setIsLoading(false);
        return;
      }
      
      console.log(`Analyzing ${resumesData.length} resumes for matching candidates...`);
      toast.info(`Analyzing ${resumesData.length} resumes for matching candidates...`);
      
      const analysisResults = await analyzeBatchMatches(jobData, resumesData);

      if (!analysisResults || analysisResults.length === 0) {
        toast.error("No matching candidates found");
        console.log("No matching candidates found in analysis");
        setIsLoading(false);
        setIsAnalyzing(false);
        return;
      }

      console.log(`Found ${analysisResults.length} potential matches`);
      
      const matchedCandidates = analysisResults
        .filter((result) => result !== null)
        .filter((result) => result.matchPercentage > 50)
        .map((result) => {
          const resumeData = resumesData.find((r) => r.filename === result.filename);
          return {
            filename: result.filename,
            name: resumeData?.analysis?.name || "Unknown",
            email: resumeData?.analysis?.email || "No email",
            matchAnalysis: {
              matchPercentage: result.matchPercentage,
              matchingSkills: result.matchingSkills || [],
              missingRequirements: result.missingRequirements || [],
              experienceMatch: result.experienceMatch || false,
              educationMatch: result.educationMatch || false,
              overallAssessment: result.overallAssessment || "",
            },
            analysis: {
              key_skills: resumeData?.analysis?.key_skills || [],
              education_details: resumeData?.analysis?.education_details || [],
              work_experience_details: resumeData?.analysis?.work_experience_details || [],
            },
            userId: resumeData?.userId,
            userEmail: resumeData?.userEmail,
          } as Candidate;
        });

      console.log(`${matchedCandidates.length} candidates matched with > 50% match rate`);
      
      let existingCandidates: Candidate[] = [];
      if (isNew) {
        try {
          existingCandidates = await apiClient.jobs.getCandidates(jobId) as Candidate[];
          console.log(`Retrieved ${existingCandidates.length} existing candidates from database`);
        } catch (err) {
          console.log("No existing candidates found or error retrieving them", err);
        }
      }
      
      const combinedCandidates = [...existingCandidates, ...matchedCandidates];
      
      const uniqueCandidates = filterDuplicateCandidates(combinedCandidates);
      console.log(`${uniqueCandidates.length} unique candidates after removing duplicates`);

      setDuplicatesRemoved(combinedCandidates.length - uniqueCandidates.length);

      try {
        await apiClient.jobs.saveCandidates(jobId, uniqueCandidates as unknown as Record<string, unknown>[]);
        
        if (isNew) {
          toast.success(`Found ${matchedCandidates.length} new matching candidates and saved to database`);
        } else {
          toast.success(`Updated ${uniqueCandidates.length} candidates in database`);
        }
      } catch (saveError) {
        console.error("Error saving candidates:", saveError);
        
        let errorMessage = "Failed to save analysis results";
        if (saveError instanceof Error) {
          errorMessage += `: ${saveError.message}`;
        }
        
        toast.error(errorMessage, {
          duration: 4000,
          description: "Results are being shown but may not persist between sessions"
        });
      }

      setCandidates(uniqueCandidates);
      
    } catch (error) {
      console.error("Error in analyzeCandidates:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze candidates";
      toast.error(`Analysis failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  }, [jobId, user, fetchResumes]);

  const refreshCandidates = useCallback(async () => {
    try {
      setIsLoading(true);
      
      console.log(`Refreshing candidates for job ${jobId}`);
      
      const candidatesData = await apiClient.jobs.getCandidates(jobId) as Candidate[];
      
      if (candidatesData && candidatesData.length > 0) {
        console.log(`Retrieved ${candidatesData.length} candidates from API`);
        
        const uniqueCandidates = filterDuplicateCandidates(candidatesData);
        console.log(`After duplicate filtering: ${uniqueCandidates.length} candidates`);
        
        const sortedCandidates = uniqueCandidates.sort(
          (a, b) => b.matchAnalysis.matchPercentage - a.matchAnalysis.matchPercentage
        );
        
        let filteredCandidates = sortedCandidates;
        if (statusFilter !== 'all') {
          filteredCandidates = sortedCandidates.filter(
            (candidate) => candidate.tracking?.status === statusFilter
          );
        }
        
        setCandidates(filteredCandidates);
        toast.success("Candidates refreshed");
        return filteredCandidates;
      } else {
        console.warn("No candidates found for this job");
        toast.error("No candidates found for this job");
        return [];
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error as ApiError)?.message || "Unknown error";
      console.error("Error refreshing candidates:", errorMessage);
      toast.error(`Failed to refresh candidates: ${errorMessage}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [jobId, statusFilter]);

  useEffect(() => {
    analyzeCandidates();
  }, [analyzeCandidates]);

  useEffect(() => {
    const initializeTracking = async () => {
      if (candidates.length > 0 && jobId) {
        try {
          await refreshCandidates();
        } catch (error) {
          console.error("Error initializing candidate tracking:", error);
        }
      }
    };

    initializeTracking();
  }, [candidates.length, jobId, refreshCandidates]);

  useEffect(() => {
    if (candidates.length > 0) {
      refreshCandidates();
    }
  }, [candidates.length, jobId, refreshCandidates]);

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, searchQuery, sortBy, sortOrder])

  const filteredAndSortedCandidates = useMemo(() => {
    const filtered = candidates.filter((candidate) => {
      if (!searchQuery) return true

      const query = searchQuery.toLowerCase()
      return (
        candidate.name?.toLowerCase().includes(query) ||
        candidate.email?.toLowerCase().includes(query) ||
        candidate.analysis.key_skills.some((skill) => skill && skill.toLowerCase().includes(query))
      )
    })

    return [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case "match":
          comparison = b.matchAnalysis.matchPercentage - a.matchAnalysis.matchPercentage
          break
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "date":
          const dateA = a.tracking?.lastUpdated ? new Date(a.tracking.lastUpdated).getTime() : 0
          const dateB = b.tracking?.lastUpdated ? new Date(b.tracking.lastUpdated).getTime() : 0
          comparison = dateB - dateA
          break
      }

      return sortOrder === "asc" ? -comparison : comparison
    })
  }, [candidates, searchQuery, sortBy, sortOrder])

  const paginatedCandidates = useMemo(() => {
    const startIndex = (currentPage - 1) * CANDIDATES_PER_PAGE
    return filteredAndSortedCandidates.slice(startIndex, startIndex + CANDIDATES_PER_PAGE)
  }, [filteredAndSortedCandidates, currentPage])

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedCandidates.length / CANDIDATES_PER_PAGE))

  const CandidateCardSkeleton = () => (
    <div className="p-6 rounded-lg border animate-pulse">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-10 w-16 rounded-full" />
      </div>
      <div className="mt-4 space-y-3">
        <Skeleton className="h-4 w-full" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )

  const EmptyState = () => (
    <div className="text-center py-16 px-4">
      <div className="bg-muted/30 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <User className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">No Candidates Found</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        {searchQuery || statusFilter !== "all"
          ? "Try adjusting your filters or search query"
          : "No matching candidates found for this job"}
      </p>
      <Button variant="outline" onClick={() => router.push("/job")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Jobs
      </Button>
    </div>
  )

  const CandidateCard = ({ candidate }: { candidate: Candidate }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg border hover:border-primary hover:shadow-md transition-all cursor-pointer p-6"
      onClick={() => setSelectedCandidate(candidate)}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 border">
            <AvatarFallback className="bg-primary/10 text-primary">
              {candidate.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-xl font-semibold">{candidate.name}</h3>
            <div className="flex items-center text-muted-foreground">
              <Mail className="w-3.5 h-3.5 mr-1.5" />
              {candidate.email}
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-2xl font-bold text-primary">{candidate.matchAnalysis.matchPercentage}%</div>
                <div className="text-sm text-muted-foreground">Match Score</div>
              </div>
              <Progress value={candidate.matchAnalysis.matchPercentage} className="h-2 w-full max-w-xs" />
            </div>
          </div>
        </div>

        {candidate.tracking?.status && (
          <Badge
            variant={
              candidate.tracking.status === "shortlisted" || candidate.tracking.status === "approved"
                ? "default"
                : candidate.tracking.status === "not_interested" || candidate.tracking.status === "disapproved"
                  ? "destructive"
                  : "secondary"
            }
            className="text-xs"
          >
            {candidate.tracking.status.replace("_", " ")}
          </Badge>
        )}
      </div>

      <div className="mt-4">
        <h4 className="font-medium mb-2">Matching Skills</h4>
        <div className="flex flex-wrap gap-2 mb-4">
          {candidate.matchAnalysis.matchingSkills.slice(0, 5).map((skill, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
            >
              {skill}
            </Badge>
          ))}
          {candidate.matchAnalysis.matchingSkills.length > 5 && (
            <Badge variant="outline">+{candidate.matchAnalysis.matchingSkills.length - 5} more</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <span
            className={
              candidate.matchAnalysis.experienceMatch
                ? "text-green-600 flex items-center"
                : "text-yellow-600 flex items-center"
            }
          >
            <Briefcase className="w-3.5 h-3.5 mr-1" />
            Experience: {candidate.matchAnalysis.experienceMatch ? "Match" : "Partial"}
          </span>
          <span
            className={
              candidate.matchAnalysis.educationMatch
                ? "text-green-600 flex items-center"
                : "text-yellow-600 flex items-center"
            }
          >
            <GraduationCap className="w-3.5 h-3.5 mr-1" />
            Education: {candidate.matchAnalysis.educationMatch ? "Match" : "Partial"}
          </span>
        </div>
      </div>

      {candidate.tracking && (
        <div className="mt-4 pt-4 border-t text-sm text-muted-foreground space-y-1">
          {candidate.tracking.rateConfirmed && (
            <div className="flex items-center">
              <DollarSign className="w-3.5 h-3.5 mr-1.5" />
              Rate: ${candidate.tracking.rateConfirmed}/hr
            </div>
          )}
          {candidate.tracking.interviewDate && (
            <div className="flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              Interview: {format(new Date(candidate.tracking.interviewDate), "PPp")}
            </div>
          )}
          <div className="flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Updated: {format(new Date(candidate.tracking.lastUpdated), "PP")}
          </div>
        </div>
      )}
    </motion.div>
  )

  const toggleSort = (type: "match" | "name" | "date") => {
    if (sortBy === type) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(type)
      setSortOrder("desc")
    }
  }

  useEffect(() => {
    const updateCandidatesOnStatusChange = async () => {
      if (candidates.length === 0 || !jobId) return;
      
      try {
        await refreshCandidates();
      } catch (error) {
        console.error("Error refreshing candidates on status change:", error);
      }
    };

    updateCandidatesOnStatusChange();
  }, [statusFilter, candidates.length, jobId, refreshCandidates]);

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      <DashboardSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <motion.div
        className="flex-1 min-h-screen"
        initial={false}
        animate={{
          marginLeft: isMobile ? 0 : isSidebarOpen ? "16rem" : "4.5rem",
          width: isMobile ? "100%" : isSidebarOpen ? "calc(100% - 16rem)" : "calc(100% - 4.5rem)",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="container mx-auto py-8 px-4 md:px-8">
          <Button variant="ghost" className="mb-6 group" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Job Details
          </Button>

          {jobDetails && (
            <Card className="mb-8 bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">{jobDetails.title}</h2>
                    <div className="flex items-center text-muted-foreground mb-4">
                      <Building className="w-4 h-4 mr-2" />
                      {jobDetails.company} • {jobDetails.location}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {jobDetails.employment_type}
                      </Badge>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {jobDetails.experience_required}
                      </Badge>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {jobDetails.mode_of_work}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-center">
                    <div className="text-sm text-muted-foreground mb-1">Matching Candidates</div>
                    <div className="text-3xl font-bold">{candidates.length}</div>
                    {duplicatesRemoved > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {duplicatesRemoved} duplicate profile{duplicatesRemoved !== 1 ? "s" : ""} filtered out
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-3xl font-bold">Relevant Candidates</h1>
            <div className="flex items-center gap-2">
              <Button
                variant={currentView === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentView("list")}
                className="flex items-center"
              >
                <List className="w-4 h-4 mr-2" />
                List
              </Button>
              <Button
                variant={currentView === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentView("grid")}
                className="flex items-center"
              >
                <Grid3X3 className="w-4 h-4 mr-2" />
                Grid
              </Button>
              <Button
                variant={currentView === "board" ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentView("board")}
                className="flex items-center"
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Board
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-auto flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search candidates..."
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
                      {statusFilter === "all" ? "All Status" : statusFilter.replace("_", " ")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => useHiringStages.setState({ statusFilter: "all" })}>
                      All Status
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => useHiringStages.setState({ statusFilter: "shortlisted" })}>
                      Shortlisted
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => useHiringStages.setState({ statusFilter: "contacted" })}>
                      Contacted
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => useHiringStages.setState({ statusFilter: "interested" })}>
                      Interested
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => useHiringStages.setState({ statusFilter: "not_interested" })}>
                      Not Interested
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => useHiringStages.setState({ statusFilter: "rate_confirmed" })}>
                      Rate Confirmed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => useHiringStages.setState({ statusFilter: "interview_scheduled" })}>
                      Interview Scheduled
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => useHiringStages.setState({ statusFilter: "approved" })}>
                      Approved
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => useHiringStages.setState({ statusFilter: "disapproved" })}>
                      Disapproved
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => useHiringStages.setState({ statusFilter: "pending" })}>
                      Pending
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center">
                      <SlidersHorizontal className="w-4 h-4 mr-2" />
                      Sort by: {sortBy === "match" ? "Match" : sortBy === "name" ? "Name" : "Date"}
                      {sortOrder === "asc" ? " (A-Z)" : " (Z-A)"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toggleSort("match")}>
                      Sort by Match {sortBy === "match" && (sortOrder === "desc" ? "↓" : "↑")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("name")}>
                      Sort by Name {sortBy === "name" && (sortOrder === "desc" ? "↓" : "↑")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("date")}>
                      Sort by Date {sortBy === "date" && (sortOrder === "desc" ? "↓" : "↑")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-2 ml-auto">
                  <Button 
                    size="sm" 
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        const newResumeCheck = await apiClient.jobs.checkForNewResumes(jobId) as {
                          hasNewResumes: boolean;
                          newResumeCount: number;
                        };
                        
                        if (newResumeCheck.hasNewResumes) {
                          toast.info(`Found ${newResumeCheck.newResumeCount} new resumes to analyze`);
                          await analyzeCandidates();
                        } else {
                          toast.success("All resumes have been analyzed. You're up to date!");
                          await refreshCandidates();
                        }
                      } catch (error) {
                        console.error("Error checking for new resumes:", error);
                        toast.error("Failed to check for new resumes");
                        await refreshCandidates();
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading || isAnalyzing}
                  >
                    {isLoading || isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Check for New Resumes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array(6)
                .fill(0)
                .map((_, index) => (
                  <CandidateCardSkeleton key={index} />
                ))}
            </div>
          ) : isAnalyzing ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Analyzing Candidates</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Our AI is analyzing resumes to find the best matches for this job position
              </p>
            </div>
          ) : filteredAndSortedCandidates.length === 0 ? (
            <EmptyState />
          ) : currentView === "board" ? (
            <HiringStagesBoard
              candidates={filteredAndSortedCandidates}
              jobId={jobId}
              onCandidateUpdate={refreshCandidates}
            />
          ) : (
            <>
              <AnimatePresence>
                {currentView === "list" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedCandidates.map((candidate) => (
                      <CandidateCard key={candidate.filename} candidate={candidate} />
                    ))}
                  </div>
                ) : (
                  <CandidateGridView candidates={paginatedCandidates} onSelectCandidate={setSelectedCandidate} />
                )}
              </AnimatePresence>

              {filteredAndSortedCandidates.length > CANDIDATES_PER_PAGE && (
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              )}

              <div className="text-center text-sm text-muted-foreground mt-4">
                Showing {paginatedCandidates.length} of {filteredAndSortedCandidates.length} candidates
                {duplicatesRemoved > 0 && ` (${duplicatesRemoved} duplicates filtered out)`}
              </div>
            </>
          )}

          <CandidateDetailsSheet
            candidate={selectedCandidate}
            jobId={jobId}
            isOpen={!!selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
            onUpdate={refreshCandidates}
          />
        </div>
      </motion.div>
    </div>
  )
}

