"use client"

import type React from "react"

import { useEffect, useState, useCallback } from "react"
import type { Candidate, CandidateStatus } from "@/app/jobs/[jobId]/candidates/page"
import { format } from "date-fns"
import {
  Check,
  Circle,
  CircleDot,
  Download,
  Mail,
  Calendar,
  Clock,
  Award,
  Briefcase,
  GraduationCap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CandidateActions } from "@/components/candidate-actions"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import apiClient from "@/lib/api-client"

const getStatusOrder = (status: CandidateStatus): number => {
  const order: Record<CandidateStatus, number> = {
    pending: 0,
    shortlisted: 1,
    contacted: 2,
    interested: 3,
    not_interested: 3,
    rate_confirmed: 4,
    interview_scheduled: 5,
    approved: 6,
    disapproved: 6,
  }
  return order[status]
}

interface CandidateDetailsSheetProps {
  candidate: Candidate | null
  jobId: string
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

const StatusButton = ({
  status,
  currentStatus,
  onClick,
  children,
}: {
  status: CandidateStatus
  currentStatus?: CandidateStatus
  onClick: (status: CandidateStatus) => void
  children: React.ReactNode
}) => {
  const isActive = currentStatus === status
  const isPrevious = currentStatus && getStatusOrder(currentStatus) > getStatusOrder(status)

  return (
    <Button
      variant={isActive ? "default" : isPrevious ? "secondary" : "outline"}
      className="w-full justify-start"
      onClick={() => onClick(status)}
    >
      {isPrevious && <Check className="w-4 h-4 mr-2" />}
      {isActive && <CircleDot className="w-4 h-4 mr-2" />}
      {!isPrevious && !isActive && <Circle className="w-4 h-4 mr-2" />}
      {children}
    </Button>
  )
}

export function CandidateDetailsSheet({
  candidate: initialCandidate,
  jobId,
  isOpen,
  onClose,
  onUpdate,
}: CandidateDetailsSheetProps) {
  const [candidate, setCandidate] = useState<Candidate | null>(initialCandidate)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    setCandidate(initialCandidate)
  }, [initialCandidate])

  // Function to fetch the latest candidate data
  const fetchCandidate = useCallback(async () => {
    if (!isOpen || !jobId || !initialCandidate) return;

    try {
      console.log(`Fetching candidate updates for ${initialCandidate.filename}`);
      
      // Get all candidates for the job
      const response = await apiClient.jobs.getCandidates(jobId);
      const candidates = response instanceof Response 
        ? await response.json() as Candidate[]
        : response as Candidate[];
      
      // Find the specific candidate we're looking at
      const updatedCandidate = candidates.find((c: Candidate) => c.filename === initialCandidate.filename);
      
      if (updatedCandidate) {
        console.log('Found updated candidate with tracking:', updatedCandidate.tracking);
        setCandidate(updatedCandidate);
      } else {
        console.warn(`Candidate ${initialCandidate.filename} not found in updated data`);
      }
    } catch (error) {
      console.error("Error fetching candidate update:", error);
    }
  }, [jobId, initialCandidate, isOpen]);

  // Set up polling for candidate updates when sheet is open
  useEffect(() => {
    if (!isOpen || !jobId || !initialCandidate) return;
    
    // Initial fetch
    fetchCandidate();
    
    // Set up polling interval (every 3 seconds)
    const intervalId = setInterval(fetchCandidate, 3000);
    
    // Clean up interval on unmount or when sheet closes
    return () => clearInterval(intervalId);
  }, [jobId, initialCandidate, isOpen, fetchCandidate]);

  const handleStatusChange = async (newStatus: CandidateStatus) => {
    if (!candidate || !jobId) return;

    try {
      // Show loading toast
      const loadingId = toast.loading(`Updating status to ${newStatus.replace("_", " ")}...`);
      
      // Determine if we should include additional data based on status
      let additionalData = {};
      
      if (newStatus === "interview_scheduled") {
        additionalData = { 
          interviewDate: new Date().toISOString() 
        };
      } else if (newStatus === "rate_confirmed") {
        // For rate confirmed, we should use a proper rate
        // In a real app, you would prompt for this value
        additionalData = { 
          rateConfirmed: 50 // default rate or you can implement a dialog to ask the user
        };
      } else if (newStatus === "contacted") {
        additionalData = { 
          contactedDate: new Date().toISOString() 
        };
      }

      // Use the API client to update candidate status
      const result = await apiClient.jobs.updateCandidateStatus(
        jobId,
        candidate.filename, // Using filename as the candidateId
        newStatus,
        additionalData
      ) as { tracking?: Candidate['tracking'] };

      console.log('Status update result:', JSON.stringify(result, null, 2));
      console.log('Tracking data returned by API:', result?.tracking ? JSON.stringify(result.tracking, null, 2) : 'No tracking data');

      // Dismiss loading toast and show success
      toast.dismiss(loadingId);
      toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
      
      // If the API returned updated tracking data, update it immediately
      if (result && result.tracking && candidate) {
        setCandidate({
          ...candidate,
          tracking: result.tracking
        });
      }
      
      // First trigger parent component update to refresh list
      await onUpdate();
      
      // Wait a moment to ensure database updates propagate
      setTimeout(async () => {
        // Then fetch the updated candidate data again
        await fetchCandidate();
      }, 1000);
    } catch (error) {
      console.error("Error updating status:", error);
      
      // Show more helpful error message
      let errorMessage = "Failed to update status";
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      
      toast.error(errorMessage);
    }
  }

  const downloadResume = async () => {
    if (!candidate?.filename || !jobId) {
      toast.error("Resume file not found");
      return;
    }
    try {
      const response = await apiClient.jobs.downloadCandidateFile(jobId, candidate.filename);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = candidate.filename.replace(/^[0-9a-f\-]{36}_/i, "") || "resume.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading resume:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download resume"
      );
    }
  }


  if (!candidate) return null

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <div className="sticky top-0 bg-background z-10 border-b">
          <SheetHeader className="p-6 pb-4">
            <div className="flex items-center gap-4">
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
                <SheetTitle className="text-2xl">{candidate.name}</SheetTitle>
                <SheetDescription className="flex items-center">
                  <Mail className="w-3.5 h-3.5 mr-1.5" />
                  {candidate.email}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6 border-b">
            <TabsList className="grid grid-cols-3 mb-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="experience">Experience</TabsTrigger>
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 pt-4">
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* Match Score */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Match Score</h3>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold text-primary">{candidate.matchAnalysis.matchPercentage}%</div>
                  <div className="flex-1">
                    <Progress value={candidate.matchAnalysis.matchPercentage} className="h-2 mb-2" />
                    <div className="flex justify-between text-sm">
                      <span className={candidate.matchAnalysis.experienceMatch ? "text-green-600" : "text-yellow-600"}>
                        <Briefcase className="w-3.5 h-3.5 inline mr-1" />
                        Experience: {candidate.matchAnalysis.experienceMatch ? "Match" : "Partial"}
                      </span>
                      <span className={candidate.matchAnalysis.educationMatch ? "text-green-600" : "text-yellow-600"}>
                        <GraduationCap className="w-3.5 h-3.5 inline mr-1" />
                        Education: {candidate.matchAnalysis.educationMatch ? "Match" : "Partial"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Matching Skills */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Matching Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {candidate.matchAnalysis.matchingSkills.map((skill, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Missing Requirements */}
              {candidate.matchAnalysis.missingRequirements.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg text-yellow-600">Missing Requirements</h3>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      {candidate.matchAnalysis.missingRequirements.map((req, index) => (
                        <li key={index}>{req}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              <Separator />

              {/* Education Summary */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Education</h3>
                <div className="space-y-2">
                  {candidate.analysis.education_details.map((edu, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="mt-0.5 bg-primary/10 p-1.5 rounded-md">
                        <GraduationCap className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {edu.degree} in {edu.major}
                        </h4>
                        <p className="text-sm text-muted-foreground">{edu.institute}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Work Experience Summary */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Recent Experience</h3>
                <div className="space-y-3">
                  {candidate.analysis.work_experience_details.slice(0, 2).map((exp, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="mt-0.5 bg-primary/10 p-1.5 rounded-md">
                        <Briefcase className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {exp.position} at {exp.company}
                        </h4>
                        {exp.duration && (
                          <p className="text-sm text-muted-foreground">
                            {exp.duration.start} - {exp.duration.end || "Present"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {candidate.analysis.work_experience_details.length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-primary"
                      onClick={() => setActiveTab("experience")}
                    >
                      View all experience ({candidate.analysis.work_experience_details.length})
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="experience" className="mt-0 space-y-6">
              {/* Work Experience */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Work Experience</h3>
                <div className="space-y-6">
                  {candidate.analysis.work_experience_details.map((exp, index) => (
                    <div
                      key={index}
                      className="space-y-2 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-0 before:w-0.5 before:bg-muted last:before:hidden"
                    >
                      <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                      </div>
                      <h4 className="font-medium">
                        {exp.position} at {exp.company}
                      </h4>
                      {exp.duration && (
                        <p className="text-sm text-muted-foreground">
                          {exp.duration.start} - {exp.duration.end || "Present"}
                        </p>
                      )}
                      {exp.responsibilities && (
                        <div>
                          <h5 className="text-sm font-medium mb-1">Responsibilities:</h5>
                          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            {exp.responsibilities.map((resp, idx) => (
                              <li key={idx}>{resp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {exp.technologies && exp.technologies.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-sm font-medium mb-1">Technologies:</h5>
                          <div className="flex flex-wrap gap-1">
                            {exp.technologies.map((tech, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Education */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Education</h3>
                <div className="space-y-4">
                  {candidate.analysis.education_details.map((edu, index) => (
                    <div
                      key={index}
                      className="space-y-1 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-0 before:w-0.5 before:bg-muted last:before:hidden"
                    >
                      <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                      </div>
                      <h4 className="font-medium">
                        {edu.degree} in {edu.major}
                      </h4>
                      <p className="text-sm text-muted-foreground">{edu.institute}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tracking" className="mt-0 space-y-6">
              {/* Update Status */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Update Status</h3>
                <div className="space-y-2">
                  <StatusButton
                    status="shortlisted"
                    currentStatus={candidate.tracking?.status}
                    onClick={handleStatusChange}
                  >
                    Shortlisted
                  </StatusButton>
                  <StatusButton
                    status="contacted"
                    currentStatus={candidate.tracking?.status}
                    onClick={handleStatusChange}
                  >
                    Contacted
                  </StatusButton>
                  <StatusButton
                    status="interested"
                    currentStatus={candidate.tracking?.status}
                    onClick={handleStatusChange}
                  >
                    Interested
                  </StatusButton>
                  <StatusButton
                    status="rate_confirmed"
                    currentStatus={candidate.tracking?.status}
                    onClick={handleStatusChange}
                  >
                    Rate Confirmed
                  </StatusButton>
                  <StatusButton
                    status="interview_scheduled"
                    currentStatus={candidate.tracking?.status}
                    onClick={handleStatusChange}
                  >
                    Schedule Interview
                  </StatusButton>
                  <StatusButton status="approved" currentStatus={candidate.tracking?.status} onClick={handleStatusChange}>
                    Approve
                  </StatusButton>
                  <StatusButton
                    status="disapproved"
                    currentStatus={candidate.tracking?.status}
                    onClick={handleStatusChange}
                  >
                    Disapprove
                  </StatusButton>
                </div>
              </div>

              <Separator />

              {/* Tracking Information */}
              {candidate?.tracking && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Status Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md">
                      <span className="text-sm font-medium">Current Status:</span>
                      <Badge
                        variant={
                          candidate.tracking.status === "approved"
                            ? "default"
                            : candidate.tracking.status === "disapproved"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {candidate.tracking.status.replace("_", " ")}
                      </Badge>
                    </div>

                    {candidate.tracking.rateConfirmed && (
                      <div className="flex items-center gap-2 text-sm">
                        <Award className="w-4 h-4 text-yellow-500" />
                        Rate: <span className="font-medium">${candidate.tracking.rateConfirmed}/hr</span>
                      </div>
                    )}

                    {candidate.tracking.interviewDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        Interview:{" "}
                        <span className="font-medium">{format(new Date(candidate.tracking.interviewDate), "PPp")}</span>
                      </div>
                    )}

                    {candidate?.tracking?.lastUpdated && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        Last updated: {format(new Date(candidate.tracking.lastUpdated), "PPp")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Candidate Actions */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Actions</h3>
                <CandidateActions candidate={candidate} jobId={jobId} onUpdate={onUpdate} />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <SheetFooter className="sticky bottom-0 bg-background border-t p-4 flex flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={downloadResume}>
            <Download className="w-4 h-4 mr-2" />
            Download Resume
          </Button>
          <Button className="flex-1">
            <Mail className="w-4 h-4 mr-2" />
            Contact
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

