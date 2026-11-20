"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import apiClient from "@/lib/api-client"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Star,
  ExternalLink,
  Github,
  Mail,
  Briefcase,
  GraduationCap,
  Sparkles,
  ShieldAlert,
  Flame,
  FileText,
  Keyboard,
  Loader2,
  CheckCircle2,
  Share2
} from "lucide-react"

export default function HighVelocityTriagePage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params?.jobId as string

  const [candidates, setCandidates] = useState<any[]>([])
  const [job, setJob] = useState<any>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const fetchJobAndCandidates = useCallback(async () => {
    try {
      setLoading(true)
      const [jobData, candidateList] = await Promise.all([
        apiClient.jobs.getById(jobId),
        apiClient.jobs.getCandidates(jobId),
      ])
      setJob(jobData)
      const list = Array.isArray(candidateList) ? candidateList : []
      setCandidates(list)
    } catch (err: any) {
      toast.error(err.message || "Failed to load triage queue")
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchJobAndCandidates()
  }, [fetchJobAndCandidates])

  const currentCandidate = candidates[currentIndex] || null

  // Fetch candidate resume file for preview
  useEffect(() => {
    if (!currentCandidate || !jobId) {
      setPdfUrl(null)
      return
    }

    let active = true
    const loadPdf = async () => {
      try {
        const res = await apiClient.jobs.downloadCandidateFile(jobId, currentCandidate.filename)
        if (!active) return
        const blob = new Blob([res.data], { type: "application/pdf" })
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)
      } catch (err) {
        setPdfUrl(null)
      }
    }

    loadPdf()
    return () => {
      active = false
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [currentCandidate?.filename, jobId])

  const advanceCandidate = async (newStatus: string) => {
    if (!currentCandidate || updating) return
    try {
      setUpdating(true)
      await apiClient.jobs.updateCandidateStatus(
        jobId,
        currentCandidate.filename,
        newStatus,
        { triageTimestamp: new Date().toISOString() }
      )

      toast.success(
        newStatus === "shortlisted"
          ? `Advanced ${currentCandidate.name} to Next Stage`
          : `Marked ${currentCandidate.name} as ${newStatus}`
      )

      // Move to next candidate in queue
      if (currentIndex < candidates.length - 1) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        toast.info("You've reached the end of the candidate queue!")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update candidate status")
    } finally {
      setUpdating(false)
    }
  }

  // Keyboard navigation shortcuts: J (next), K (prev), A (advance), R (reject), S (star)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'j':
        case 'arrowright':
          if (currentIndex < candidates.length - 1) setCurrentIndex((i) => i + 1)
          break
        case 'k':
        case 'arrowleft':
          if (currentIndex > 0) setCurrentIndex((i) => i - 1)
          break
        case 'a':
          advanceCandidate('shortlisted')
          break
        case 'r':
          advanceCandidate('disapproved')
          break
        case 's':
          advanceCandidate('interested')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, candidates.length, currentCandidate, updating])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Velocity App Bar */}
      <header className="h-14 border-b flex items-center justify-between px-6 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/jobs/${jobId}/candidates`)}
            className="h-8 gap-1 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pipeline
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate max-w-xs">{job?.title || "Role Triage"}</span>
            <Badge variant="outline" className="text-xs font-mono">
              {candidates.length > 0 ? `${currentIndex + 1} of ${candidates.length}` : "0"}
            </Badge>
          </div>
        </div>

        {/* Keyboard Shortcuts Hint Bar */}
        <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground bg-muted/40 px-3 py-1 rounded-md border">
          <Keyboard className="w-3.5 h-3.5 text-primary" />
          <span><kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">A</kbd> Shortlist</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">R</kbd> Disapprove</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">J</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">K</kbd> Next/Prev</span>
        </div>

        {/* Navigation & Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => i - 1)}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentIndex >= candidates.length - 1}
            onClick={() => setCurrentIndex((i) => i + 1)}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!currentCandidate || updating}
            onClick={() => advanceCandidate('disapproved')}
            className="h-8 gap-1 text-xs"
          >
            <X className="w-3.5 h-3.5" />
            Disapprove
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={!currentCandidate || updating}
            onClick={() => advanceCandidate('shortlisted')}
            className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700"
          >
            <Check className="w-3.5 h-3.5" />
            Shortlist Candidate
          </Button>
        </div>
      </header>

      {/* Main Split Screen Area */}
      {candidates.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div className="max-w-md space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-xl font-bold">Queue Zero Reached</h3>
            <p className="text-sm text-muted-foreground">
              All candidate applications for this role have been reviewed!
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: PDF Viewer / Document View */}
          <div className="flex-1 bg-muted/30 border-r flex flex-col relative overflow-hidden">
            {pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0`}
                className="w-full h-full border-none"
                title="Candidate Resume"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                <FileText className="w-8 h-8 mb-2 opacity-40 animate-pulse" />
                <p>Loading candidate document...</p>
              </div>
            )}
          </div>

          {/* Right Pane: AI Evidence & Telemetry Dossier */}
          <div className="w-full md:w-[480px] lg:w-[540px] bg-card overflow-y-auto p-6 space-y-6 shrink-0">
            {currentCandidate && (
              <>
                {/* Candidate Overview Header */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-foreground truncate">
                      {currentCandidate.name}
                    </h2>
                    <Badge variant="outline" className="text-xs">
                      {currentCandidate.tracking?.status || "pending"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    {currentCandidate.email}
                  </p>
                </div>

                <Separator />

                {/* Score & Rubric Breakdown */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      HackerRank Rubric Score
                    </h3>
                    <span className="text-2xl font-extrabold text-primary">
                      {currentCandidate.matchAnalysis?.matchPercentage || 0}%
                    </span>
                  </div>
                  <Progress
                    value={currentCandidate.matchAnalysis?.matchPercentage || 0}
                    className="h-2"
                  />

                  {currentCandidate.matchAnalysis?.overallAssessment && (
                    <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg leading-relaxed italic">
                      "{currentCandidate.matchAnalysis.overallAssessment}"
                    </p>
                  )}
                </div>

                {/* Rubric Category Scores */}
                {currentCandidate.matchAnalysis?.categoryBreakdown?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Category Breakdown & Citations
                    </h4>
                    <div className="space-y-2">
                      {currentCandidate.matchAnalysis.categoryBreakdown.map((cat: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-lg border bg-muted/20 text-xs space-y-1">
                          <div className="flex justify-between font-medium">
                            <span>{cat.label}</span>
                            <span className="text-primary font-bold">
                              {cat.score} / {cat.maxScore}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground italic">
                            "{cat.evidence}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bonus Signals */}
                {currentCandidate.matchAnalysis?.bonuses?.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      Bonus Points
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {currentCandidate.matchAnalysis.bonuses.map((b: any, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs py-0.5">
                          +{b.points} pts: {b.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Screening Gaps / Risks */}
                {currentCandidate.matchAnalysis?.flagsOrGaps?.length > 0 && (
                  <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 space-y-1 text-xs">
                    <h4 className="font-semibold text-destructive flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Risks & Missing Requirements
                    </h4>
                    <ul className="list-disc pl-4 text-muted-foreground space-y-0.5 text-[11px]">
                      {currentCandidate.matchAnalysis.flagsOrGaps.map((f: string, idx: number) => (
                        <li key={idx}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* GitHub Telemetry */}
                {currentCandidate.matchAnalysis?.githubEnrichment && (
                  <div className="p-3.5 rounded-lg border bg-muted/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Github className="w-4 h-4" />
                        GitHub: @{currentCandidate.matchAnalysis.githubEnrichment.username}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {currentCandidate.matchAnalysis.githubEnrichment.followers} followers
                      </span>
                    </div>
                    {currentCandidate.matchAnalysis.githubEnrichment.topLanguages?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {currentCandidate.matchAnalysis.githubEnrichment.topLanguages.map((l: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-[10px]">
                            {l}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
