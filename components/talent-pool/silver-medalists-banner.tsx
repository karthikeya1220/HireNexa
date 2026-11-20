"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import apiClient from "@/lib/api-client"
import { Sparkles, UserPlus, Star, ChevronDown, ChevronUp, Check, Loader2 } from "lucide-react"

interface SilverMedalist {
  id: string
  filename: string
  name: string
  email: string
  previousStatus: string
  affinityScore: number
  overlappingSkills: string[]
  matchAnalysis?: {
    matchPercentage?: number
  }
}

interface SilverMedalistsBannerProps {
  jobId: string
  onCandidateReengaged?: () => void
}

export function SilverMedalistsBanner({ jobId, onCandidateReengaged }: SilverMedalistsBannerProps) {
  const [medalists, setMedalists] = useState<SilverMedalist[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reengagingId, setReengagingId] = useState<string | null>(null)
  const [reengagedSet, setReengagedSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!jobId) return
    const fetchMedalists = async () => {
      try {
        setLoading(true)
        const res = await (apiClient as any).get(`/jobs/${jobId}/silver-medalists`)
        if (Array.isArray(res)) {
          setMedalists(res)
        }
      } catch (err) {
        console.warn("Could not fetch silver medalists:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchMedalists()
  }, [jobId])

  const handleReengage = async (m: SilverMedalist) => {
    try {
      setReengagingId(m.id)
      await (apiClient as any).post(`/jobs/${jobId}/reengage`, {
        filename: m.filename,
        candidateName: m.name,
        candidateEmail: m.email,
      })
      toast.success(`Re-engaged ${m.name} into this job pipeline`)
      setReengagedSet(prev => new Set(prev).add(m.id))
      onCandidateReengaged?.()
    } catch (err: any) {
      toast.error(err.message || "Failed to re-engage candidate")
    } finally {
      setReengagingId(null)
    }
  }

  if (loading || medalists.length === 0) return null

  return (
    <Card className="border-amber-500/30 bg-amber-500/5 mb-6 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Star className="w-4 h-4 fill-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                {medalists.length} Silver Medalist{medalists.length !== 1 ? "s" : ""} Found in Past Talent Pool
                <Badge variant="outline" className="text-[10px] bg-background border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono">
                  High Re-engagement Affinity
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Candidates from other requisitions who reached advanced interview stages and match this role's tech stack.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(prev => !prev)}
            className="text-xs h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <>
                Hide <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                View Candidates ({medalists.length}) <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>

        {isExpanded && (
          <div className="pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {medalists.map((m) => {
              const isReengaged = reengagedSet.has(m.id)
              const isLoading = reengagingId === m.id

              return (
                <div
                  key={m.id}
                  className="bg-card border rounded-lg p-3 space-y-2 text-xs flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground truncate max-w-[150px]">{m.name}</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {m.affinityScore}% Fit
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Previous stage: <span className="font-medium capitalize text-foreground">{m.previousStatus.replace('_', ' ')}</span>
                    </div>
                    {m.overlappingSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {m.overlappingSkills.slice(0, 3).map((s, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant={isReengaged ? "outline" : "default"}
                    disabled={isReengaged || isLoading}
                    onClick={() => handleReengage(m)}
                    className="w-full h-7 text-[11px] gap-1 mt-2"
                  >
                    {isReengaged ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        Re-engaged
                      </>
                    ) : isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3" />
                        1-Click Re-engage
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
