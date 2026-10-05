"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { ArrowLeft, Briefcase, Clock, Building, FileText, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { useMediaQuery } from "@/hooks/use-media-query"
import apiClient from "@/lib/api-client"

// First, let's define proper interfaces for the metadata and job data
interface JobMetadata {
  last_modified_by?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: string | undefined;
}

interface JobFormData {
  title: string;
  company: string;
  location: string;
  description: string;
  employment_type: string;
  experience_required: string;
  salary_range: string;
  status: string;
  requirements: string;
  benefits: string;
  skills_required: string;
  nice_to_have_skills: string;
  working_hours: string;
  mode_of_work: string;
  deadline: string;
  key_responsibilities: string;
  about_company: string;
}

export default function EditJobPage() {
  const params = useParams()
  const jobId = params.jobId as string
  const router = useRouter()
  const { user } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [jobData, setJobData] = useState<JobData | null>(null)
  const [formData, setFormData] = useState<JobFormData>({
    title: "",
    company: "",
    location: "",
    description: "",
    employment_type: "",
    experience_required: "",
    salary_range: "",
    status: "active",
    requirements: "",
    benefits: "",
    skills_required: "",
    nice_to_have_skills: "",
    working_hours: "",
    mode_of_work: "",
    deadline: "",
    key_responsibilities: "",
    about_company: "",
  })

  // Update the JobData interface to include all possible fields
  interface JobData {
    title: string;
    company: string;
    location: string;
    description: string;
    employment_type: string;
    experience_required: string;
    salary_range: string;
    status: string;
    requirements: string[];
    benefits: string[];
    skills_required: string[];
    nice_to_have_skills?: string[];
    working_hours?: string;
    mode_of_work?: string;
    deadline?: string;
    key_responsibilities?: string[];
    about_company?: string;
    metadata: JobMetadata;
    updated_at?: string;
    created_at?: string;
    [key: string]: unknown;  // For any additional properties that might exist
  }

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!user) {
        router.push("/login")
        return
      }

      try {
        setIsLoading(true)

        // Fetch through the API client (authenticated + env-based URL) — this
        // previously hard-coded http://localhost:5001 with no auth header, so
        // it only ever worked on the author's machine.
        const job = await apiClient.jobs.getById(jobId) as unknown as JobData;

        // Add nullish coalescing to avoid property access errors
        if (job) {
          setJobData(job);

          // Format the data for the form
          setFormData({
            title: job.title || "",
            company: job.company || "",
            location: job.location || "",
            description: job.description || "",
            employment_type: job.employment_type || "",
            experience_required: job.experience_required || "",
            salary_range: job.salary_range || "",
            status: job.status || "active",
            requirements: job.requirements ? job.requirements.join("\n") : "",
            benefits: job.benefits ? job.benefits.join("\n") : "",
            skills_required: job.skills_required ? job.skills_required.join(", ") : "",
            nice_to_have_skills: job.nice_to_have_skills ? job.nice_to_have_skills.join(", ") : "",
            working_hours: job.working_hours || "",
            mode_of_work: job.mode_of_work || "",
            deadline: job.deadline || "",
            key_responsibilities: job.key_responsibilities ? job.key_responsibilities.join("\n") : "",
            about_company: job.about_company || "",
          })
        } else {
          toast({
            title: "Error",
            description: "Job not found",
            variant: "destructive",
          })
          router.push("/job")
          return
        }
      } catch (error) {
        console.error("Error fetching job details:", error)
        toast({
          title: "Error",
          description: "Failed to load job details",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchJobDetails()
  }, [jobId, user, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to update a job",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      // Process the form data
      const processedData = {
        title: formData.title,
        company: formData.company,
        location: formData.location,
        description: formData.description,
        employment_type: formData.employment_type,
        experience_required: formData.experience_required,
        salary_range: formData.salary_range,
        status: formData.status,
        requirements: formData.requirements.split("\n").filter((item) => item.trim() !== ""),
        benefits: formData.benefits.split("\n").filter((item) => item.trim() !== ""),
        skills_required: formData.skills_required
          .split(",")
          .map((skill) => skill.trim())
          .filter((skill) => skill !== ""),
        nice_to_have_skills: formData.nice_to_have_skills
          ? formData.nice_to_have_skills
              .split(",")
              .map((skill) => skill.trim())
              .filter((skill) => skill !== "")
          : [],
        working_hours: formData.working_hours,
        mode_of_work: formData.mode_of_work,
        deadline: formData.deadline,
        key_responsibilities: formData.key_responsibilities
          ? formData.key_responsibilities.split("\n").filter((item) => item.trim() !== "")
          : [],
        about_company: formData.about_company,
        updated_at: new Date(),
        metadata: {
          ...(jobData?.metadata || {}),
          last_modified_by: user.email || "",
        },
      }

      // Update the job using API client
      await apiClient.jobs.update(jobId, processedData);

      toast({
        title: "Success",
        description: "Job updated successfully",
      })

      // Redirect to the job page
      router.push("/job")
    } catch (error) {
      console.error("Error updating job:", error)
      toast({
        title: "Error",
        description: "Failed to update job",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <DashboardSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div
        className="flex-1 py-8 px-4 md:px-8 overflow-y-auto"
        style={{
          marginLeft: isMobile ? 0 : isSidebarOpen ? "16rem" : "4.5rem",
          width: isMobile ? "100%" : isSidebarOpen ? "calc(100% - 16rem)" : "calc(100% - 4.5rem)",
        }}
      >
        <Button variant="ghost" className="mb-6 group" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Jobs
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/10 p-2 rounded-md">
            <Briefcase className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Edit Job</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title *</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g. Senior Frontend Developer"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    name="company"
                    placeholder="e.g. Acme Inc."
                    value={formData.company}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    name="location"
                    placeholder="e.g. New York, NY"
                    value={formData.location}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Job Description *</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Enter job description..."
                  value={formData.description}
                  onChange={handleInputChange}
                  className="min-h-32"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Job Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Job Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employment_type">Employment Type *</Label>
                  <Select
                    value={formData.employment_type}
                    onValueChange={(value) => handleSelectChange("employment_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Freelance">Freelance</SelectItem>
                      <SelectItem value="Internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience_required">Experience Required *</Label>
                  <Input
                    id="experience_required"
                    name="experience_required"
                    placeholder="e.g. 3-5 years"
                    value={formData.experience_required}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salary_range">Salary Range *</Label>
                  <Input
                    id="salary_range"
                    name="salary_range"
                    placeholder="e.g. $80,000 - $100,000"
                    value={formData.salary_range}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="working_hours">Working Hours</Label>
                  <Input
                    id="working_hours"
                    name="working_hours"
                    placeholder="e.g. 9 AM - 5 PM EST"
                    value={formData.working_hours}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mode_of_work">Mode of Work</Label>
                  <Select
                    value={formData.mode_of_work}
                    onValueChange={(value) => handleSelectChange("mode_of_work", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Remote">Remote</SelectItem>
                      <SelectItem value="On-site">On-site</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Application Deadline</Label>
                <Input
                  id="deadline"
                  name="deadline"
                  placeholder="e.g. December 31, 2023"
                  value={formData.deadline}
                  onChange={handleInputChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Requirements and Skills */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Requirements and Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="requirements">Requirements (One per line) *</Label>
                <Textarea
                  id="requirements"
                  name="requirements"
                  placeholder="Enter each requirement on a new line..."
                  value={formData.requirements}
                  onChange={handleInputChange}
                  className="min-h-32"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="key_responsibilities">Key Responsibilities (One per line)</Label>
                <Textarea
                  id="key_responsibilities"
                  name="key_responsibilities"
                  placeholder="Enter each responsibility on a new line..."
                  value={formData.key_responsibilities}
                  onChange={handleInputChange}
                  className="min-h-32"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills_required">Required Skills (Comma separated) *</Label>
                <Textarea
                  id="skills_required"
                  name="skills_required"
                  placeholder="e.g. JavaScript, React, Node.js"
                  value={formData.skills_required}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nice_to_have_skills">Nice-to-have Skills (Comma separated)</Label>
                <Textarea
                  id="nice_to_have_skills"
                  name="nice_to_have_skills"
                  placeholder="e.g. TypeScript, GraphQL, AWS"
                  value={formData.nice_to_have_skills}
                  onChange={handleInputChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Benefits and Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                Benefits and Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="benefits">Benefits (One per line) *</Label>
                <Textarea
                  id="benefits"
                  name="benefits"
                  placeholder="Enter each benefit on a new line..."
                  value={formData.benefits}
                  onChange={handleInputChange}
                  className="min-h-32"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="about_company">About the Company</Label>
                <Textarea
                  id="about_company"
                  name="about_company"
                  placeholder="Enter information about the company..."
                  value={formData.about_company}
                  onChange={handleInputChange}
                  className="min-h-32"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <CardFooter className="flex justify-end pt-4">
            <Button type="submit" className="bg-gradient-to-r from-primary to-primary/80" disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </div>
    </div>
  )
}

