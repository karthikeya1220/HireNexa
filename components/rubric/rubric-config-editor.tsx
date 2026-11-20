"use client"

import React, { useState } from "react"
import { type CustomJobRubric, DEFAULT_JOB_RUBRIC } from "@/types/rubric"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sliders, RotateCcw, ShieldCheck, Sparkles } from "lucide-react"

interface RubricConfigEditorProps {
  rubric: CustomJobRubric
  onChange: (updated: CustomJobRubric) => void
}

export function RubricConfigEditor({ rubric, onChange }: RubricConfigEditorProps) {
  const currentRubric = rubric?.categories?.length ? rubric : DEFAULT_JOB_RUBRIC
  const totalWeight = currentRubric.categories.reduce((sum, c) => sum + (Number(c.weight) || 0), 0)

  const handleWeightChange = (key: string, value: number) => {
    const updated = {
      ...currentRubric,
      categories: currentRubric.categories.map((c) =>
        c.key === key ? { ...c, weight: Math.max(0, Math.min(100, value)) } : c
      ),
    }
    onChange(updated)
  }

  const handleResetDefault = () => {
    onChange(DEFAULT_JOB_RUBRIC)
  }

  return (
    <Card className="border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              AI Resume Screening Rubric & Weights
            </CardTitle>
            <CardDescription className="text-xs">
              Configure how the HackerRank evaluation model weighs candidate experience vs project code.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={totalWeight === 100 ? "default" : "destructive"}
              className="font-mono text-xs"
            >
              Total: {totalWeight}%
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDefault}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentRubric.categories.map((cat) => (
            <div
              key={cat.key}
              className="p-3 rounded-lg border bg-muted/20 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{cat.label}</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={cat.weight}
                    onChange={(e) => handleWeightChange(cat.key, parseInt(e.target.value) || 0)}
                    className="w-14 h-7 text-xs font-semibold text-right px-1"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                {cat.description}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>
            Scoring prompts automatically adapt category thresholds and citation extraction based on these percentage weights.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
