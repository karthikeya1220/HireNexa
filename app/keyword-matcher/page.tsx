"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/auth-context"
import { Input } from "@/components/ui/input"
import { Search, Briefcase, GraduationCap, MapPin, FileText, Filter, X, Sparkles } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { motion, AnimatePresence } from "framer-motion"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Badge } from "@/components/ui/badge"
import { FilterSection } from "@/components/filter-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResumeCard } from "@/components/keyword-matcher/resume-card"
import { ResumeDetailsDialog } from "@/components/keyword-matcher/resume-details-dialog"
import { SortDropdown } from "@/components/keyword-matcher/sort-dropdown"
import apiClient from "@/lib/api-client"

// Resume interface
interface Resume {
  filename: string
  filelink: string
  uploadedAt: Date
  analysis: {
    name: string
    education_details: Array<{
      institute: string
      degree: string
      major: string
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
    key_skills: string[]
    profile_summary: string
    experience_years?: number
  }
}

// Add these interfaces at the top of the file, after the existing Resume interface
interface ApiResumeResponse {
  filename: string;
  filelink: string;
  uploaded_at: string;
  analysis?: {
    name?: string;
    education_details?: Array<{
      institute: string;
      degree: string;
      major: string;
      location: string;
      dates: string;
    }>;
    work_experience_details?: Array<{
      company: string;
      title: string;
      location: string;
      dates: string;
      responsibilities: string[];
    }>;
    key_skills?: string[];
    profile_summary?: string;
  };
}

export default function KeywordMatcherPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [keywords, setKeywords] = useState<Set<string>>(new Set())
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [resumes, setResumes] = useState<Resume[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const { user } = useAuth()
  const [educationFilters, setEducationFilters] = useState<Set<string>>(new Set())
  const [selectedEducation, setSelectedEducation] = useState<string[]>([])
  const [locations, setLocations] = useState<Set<string>>(new Set())
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [experienceRanges] = useState(["0-2 years", "2-5 years", "5-8 years", "8+ years"])
  const [selectedExperience, setSelectedExperience] = useState<string[]>([])
  const [isFilterOpen, setIsFilterOpen] = useState(!isMobile)
  const [activeTab, setActiveTab] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [sortOption, setSortOption] = useState("relevance")
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null)
  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false)

  // Handle mobile sidebar state
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false)
      setIsFilterOpen(false)
    } else {
      setIsFilterOpen(true)
    }
  }, [isMobile])

  useEffect(() => {
    const fetchResumes = async () => {
      if (!user) {
        // Stop the spinner instead of returning early (see job/page.tsx).
        setIsLoading(false)
        return
      }
      setIsLoading(true)

      try {
        // Fetch resumes using the API client
        const userResumes = await apiClient.resumes.getUserResumes(user.uid);
        
        const allKeywords = new Set<string>()
        const newEducationFilters = new Set<string>()
        const newLocations = new Set<string>()
        const fetchedResumes: Resume[] = []

        if (userResumes && Array.isArray(userResumes)) {
          // Process each resume to ensure the required structure
          const validResumes = userResumes.map((resume: ApiResumeResponse) => {
            // Transform API response to match the expected Resume interface
            const transformedResume: Resume = {
              filename: resume.filename,
              filelink: resume.filelink,
              uploadedAt: new Date(resume.uploaded_at),
              analysis: {
                name: resume.analysis?.name || "Unknown",
                education_details: resume.analysis?.education_details || [],
                work_experience_details: resume.analysis?.work_experience_details || [],
                key_skills: resume.analysis?.key_skills || [],
                profile_summary: resume.analysis?.profile_summary || "",
              }
            };

            return transformedResume;
          });

          fetchedResumes.push(...validResumes);

          // Process the resumes to extract keywords, education, etc.
          validResumes.forEach((resume: Resume) => {
            // Process key skills
            if (resume?.analysis?.key_skills && Array.isArray(resume.analysis.key_skills)) {
              resume.analysis.key_skills.forEach((skill) => {
                if (typeof skill === "string" && skill.trim()) {
                  allKeywords.add(skill.toLowerCase().trim())
                }
              })
            }

            // Process education
            if (resume?.analysis?.education_details) {
              resume.analysis.education_details.forEach((edu) => {
                // Add degree information
                if (edu.degree) {
                  newEducationFilters.add(edu.degree.toLowerCase().trim())
                }
                // Add major information
                if (edu.major) {
                  newEducationFilters.add(edu.major.toLowerCase().trim())
                }
              })
            }

            // Process location from education details
            if (resume?.analysis?.education_details) {
              resume.analysis.education_details.forEach((edu) => {
                if (edu.location) {
                  newLocations.add(edu.location.toLowerCase().trim())
                }
              })
            }

            // Process experience years
            if (resume?.analysis?.work_experience_details) {
              let totalExperience = 0
              resume.analysis.work_experience_details.forEach((exp) => {
                if (exp.dates) {
                  const [startDate, endDate] = exp.dates.split("–").map((d) => d.trim())
                  const end = endDate === "Present" ? new Date() : new Date(endDate)
                  const start = new Date(startDate)
                  const years = end.getFullYear() - start.getFullYear()
                  totalExperience += years
                }
              })
              resume.analysis.experience_years = totalExperience
            }
          });
        }

        // Update state with found data
        setKeywords(allKeywords)
        setResumes(fetchedResumes)
        setEducationFilters(newEducationFilters)
        setLocations(newLocations)
        setIsLoading(false)
      } catch (error) {
        console.error("Error fetching resumes:", error)
        setIsLoading(false)
      }
    }

    fetchResumes()
  }, [user])

  // Update the filter function to match keywords more accurately
  const filteredResumes = resumes.filter((resume) => {
    if (
      selectedKeywords.length === 0 &&
      selectedEducation.length === 0 &&
      selectedLocations.length === 0 &&
      selectedExperience.length === 0 &&
      activeTab === "all"
    )
      return true

    // Match skills
    const matchesSkills =
      selectedKeywords.length === 0 ||
      selectedKeywords.every((keyword) =>
        resume.analysis.key_skills.some((skill) => skill && skill.toLowerCase().includes(keyword.toLowerCase())),
      )

    // Match education (check both degree and major)
    const matchesEducation =
      selectedEducation.length === 0 ||
      selectedEducation.some((edu) =>
        resume.analysis.education_details.some(
          (eduDetail) =>
            (eduDetail.degree && eduDetail.degree.toLowerCase().includes(edu.toLowerCase())) ||
            (eduDetail.major && eduDetail.major.toLowerCase().includes(edu.toLowerCase())),
        ),
      )

    // Match location from education details
    const matchesLocation =
      selectedLocations.length === 0 ||
      resume.analysis.education_details.some((edu) => 
        edu.location && selectedLocations.includes(edu.location.toLowerCase())
      )

    // Match experience range
    const matchesExperience =
      selectedExperience.length === 0 ||
      selectedExperience.some((range) => {
        const years = resume.analysis.experience_years
        switch (range) {
          case "0-2 years":
            return (years ?? 0) >= 0 && (years ?? 0) <= 2
          case "2-5 years":
            return (years ?? 0) > 2 && (years ?? 0) <= 5
          case "5-8 years":
            return (years ?? 0) > 5 && (years ?? 0) <= 8
          case "8+ years":
            return (years ?? 0) > 8
          default:
            return false
        }
      })

    // Match tab filter
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "technical" &&
        resume.analysis.key_skills.some((skill) =>
          skill && [
            "programming",
            "development",
            "software",
            "engineering",
            "code",
            "java",
            "python",
            "javascript",
            "react",
            "node",
          ].some((tech) => skill.toLowerCase().includes(tech)),
        )) ||
      (activeTab === "management" &&
        resume.analysis.key_skills.some((skill) =>
          skill && ["management", "leadership", "project", "team", "strategy", "business", "operations"].some((mgmt) =>
            skill.toLowerCase().includes(mgmt),
          ),
        )) ||
      (activeTab === "design" &&
        resume.analysis.key_skills.some((skill) =>
          skill && ["design", "ui", "ux", "graphic", "creative", "visual", "illustration"].some((des) =>
            skill.toLowerCase().includes(des),
          ),
        ))

    return matchesSkills && matchesEducation && matchesLocation && matchesExperience && matchesTab
  })

  // Sort resumes based on selected option
  const sortedResumes = [...filteredResumes].sort((a, b) => {
    if (sortOption === "recent") {
      return b.uploadedAt.getTime() - a.uploadedAt.getTime()
    } else if (sortOption === "experience") {
      return (b.analysis.experience_years || 0) - (a.analysis.experience_years || 0)
    } else if (sortOption === "relevance") {
      // Sort by number of matching keywords (default)
      const aMatches = selectedKeywords.filter((keyword) =>
        a.analysis.key_skills.some((skill) => skill && skill.toLowerCase().includes(keyword.toLowerCase())),
      ).length
      const bMatches = selectedKeywords.filter((keyword) =>
        b.analysis.key_skills.some((skill) => skill && skill.toLowerCase().includes(keyword.toLowerCase())),
      ).length
      return bMatches - aMatches
    }
    return 0
  })

  // Toggle keyword selection
  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords((prev) => (prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword]))
  }

  // Filter keywords based on search
  const filteredKeywords = Array.from(keywords).filter((keyword) =>
    keyword && keyword.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Calculate match score for a resume
  const calculateMatchScore = (resume: Resume) => {
    if (selectedKeywords.length === 0) return 100
    if (!resume.analysis.key_skills || !Array.isArray(resume.analysis.key_skills)) return 0

    const matchingKeywords = selectedKeywords.filter((keyword) =>
      resume.analysis.key_skills.some((skill) => skill && skill.toLowerCase().includes(keyword.toLowerCase())),
    ).length

    return Math.round((matchingKeywords / selectedKeywords.length) * 100)
  }

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedKeywords([])
    setSelectedEducation([])
    setSelectedLocations([])
    setSelectedExperience([])
    setActiveTab("all")
    setSortOption("relevance")
  }

  // Handle resume download
  const handleDownload = (fileUrl: string, filename: string) => {
    // Create a temporary anchor element
    const link = document.createElement("a")
    link.href = fileUrl
    link.download = filename || "resume.pdf"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // View resume details
  const viewResumeDetails = (resume: Resume) => {
    setSelectedResume(resume)
    setIsResumeDialogOpen(true)
  }

  // Get total filters count
  const totalFiltersCount =
    selectedKeywords.length +
    selectedEducation.length +
    selectedLocations.length +
    selectedExperience.length +
    (activeTab !== "all" ? 1 : 0)

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {/* Add Dashboard Sidebar */}
      <DashboardSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Main content area */}
      <motion.div
        className="flex-1 min-h-screen relative"
        initial={false}
        animate={{
          marginLeft: isMobile ? 0 : isSidebarOpen ? "16rem" : "4.5rem",
          width: isMobile ? "100%" : isSidebarOpen ? "calc(100% - 16rem)" : "calc(100% - 4.5rem)",
          paddingLeft: isMobile ? "0" : isSidebarOpen ? "0.5rem" : "0.5rem",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="py-8 px-4 md:px-6 max-w-[1400px] mx-auto">
          {/* Header Section with gradient background */}
          <div className="mb-8 relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500/10 via-violet-400/5 to-blue-500/10 p-4 sm:p-8 border border-violet-200/20 dark:border-violet-800/20 shadow-sm">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,#fff,transparent)]"></div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-violet-700 to-blue-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-blue-400">
                    Resume Keyword Matcher
                  </h1>
                  <p className="text-muted-foreground mt-2 max-w-2xl text-sm sm:text-base">
                    Find the perfect candidates by matching resumes with your required skills and qualifications. Our
                    AI-powered system analyzes resumes to identify the best matches.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Badge
                    variant="outline"
                    className="px-3 py-1.5 text-sm font-medium border-violet-200 dark:border-violet-800 bg-white/50 dark:bg-black/20 backdrop-blur-sm"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-violet-500" />
                    {resumes.length} Total Resumes
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="px-3 py-1.5 text-sm font-medium bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-violet-500" />
                    {filteredResumes.length} Matches Found
                  </Badge>
                </div>
              </div>

              {/* Active filters */}
              {totalFiltersCount > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Filter className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-medium text-violet-700 dark:text-violet-300">Active Filters:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-xs h-6 px-2 text-muted-foreground hover:text-destructive"
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedKeywords.map((keyword) => (
                      <Badge
                        key={`keyword-${keyword}`}
                        variant="outline"
                        className="px-2.5 py-1 cursor-pointer bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-800/50 group"
                        onClick={() => toggleKeyword(keyword)}
                      >
                        <span className="text-violet-700 dark:text-violet-300">{keyword}</span>
                        <X className="w-3 h-3 ml-1.5 text-violet-400 group-hover:text-violet-700 dark:group-hover:text-violet-300" />
                      </Badge>
                    ))}
                    {selectedEducation.map((edu) => (
                      <Badge
                        key={`edu-${edu}`}
                        variant="outline"
                        className="px-2.5 py-1 cursor-pointer bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-800/50 group"
                        onClick={() => setSelectedEducation((prev) => prev.filter((e) => e !== edu))}
                      >
                        <GraduationCap className="w-3 h-3 mr-1 text-blue-500" />
                        <span className="text-blue-700 dark:text-blue-300">{edu}</span>
                        <X className="w-3 h-3 ml-1.5 text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300" />
                      </Badge>
                    ))}
                    {selectedLocations.map((loc) => (
                      <Badge
                        key={`loc-${loc}`}
                        variant="outline"
                        className="px-2.5 py-1 cursor-pointer bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 group"
                        onClick={() => setSelectedLocations((prev) => prev.filter((l) => l !== loc))}
                      >
                        <MapPin className="w-3 h-3 mr-1 text-emerald-500" />
                        <span className="text-emerald-700 dark:text-emerald-300">{loc}</span>
                        <X className="w-3 h-3 ml-1.5 text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300" />
                      </Badge>
                    ))}
                    {selectedExperience.map((exp) => (
                      <Badge
                        key={`exp-${exp}`}
                        variant="outline"
                        className="px-2.5 py-1 cursor-pointer bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-800/50 group"
                        onClick={() => setSelectedExperience((prev) => prev.filter((e) => e !== exp))}
                      >
                        <Briefcase className="w-3 h-3 mr-1 text-amber-500" />
                        <span className="text-amber-700 dark:text-amber-300">{exp}</span>
                        <X className="w-3 h-3 ml-1.5 text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300" />
                      </Badge>
                    ))}
                    {activeTab !== "all" && (
                      <Badge
                        variant="outline"
                        className="px-2.5 py-1 cursor-pointer bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-800/50 group"
                        onClick={() => setActiveTab("all")}
                      >
                        <span className="text-purple-700 dark:text-purple-300">Category: {activeTab}</span>
                        <X className="w-3 h-3 ml-1.5 text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300" />
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main content with filters and results */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Filter Sidebar */}
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  className="md:w-80 flex-shrink-0"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="sticky top-8 border border-violet-200/50 dark:border-violet-800/50 overflow-hidden shadow-sm">
                    <CardContent className="p-0">
                      {/* Filter Header */}
                      <div className="flex items-center justify-between p-4 border-b border-violet-100 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-900/20">
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-violet-500" />
                          <h2 className="text-base font-semibold text-violet-900 dark:text-violet-100">
                            Smart Filters
                          </h2>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFilterOpen(false)}>
                          <X className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>

                      <div className="p-4 space-y-5">
                        {/* Search Keywords */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-violet-700 dark:text-violet-300">
                            Search Skills & Keywords
                          </label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-violet-400" />
                            <Input
                              type="text"
                              placeholder="Type to search skills..."
                              className="pl-9 border-violet-200 dark:border-violet-800 focus-visible:ring-violet-500"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Filter Sections with better styling */}
                        <div className="space-y-5 divide-y divide-violet-100 dark:divide-violet-800/50">
                          <div className="pt-2">
                            <FilterSection
                              title="Skills & Keywords"
                              items={filteredKeywords}
                              selected={selectedKeywords}
                              onToggle={toggleKeyword}
                              icon={<Sparkles className="w-4 h-4 text-violet-500" />}
                            />
                          </div>

                          <div className="pt-5">
                            <FilterSection
                              title="Education"
                              items={Array.from(educationFilters)}
                              selected={selectedEducation}
                              onToggle={(edu) =>
                                setSelectedEducation((prev) =>
                                  prev.includes(edu) ? prev.filter((e) => e !== edu) : [...prev, edu],
                                )
                              }
                              icon={<GraduationCap className="w-4 h-4 text-blue-500" />}
                            />
                          </div>

                          <div className="pt-5">
                            <FilterSection
                              title="Location"
                              items={Array.from(locations)}
                              selected={selectedLocations}
                              onToggle={(loc) =>
                                setSelectedLocations((prev) =>
                                  prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc],
                                )
                              }
                              icon={<MapPin className="w-4 h-4 text-emerald-500" />}
                            />
                          </div>

                          <div className="pt-5">
                            <FilterSection
                              title="Experience"
                              items={experienceRanges}
                              selected={selectedExperience}
                              onToggle={(exp) =>
                                setSelectedExperience((prev) =>
                                  prev.includes(exp) ? prev.filter((e) => e !== exp) : [...prev, exp],
                                )
                              }
                              icon={<Briefcase className="w-4 h-4 text-amber-500" />}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Resumes Grid */}
            <div className="flex-1">
              {/* Mobile filter toggle */}
              {!isFilterOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilterOpen(true)}
                  className="mb-4 md:hidden flex items-center gap-2 border-violet-200 dark:border-violet-800"
                >
                  <Filter className="w-4 h-4 text-violet-500" />
                  <span>Show Filters</span>
                </Button>
              )}

              {/* Tabs and Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                  <TabsList className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200/50 dark:border-violet-800/50 p-1">
                    <TabsTrigger
                      value="all"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-violet-800/50 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-100"
                    >
                      All Resumes
                    </TabsTrigger>
                    <TabsTrigger
                      value="technical"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-violet-800/50 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-100"
                    >
                      Technical
                    </TabsTrigger>
                    <TabsTrigger
                      value="management"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-violet-800/50 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-100"
                    >
                      Management
                    </TabsTrigger>
                    <TabsTrigger
                      value="design"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-violet-800/50 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-100"
                    >
                      Design
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="hidden md:flex items-center gap-2 border-violet-200 dark:border-violet-800"
                  >
                    <Filter className="w-4 h-4 text-violet-500" />
                    <span>{isFilterOpen ? "Hide Filters" : "Show Filters"}</span>
                  </Button>

                  <SortDropdown
                    sortOption={sortOption}
                    isSortDropdownOpen={isSortDropdownOpen}
                    setIsSortDropdownOpen={setIsSortDropdownOpen}
                    setSortOption={setSortOption}
                  />
                </div>
              </div>

              {/* Loading state */}
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="p-4 border border-violet-200/50 dark:border-violet-800/50 animate-pulse">
                      <div className="h-6 w-1/3 bg-violet-100 dark:bg-violet-800/30 rounded mb-4"></div>
                      <div className="h-4 w-1/2 bg-violet-100 dark:bg-violet-800/30 rounded mb-2"></div>
                      <div className="h-4 w-3/4 bg-violet-100 dark:bg-violet-800/30 rounded mb-4"></div>
                      <div className="flex gap-2">
                        <div className="h-6 w-20 bg-violet-100 dark:bg-violet-800/30 rounded"></div>
                        <div className="h-6 w-20 bg-violet-100 dark:bg-violet-800/30 rounded"></div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <>
                  {/* Results count */}
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-violet-900 dark:text-violet-100">
                      {sortedResumes.length > 0
                        ? `Found ${sortedResumes.length} matching ${sortedResumes.length === 1 ? "resume" : "resumes"}`
                        : "No matching resumes found"}
                    </h2>
                    {selectedKeywords.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Showing resumes matching {selectedKeywords.length} selected{" "}
                        {selectedKeywords.length === 1 ? "keyword" : "keywords"}
                      </p>
                    )}
                  </div>

                  {/* Resume cards */}
                  <div className="grid grid-cols-1 gap-4">
                    {sortedResumes.map((resume, index) => (
                      <ResumeCard
                        key={index}
                        resume={resume}
                        index={index}
                        selectedKeywords={selectedKeywords}
                        calculateMatchScore={calculateMatchScore}
                        onViewDetails={viewResumeDetails}
                        onDownload={handleDownload}
                      />
                    ))}

                    {sortedResumes.length === 0 && (
                      <div className="text-center py-16 bg-violet-50/50 dark:bg-violet-900/10 rounded-lg border border-violet-200/50 dark:border-violet-800/50">
                        <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center mx-auto mb-4">
                          <Search className="w-8 h-8 text-violet-500" />
                        </div>
                        <h3 className="text-lg font-semibold mb-1 text-violet-900 dark:text-violet-100">
                          No matching resumes found
                        </h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          Try adjusting your filters or adding different keywords to find more candidates that match
                          your requirements.
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4 border-violet-200 dark:border-violet-800"
                          onClick={clearAllFilters}
                        >
                          Clear All Filters
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Resume Details Dialog */}
      <ResumeDetailsDialog
        isOpen={isResumeDialogOpen}
        onOpenChange={setIsResumeDialogOpen}
        resume={selectedResume}
        onDownload={handleDownload}
        selectedKeywords={selectedKeywords}
      />
    </div>
  )
}

