"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  Briefcase,
  MapPin,
  DollarSign,
  UploadCloud,
  CheckCircle2,
  Building,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileText,
  Loader2
} from "lucide-react"

export default function PublicJobPortalPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params?.jobId as string

  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Candidate application form
  const [candidateName, setCandidateName] = useState("")
  const [candidateEmail, setCandidateEmail] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [file, setFile] = useState<{ name: string; type: string; data: string } | null>(null)

  useEffect(() => {
    if (!jobId) return
    const fetchJob = async () => {
      try {
        setLoading(true)
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"
        const res = await fetch(`${baseUrl}/portal/${jobId}`)
        if (!res.ok) throw new Error("Job not found or inactive")
        const data = await res.json()
        setJob(data)
      } catch (err: any) {
        toast.error(err.message || "Failed to load job details")
      } finally {
        setLoading(false)
      }
    }
    fetchJob()
  }, [jobId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      toast.error("Please upload a PDF resume")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64Data = (reader.result as string).split(",")[1]
      setFile({
        name: selectedFile.name,
        type: selectedFile.type || "application/pdf",
        data: base64Data,
      })
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error("Please attach your resume PDF")
      return
    }

    try {
      setSubmitting(true)
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"
      const res = await fetch(`${baseUrl}/portal/${jobId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          candidateName,
          candidateEmail,
          vendorName,
          file,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Submission failed")
      }

      setSubmitted(true)
      toast.success("Application received! You will hear from the team soon.")
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full text-center p-6">
          <CardTitle className="text-lg">Job Not Found</CardTitle>
          <CardDescription className="mt-2">
            This job listing may have expired or is no longer accepting submissions.
          </CardDescription>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm">
              HN
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">HireNexa Candidate Portal</h1>
              <p className="text-xs text-muted-foreground">Direct application & vendor intake channel</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-background text-xs py-1 px-3">
            Active Requisition
          </Badge>
        </div>

        {/* Job Header Card */}
        <Card className="border bg-card shadow-sm">
          <CardContent className="p-6 md:p-8 space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">{job.title}</h2>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Building className="w-4 h-4 text-primary" />
                  {job.company}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {job.location} ({job.mode_of_work || "Onsite"})
                </span>
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  {job.employment_type}
                </span>
                {job.salary_range && (
                  <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <DollarSign className="w-4 h-4" />
                    {job.salary_range}
                  </span>
                )}
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <div>
                <h3 className="text-base font-semibold text-foreground mb-2">Role Overview</h3>
                <p className="whitespace-pre-line">{job.description}</p>
              </div>

              {job.skills_required?.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">Required Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills_required.map((s: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Application Form */}
        <Card className="border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Submit Application</CardTitle>
            <CardDescription className="text-xs">
              Upload your resume for instant AI parsing and matching into the hiring loop.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold">Application Received!</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Your resume has been parsed and submitted directly to the hiring managers at {job.company}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Full Name *</label>
                    <Input
                      required
                      placeholder="Jane Doe"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Email Address *</label>
                    <Input
                      type="email"
                      required
                      placeholder="jane@example.com"
                      value={candidateEmail}
                      onChange={(e) => setCandidateEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">
                    Referring Agency / Vendor (Optional)
                  </label>
                  <Input
                    placeholder="Leave blank if direct applicant, or enter agency name"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                  />
                </div>

                {/* Resume Upload Box */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Resume PDF *</label>
                  <div className="border-2 border-dashed rounded-xl p-6 text-center hover:bg-muted/30 transition-colors cursor-pointer relative">
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      required
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div className="text-xs">
                        {file ? (
                          <span className="font-semibold text-primary flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {file.name}
                          </span>
                        ) : (
                          <>
                            <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                            <p className="text-muted-foreground text-[11px]">PDF only (Max 15MB)</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={submitting} className="w-full h-10 text-sm">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing & Submitting...
                    </>
                  ) : (
                    <>
                      Submit Application
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
