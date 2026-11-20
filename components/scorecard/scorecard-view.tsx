"use client"

import React, { useState, useEffect } from "react"
import { type InterviewScorecard, type ScorecardCriterion, type DebriefSynthesis } from "@/types/scorecard"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import apiClient from "@/lib/api-client"
import {
  Sparkles,
  UserCheck,
  UserX,
  ThumbsUp,
  ThumbsDown,
  Star,
  MessageSquare,
  AlertTriangle,
  HelpCircle,
  Loader2,
  Plus
} from "lucide-react"

interface ScorecardViewProps {
  jobId: string
  candidateFilename: string
  candidateName: string
}

const DEFAULT_CRITERIA = [
  { id: "c1", name: "Problem Solving & Architecture", description: "System design clarity, edge case handling, clean patterns" },
  { id: "c2", name: "Technical Competence & Code Quality", description: "Syntax fluency, idiomatic language use, performance" },
  { id: "c3", name: "Communication & Collaboration", description: "Explains thought process well, responsive to hints" },
  { id: "c4", name: "Role & Culture Fit", description: "Values alignment, ownership mentality, curiosity" },
]

export function ScorecardView({ jobId, candidateFilename, candidateName }: ScorecardViewProps) {
  const [scorecards, setScorecards] = useState<InterviewScorecard[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [debrief, setDebrief] = useState<DebriefSynthesis | null>(null)

  // Form state
  const [stage, setStage] = useState("Technical Interview")
  const [recommendation, setRecommendation] = useState<'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire'>('hire')
  const [overallNotes, setOverallNotes] = useState("")
  const [ratings, setRatings] = useState<Record<string, number>>({
    c1: 4,
    c2: 4,
    c3: 4,
    c4: 4,
  })

  const fetchScorecards = async () => {
    try {
      setLoading(true)
      const res = await (apiClient as any).get(`/jobs/${jobId}/candidates/${candidateFilename}/scorecards`)
      setScorecards(Array.isArray(res) ? res : [])
    } catch (err) {
      console.error("Failed to load scorecards:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScorecards()
  }, [jobId, candidateFilename])

  const handleSubmitScorecard = async () => {
    try {
      setIsSubmitting(true)
      const criteriaPayload: ScorecardCriterion[] = DEFAULT_CRITERIA.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        rating: ratings[c.id] || 3,
      }))

      await (apiClient as any).post(`/jobs/${jobId}/candidates/${candidateFilename}/scorecards`, {
        stage,
        recommendation,
        overallNotes,
        criteria: criteriaPayload,
      })

      toast.success("Scorecard submitted successfully")
      setOverallNotes("")
      fetchScorecards()
    } catch (err: any) {
      toast.error(err.message || "Failed to submit scorecard")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSynthesizeDebrief = async () => {
    try {
      setIsSynthesizing(true)
      const res = await (apiClient as any).post(`/jobs/${jobId}/candidates/${candidateFilename}/debrief`, {})
      setDebrief(res)
      toast.success("AI Debrief summary generated")
    } catch (err: any) {
      toast.error(err.message || "Failed to generate debrief synthesis")
    } finally {
      setIsSynthesizing(false)
    }
  }

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'strong_hire':
        return <Badge className="bg-emerald-600 text-white font-medium">Strong Hire</Badge>
      case 'hire':
        return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">Hire</Badge>
      case 'no_hire':
        return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">No Hire</Badge>
      case 'strong_no_hire':
        return <Badge variant="destructive">Strong No Hire</Badge>
      default:
        return <Badge variant="secondary">{rec}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Debrief AI Synthesis Button & Card */}
      <div className="flex items-center justify-between bg-muted/30 p-3.5 rounded-lg border">
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Interview Debrief Synthesis
          </h4>
          <p className="text-xs text-muted-foreground">
            Aggregate multi-interviewer rubrics and synthesize consensus vs divergences.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSynthesizeDebrief}
          disabled={scorecards.length === 0 || isSynthesizing}
          className="gap-1.5"
        >
          {isSynthesizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Generate Debrief
        </Button>
      </div>

      {debrief && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Panel Alignment: {debrief.consensusScore}% Consensus
              </CardTitle>
              <div className="flex gap-1.5">
                {Object.entries(debrief.recommendationDistribution).map(([k, count]) => (
                  count > 0 && (
                    <Badge key={k} variant="outline" className="text-xs capitalize">
                      {k.replace('_', ' ')}: {count}
                    </Badge>
                  )
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {debrief.strengthsSummary.length > 0 && (
              <div>
                <span className="font-semibold text-foreground">Consensus Strengths:</span>
                <ul className="list-disc pl-4 text-muted-foreground mt-1 space-y-0.5">
                  {debrief.strengthsSummary.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {debrief.divergencesAndConcerns.length > 0 && (
              <div>
                <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Divergence Points & Concerns:
                </span>
                <ul className="list-disc pl-4 text-muted-foreground mt-1 space-y-0.5">
                  {debrief.divergencesAndConcerns.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {debrief.suggestedDebriefQuestions.length > 0 && (
              <div>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-primary" />
                  Suggested Questions for the Debrief Call:
                </span>
                <ul className="list-disc pl-4 text-muted-foreground mt-1 space-y-0.5">
                  {debrief.suggestedDebriefQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Existing Scorecards List */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm">Submitted Evaluations ({scorecards.length})</h4>
        {loading ? (
          <div className="text-center py-6 text-sm text-muted-foreground">Loading scorecards...</div>
        ) : scorecards.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg">
            No interview scorecards submitted yet for {candidateName}.
          </div>
        ) : (
          <div className="space-y-3">
            {scorecards.map((sc) => (
              <div key={sc.id} className="p-3.5 rounded-lg border bg-card text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{sc.interviewerName}</span>
                    <Badge variant="outline">{sc.stage}</Badge>
                  </div>
                  {getRecommendationBadge(sc.recommendation)}
                </div>

                {sc.overallNotes && (
                  <p className="text-muted-foreground bg-muted/40 p-2 rounded">
                    "{sc.overallNotes}"
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {sc.criteria.map((c) => (
                    <div key={c.id} className="flex justify-between items-center text-[11px] bg-muted/20 px-2 py-1 rounded">
                      <span className="truncate pr-1 text-muted-foreground">{c.name}</span>
                      <div className="flex items-center font-semibold text-primary">
                        {c.rating}/5 <Star className="w-2.5 h-2.5 ml-0.5 fill-primary" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* New Scorecard Form */}
      <div className="space-y-4 bg-muted/20 p-4 rounded-xl border">
        <h4 className="font-semibold text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-primary" />
          Submit Interview Scorecard
        </h4>

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-medium mb-1 block">Interview Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full h-8 px-2.5 rounded-md border bg-background text-xs"
            >
              <option value="Technical Interview">Technical Interview</option>
              <option value="System Design">System Design</option>
              <option value="Hiring Manager Chat">Hiring Manager Chat</option>
              <option value="Culture & Values">Culture & Values</option>
            </select>
          </div>

          <div>
            <label className="font-medium mb-1.5 block">Overall Recommendation</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'strong_hire', label: 'Strong Hire' },
                { key: 'hire', label: 'Hire' },
                { key: 'no_hire', label: 'No Hire' },
                { key: 'strong_no_hire', label: 'Strong No' },
              ].map((opt) => (
                <Button
                  key={opt.key}
                  type="button"
                  variant={recommendation === opt.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRecommendation(opt.key as any)}
                  className="h-8 text-xs"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Criteria Ratings */}
          <div className="space-y-2 pt-1">
            <label className="font-medium block">Stage Rubric Criteria</label>
            {DEFAULT_CRITERIA.map((criterion) => (
              <div key={criterion.id} className="flex items-center justify-between p-2 rounded bg-background border">
                <div>
                  <div className="font-medium">{criterion.name}</div>
                  <div className="text-[10px] text-muted-foreground">{criterion.description}</div>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setRatings(prev => ({ ...prev, [criterion.id]: score }))}
                      className={`w-6 h-6 rounded text-[11px] font-semibold transition-colors ${
                        (ratings[criterion.id] || 3) >= score
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="font-medium mb-1 block">Debrief Notes & Observations</label>
            <Textarea
              placeholder="Highlight technical depth, answers that stood out, or risks..."
              value={overallNotes}
              onChange={(e) => setOverallNotes(e.target.value)}
              className="text-xs min-h-[70px]"
            />
          </div>

          <Button
            onClick={handleSubmitScorecard}
            disabled={isSubmitting}
            className="w-full text-xs h-9"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            Submit Scorecard
          </Button>
        </div>
      </div>
    </div>
  )
}
