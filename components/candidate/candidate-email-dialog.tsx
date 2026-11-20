"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import apiClient from "@/lib/api-client"
import { Mail, Sparkles, Send, Loader2, Calendar, CheckCircle2 } from "lucide-react"

interface CandidateEmailDialogProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  candidateFilename: string
  candidateName: string
  candidateEmail: string
  jobTitle: string
  companyName: string
}

export function CandidateEmailDialog({
  isOpen,
  onClose,
  jobId,
  candidateFilename,
  candidateName,
  candidateEmail,
  jobTitle,
  companyName,
}: CandidateEmailDialogProps) {
  const [emailType, setEmailType] = useState<'interview_invitation' | 'rejection' | 'offer'>('interview_invitation')
  const [bookingLink, setBookingLink] = useState('https://cal.com/hirenexa/30min')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isDrafting, setIsDrafting] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const handleGenerateDraft = async () => {
    try {
      setIsDrafting(true)
      const res = await (apiClient as any).post('/jobs/email/draft', {
        candidateName,
        type: emailType,
        jobTitle,
        companyName,
        bookingLink,
      })
      if (res?.subject && res?.body) {
        setSubject(res.subject)
        setBody(res.body)
        toast.success("AI draft generated")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate email draft")
    } finally {
      setIsDrafting(false)
    }
  }

  const handleSendEmail = async () => {
    if (!subject || !body) {
      toast.error("Subject and email body cannot be empty")
      return
    }
    try {
      setIsSending(true)
      await (apiClient as any).post(`/jobs/${jobId}/candidates/${candidateFilename}/email`, {
        subject,
        body,
        recipientEmail: candidateEmail,
        type: emailType,
      })
      toast.success(`Email dispatched to ${candidateEmail}`)
      onClose()
    } catch (err: any) {
      toast.error(err.message || "Failed to send email")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5 text-primary" />
            Send Email to {candidateName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Generate AI-tailored candidate communications with booking links and delivery logging.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Template Selector */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {[
                { type: 'interview_invitation', label: 'Interview Invitation' },
                { type: 'rejection', label: 'Polite Rejection' },
                { type: 'offer', label: 'Job Offer' },
              ].map((opt) => (
                <Button
                  key={opt.type}
                  type="button"
                  variant={emailType === opt.type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEmailType(opt.type as any)}
                  className="h-7 text-xs"
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGenerateDraft}
              disabled={isDrafting}
              className="h-7 text-xs gap-1 text-primary font-medium"
            >
              {isDrafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-primary" />}
              Draft with AI
            </Button>
          </div>

          {emailType === 'interview_invitation' && (
            <div className="space-y-1">
              <label className="text-muted-foreground font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Scheduling URL (Calendly / Cal.com):
              </label>
              <Input
                value={bookingLink}
                onChange={(e) => setBookingLink(e.target.value)}
                placeholder="https://cal.com/your-team"
                className="h-8 text-xs font-mono"
              />
            </div>
          )}

          {/* Subject Line */}
          <div className="space-y-1">
            <label className="text-muted-foreground font-medium">Subject Line:</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Next steps regarding your application at HireNexa"
              className="h-8 text-xs font-medium"
            />
          </div>

          {/* Email Body */}
          <div className="space-y-1">
            <label className="text-muted-foreground font-medium">Message Body:</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Click 'Draft with AI' to generate a polished email..."
              className="text-xs min-h-[160px] leading-relaxed font-sans"
            />
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between items-center pt-2">
          <span className="text-[11px] text-muted-foreground">
            Recipient: <span className="font-medium text-foreground">{candidateEmail}</span>
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSendEmail}
              disabled={isSending || !subject || !body}
              className="h-8 text-xs gap-1.5"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send Email
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
