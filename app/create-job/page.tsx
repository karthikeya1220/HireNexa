"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, Briefcase, MapPin, DollarSign, Clock, Calendar,  } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/use-toast"
import { SkillInput } from "@/components/skill-input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import apiClient from "@/lib/api-client"
import { RubricConfigEditor } from "@/components/rubric/rubric-config-editor"
import { type CustomJobRubric, DEFAULT_JOB_RUBRIC } from "@/types/rubric"

interface JobFormData {
  title: string
  company: string
  location: string
  employment_type: string
  experience_required: string
  salary_range: string
  description: string
  working_hours: string
  mode_of_work: string
  about_company: string
  deadline: string
}

export default function CreateJobPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const { user } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("basic")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [] = useState<string[]>([])
  const [requirements, setRequirements] = useState<string[]>([])
  const [benefits, setBenefits] = useState<string[]>([])
  const [skillsRequired, setSkillsRequired] = useState<string[]>([])
  const [niceToHaveSkills, setNiceToHaveSkills] = useState<string[]>([])
  const [rubric, setRubric] = useState<CustomJobRubric>(DEFAULT_JOB_RUBRIC)

  const [formData, setFormData] = useState<JobFormData>({
    title: "",
    company: "",
    location: "",
    employment_type: "",
    experience_required: "",
    salary_range: "",
    description: "",
    working_hours: "",
    mode_of_work: "",
    about_company: "",
    deadline: "",
  })

  const validateForm = () => {
    const errors: Record<string, string> = {}

    // Basic info validation
    if (!formData.title) errors.title = "Job title is required"
    if (!formData.company) errors.company = "Company name is required"
    if (!formData.location) errors.location = "Location is required"
    if (!formData.employment_type) errors.employment_type = "Employment type is required"
    if (!formData.experience_required) errors.experience_required = "Experience is required"
    if (!formData.salary_range) errors.salary_range = "Salary range is required"
    if (!formData.description) errors.description = "Job description is required"
    if (!formData.working_hours) errors.working_hours = "Working hours is required"
    if (!formData.mode_of_work) errors.mode_of_work = "Mode of work is required"
    if (!formData.deadline) errors.deadline = "Application deadline is required"

    // Requirements validation
    if (requirements.length === 0) {
      errors.requirements = "At least one requirement is required"
    }

    // Benefits validation
    if (benefits.length === 0) {
      errors.benefits = "At least one benefit is required"
    }

    // Skills validation
    if (skillsRequired.length === 0) {
      errors.skills = "At least one required skill is required"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleRequirementChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setRequirements(value ? value.split("\n") : [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      // Find the first tab with errors and switch to it
      if (
        Object.keys(formErrors).some((key) =>
          [
            "title",
            "company",
            "location",
            "employment_type",
            "experience_required",
            "salary_range",
            "description",
          ].includes(key),
        )
      ) {
        setActiveTab("basic")
      } else if (
        Object.keys(formErrors).some((key) => ["requirements", "skills", "nice_to_have_skills"].includes(key))
      ) {
        setActiveTab("requirements")
      } else if (
        Object.keys(formErrors).some((key) => ["working_hours", "mode_of_work"].includes(key))
      ) {
        setActiveTab("details")
      } else if (Object.keys(formErrors).some((key) => ["benefits", "about_company", "deadline"].includes(key))) {
        setActiveTab("additional")
      }

      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      if (!user) throw new Error("User not authenticated")

      // Create job data object
      const jobData = {
        title: formData.title,
        company: formData.company,
        location: formData.location,
        employment_type: formData.employment_type,
        experience_required: formData.experience_required,
        salary_range: formData.salary_range,
        description: formData.description,
        status: "active",
        total_applications: 0,
        shortlisted: 0,
        rejected: 0,
        in_progress: 0,
        benefits,
        requirements,
        skills_required: skillsRequired,
        nice_to_have_skills: niceToHaveSkills,
        working_hours: formData.working_hours,
        mode_of_work: formData.mode_of_work,
        about_company: formData.about_company,
        deadline: formData.deadline,
        created_at: new Date(),
        updated_at: new Date(),
        metadata: {
          created_by: user?.email || "",
          created_by_id: user?.uid || "",
          last_modified_by: user?.email || "",
          rubric,
        },
      }

      // Use API client to create the job
      await apiClient.jobs.create(jobData);

      toast({
        title: "Success",
        description: "Job posted successfully",
      })

      router.push("/job")
    } catch (error) {
      console.error("Error creating job:", error)
      toast({
        title: "Error",
        description: "Failed to create job. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof JobFormData, value: string) => {
    setFormData({ ...formData, [field]: value })
    // Clear error for this field if it exists
    if (formErrors[field]) {
      const newErrors = { ...formErrors }
      delete newErrors[field]
      setFormErrors(newErrors)
    }
  }

  const getCompletionPercentage = () => {
    const totalFields = 14 // Total number of required fields
    const filledFields = [
      formData.title,
      formData.company,
      formData.location,
      formData.employment_type,
      formData.experience_required,
      formData.salary_range,
      formData.description,
      requirements.length > 0,
      benefits.length > 0,
      formData.working_hours,
      formData.mode_of_work,
      skillsRequired.length > 0,
      formData.deadline,
    ].filter(Boolean).length

    return Math.round((filledFields / totalFields) * 100)
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
        <div className="container mx-auto py-8 px-4 md:px-8 max-w-4xl">
          <Button variant="ghost" className="mb-6 group" onClick={() => router.push("/job")}>
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Jobs
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold">Create New Job</h1>
            <p className="text-muted-foreground">Post a new job opportunity for candidates</p>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Briefcase className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Job Creation Progress</h3>
                    <p className="text-sm text-muted-foreground">Fill in all required fields to post the job</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-primary/20 relative">
                    <div
                      className="absolute inset-0 rounded-full border-4 border-primary"
                      style={{
                        clipPath: `path('M 50 0 A 50 50 0 ${getCompletionPercentage() >= 50 ? 1 : 0} 1 ${50 + 50 * Math.cos((2 * Math.PI * getCompletionPercentage()) / 100)} ${50 + 50 * Math.sin((2 * Math.PI * getCompletionPercentage()) / 100)} L 50 50 Z')`,
                      }}
                    ></div>
                    <span className="text-lg font-bold">{getCompletionPercentage()}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-4 mb-8">
                <TabsTrigger value="basic" className="relative">
                  Basic Info
                  {Object.keys(formErrors).some((key) =>
                    [
                      "title",
                      "company",
                      "location",
                      "employment_type",
                      "experience_required",
                      "salary_range",
                      "description",
                    ].includes(key),
                  ) && <span className="absolute top-0 right-1 w-2 h-2 bg-destructive rounded-full"></span>}
                </TabsTrigger>
                <TabsTrigger value="requirements" className="relative">
                  Requirements
                  {Object.keys(formErrors).some((key) =>
                    ["requirements", "skills", "nice_to_have_skills"].includes(key),
                  ) && <span className="absolute top-0 right-1 w-2 h-2 bg-destructive rounded-full"></span>}
                </TabsTrigger>
                <TabsTrigger value="details" className="relative">
                  Job Details
                  {Object.keys(formErrors).some((key) =>
                    ["working_hours", "mode_of_work"].includes(key),
                  ) && <span className="absolute top-0 right-1 w-2 h-2 bg-destructive rounded-full"></span>}
                </TabsTrigger>
                <TabsTrigger value="additional" className="relative">
                  Additional Info
                  {Object.keys(formErrors).some((key) => ["benefits", "about_company", "deadline"].includes(key)) && (
                    <span className="absolute top-0 right-1 w-2 h-2 bg-destructive rounded-full"></span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Basic Information</CardTitle>
                    <CardDescription>Enter the fundamental details about the job position</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="title" className={formErrors.title ? "text-destructive" : ""}>
                          Job Title <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => handleInputChange("title", e.target.value)}
                          placeholder="e.g. Senior Software Engineer"
                          className={formErrors.title ? "border-destructive" : ""}
                        />
                        {formErrors.title && <p className="text-sm text-destructive">{formErrors.title}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company" className={formErrors.company ? "text-destructive" : ""}>
                          Company Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="company"
                          value={formData.company}
                          onChange={(e) => handleInputChange("company", e.target.value)}
                          placeholder="e.g. Tech Corp"
                          className={formErrors.company ? "border-destructive" : ""}
                        />
                        {formErrors.company && <p className="text-sm text-destructive">{formErrors.company}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="location" className={formErrors.location ? "text-destructive" : ""}>
                          Location <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            id="location"
                            value={formData.location}
                            onChange={(e) => handleInputChange("location", e.target.value)}
                            placeholder="e.g. New York, NY"
                            className={`pl-9 ${formErrors.location ? "border-destructive" : ""}`}
                          />
                        </div>
                        {formErrors.location && <p className="text-sm text-destructive">{formErrors.location}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="employment_type"
                          className={formErrors.employment_type ? "text-destructive" : ""}
                        >
                          Employment Type <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={formData.employment_type}
                          onValueChange={(value) => handleInputChange("employment_type", value)}
                        >
                          <SelectTrigger
                            id="employment_type"
                            className={formErrors.employment_type ? "border-destructive" : ""}
                          >
                            <SelectValue placeholder="Select employment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full-time">Full-time</SelectItem>
                            <SelectItem value="part-time">Part-time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="internship">Internship</SelectItem>
                            <SelectItem value="freelance">Freelance</SelectItem>
                          </SelectContent>
                        </Select>
                        {formErrors.employment_type && (
                          <p className="text-sm text-destructive">{formErrors.employment_type}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="experience_required"
                          className={formErrors.experience_required ? "text-destructive" : ""}
                        >
                          Minimum Experience <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            id="experience_required"
                            value={formData.experience_required}
                            onChange={(e) => handleInputChange("experience_required", e.target.value)}
                            placeholder="e.g. 5+ years"
                            className={`pl-9 ${formErrors.experience_required ? "border-destructive" : ""}`}
                          />
                        </div>
                        {formErrors.experience_required && (
                          <p className="text-sm text-destructive">{formErrors.experience_required}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="salary_range" className={formErrors.salary_range ? "text-destructive" : ""}>
                          Salary Range <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            id="salary_range"
                            value={formData.salary_range}
                            onChange={(e) => handleInputChange("salary_range", e.target.value)}
                            placeholder="e.g. $120,000 - $150,000"
                            className={`pl-9 ${formErrors.salary_range ? "border-destructive" : ""}`}
                          />
                        </div>
                        {formErrors.salary_range && <p className="text-sm text-destructive">{formErrors.salary_range}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className={formErrors.description ? "text-destructive" : ""}>
                        Job Description <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleInputChange("description", e.target.value)}
                        placeholder="Provide a detailed description of the job role"
                        className={formErrors.description ? "border-destructive" : ""}
                      />
                      {formErrors.description && <p className="text-sm text-destructive">{formErrors.description}</p>}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="requirements" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Requirements</CardTitle>
                    <CardDescription>Specify the requirements and skills needed for the job</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="requirements" className={formErrors.requirements ? "text-destructive" : ""}>
                        Job Requirements <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="requirements"
                        value={requirements.join("\n")}
                        onChange={handleRequirementChange}
                        placeholder="List the job requirements, one per line"
                        className={formErrors.requirements ? "border-destructive" : ""}
                      />
                      {formErrors.requirements && <p className="text-sm text-destructive">{formErrors.requirements}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="skills" className={formErrors.skills ? "text-destructive" : ""}>
                        Required Skills <span className="text-destructive">*</span>
                      </Label>
                      <SkillInput skills={skillsRequired} setSkills={setSkillsRequired} />
                      {formErrors.skills && <p className="text-sm text-destructive">{formErrors.skills}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nice_to_have_skills">Nice-to-Have Skills</Label>
                      <Textarea
                        id="nice_to_have_skills"
                        value={niceToHaveSkills.join("\n")}
                        onChange={(e) => setNiceToHaveSkills(e.target.value.split("\n"))}
                        placeholder="List any additional skills that are nice to have, one per line"
                      />
                    </div>
                    <RubricConfigEditor rubric={rubric} onChange={setRubric} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="details" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Job Details</CardTitle>
                    <CardDescription>Provide additional details about the job role</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="working_hours" className={formErrors.working_hours ? "text-destructive" : ""}>
                        Working Hours <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          id="working_hours"
                          value={formData.working_hours}
                          onChange={(e) => handleInputChange("working_hours", e.target.value)}
                          placeholder="e.g. 9 AM - 5 PM"
                          className={`pl-9 ${formErrors.working_hours ? "border-destructive" : ""}`}
                        />
                      </div>
                      {formErrors.working_hours && <p className="text-sm text-destructive">{formErrors.working_hours}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mode_of_work" className={formErrors.mode_of_work ? "text-destructive" : ""}>
                        Mode of Work <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.mode_of_work}
                        onValueChange={(value) => handleInputChange("mode_of_work", value)}
                      >
                        <SelectTrigger
                          id="mode_of_work"
                          className={formErrors.mode_of_work ? "border-destructive" : ""}
                        >
                          <SelectValue placeholder="Select mode of work" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="onsite">Onsite</SelectItem>
                          <SelectItem value="remote">Remote</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                      {formErrors.mode_of_work && <p className="text-sm text-destructive">{formErrors.mode_of_work}</p>}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="additional" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Additional Information</CardTitle>
                    <CardDescription>Provide any additional information about the job</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="benefits" className={formErrors.benefits ? "text-destructive" : ""}>
                        Benefits <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="benefits"
                        value={benefits.join("\n")}
                        onChange={(e) => setBenefits(e.target.value.split("\n"))}
                        placeholder="List the benefits, one per line"
                        className={formErrors.benefits ? "border-destructive" : ""}
                      />
                      {formErrors.benefits && <p className="text-sm text-destructive">{formErrors.benefits}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="about_company">About the Company</Label>
                      <Textarea
                        id="about_company"
                        value={formData.about_company}
                        onChange={(e) => handleInputChange("about_company", e.target.value)}
                        placeholder="Provide a brief description about the company"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deadline" className={formErrors.deadline ? "text-destructive" : ""}>
                        Application Deadline <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          id="deadline"
                          type="date"
                          value={formData.deadline}
                          onChange={(e) => handleInputChange("deadline", e.target.value)}
                          className={`pl-9 ${formErrors.deadline ? "border-destructive" : ""}`}
                        />
                      </div>
                      {formErrors.deadline && <p className="text-sm text-destructive">{formErrors.deadline}</p>}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {Object.keys(formErrors).length > 0 && (
              <Alert variant="destructive" className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Validation Error</AlertTitle>
                <AlertDescription>Please fill in all required fields</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end mt-6">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <span className="mr-2">Submitting...</span>}
                Post Job
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
