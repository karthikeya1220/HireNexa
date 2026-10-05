"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { LifeBuoy, Upload, Briefcase, Search, ShieldCheck, AlertCircle, Users } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const steps = [
  {
    icon: Upload,
    title: "Upload resumes",
    description:
      "Drop PDF or DOCX resumes on the Upload Resume page. AI extracts skills, education and experience and stores a structured analysis.",
  },
  {
    icon: Briefcase,
    title: "Create jobs",
    description:
      "Post a role with required skills and experience from Job Management. Creators and assigned recruiters can then work its candidate pipeline.",
  },
  {
    icon: Search,
    title: "Run match analysis",
    description:
      "Open a job's candidates and run match analysis. Each resume is scored 0–100 with matching skills, gaps and a short assessment.",
  },
]

const faqs = [
  {
    icon: ShieldCheck,
    question: "Who can see my resumes?",
    answer:
      "Resumes are private to their owner — only you and administrators can read them. Job candidate lists are limited to the job's creator, recruiters assigned to that job, and admins.",
  },
  {
    icon: Users,
    question: "Why don't I see every job in the list?",
    answer:
      "Each person sees the jobs they created plus jobs assigned to them. Ask an administrator to assign you to a job if you need access to its pipeline.",
  },
  {
    icon: AlertCircle,
    question: "I hit a 'daily AI analysis limit' error",
    answer:
      "Every account has a per-day budget for AI resume and match analyses. The limit resets after 24 hours (it also resets if the server restarts).",
  },
  {
    icon: LifeBuoy,
    question: "Who do I contact for access or account issues?",
    answer:
      "Contact your workspace administrator — admins can grant roles (recruiter/admin), assign jobs and manage users from the Admin dashboard.",
  },
]

export default function HelpPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }, [isMobile])

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
        <div className="container mx-auto py-8 px-4 md:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Help &amp; Support</h1>
            <p className="text-muted-foreground">
              How HireNexa works and answers to common questions
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mb-10">
            {steps.map((step) => (
              <Card key={step.title}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{step.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {step.description}
                </CardContent>
              </Card>
            ))}
          </div>

          <h2 className="text-xl font-semibold mb-4">Common questions</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <Card key={faq.question}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <faq.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <CardTitle className="text-sm font-semibold">{faq.question}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{faq.answer}</CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-10 text-xs text-muted-foreground">
            Still stuck? Reach out to your workspace administrator for account, role and access
            requests.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
