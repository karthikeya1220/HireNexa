"use client"

import { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import apiClient from '@/lib/api-client'
import { useAuth } from '@/context/auth-context'

interface FeedbackItem {
  company_name: string;
  feedback: string;
  created_at: string;
}

interface CompanyFeedbackProps {
  filename: string;
  filelink: string;
}

export function CompanyFeedback({ filename, filelink }: CompanyFeedbackProps) {
  const [companyName, setCompanyName] = useState("")
  const [newFeedback, setNewFeedback] = useState("")
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const { user } = useAuth()

  useEffect(() => {
    const fetchFeedbacks = async () => {
      if (!user) return;

      try {
        const data = await apiClient.resumes.getFeedback(filename)
        setFeedbacks((data as FeedbackItem[]) || [])
      } catch (error) {
        console.error("Error fetching feedbacks:", error);
      }
    };

    fetchFeedbacks();
  }, [user, filename]);

  const addFeedback = async () => {
    if (!user || !companyName.trim() || !newFeedback.trim()) return;

    try {
      const row = await apiClient.resumes.addFeedback({
        filename,
        filelink,
        company_name: companyName.trim(),
        feedback: newFeedback.trim(),
      })

      // Update local state
      setFeedbacks([...feedbacks, row as FeedbackItem])

      // Clear inputs
      setCompanyName("");
      setNewFeedback("");

      toast({
        title: "Success",
        description: "Feedback added successfully",
      });
    } catch (error) {
      console.error("Error adding feedback:", error);
      toast({
        title: "Error",
        description: "Failed to add feedback",
        variant: "destructive",
      });
    }
  };

  const formatDate = (createdAt: string) => {
    if (!createdAt) {
      return '';
    }
    const date = new Date(createdAt);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Company Feedback</h2>
        <div className="text-xs text-muted-foreground">
          {feedbacks.length} feedbacks
        </div>
      </div>

      {/* Feedback List */}
      <div className="max-h-[300px] overflow-y-auto space-y-4 pr-2">
        {feedbacks.map((feedback, index) => (
          <div 
            key={index} 
            className="p-4 rounded-lg bg-muted/50 relative group"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{feedback.company_name}</h3>
              <span className="text-xs text-muted-foreground">
                {formatDate(feedback.created_at)}
              </span>
            </div>
            <p className="text-sm">{feedback.feedback}</p>
          </div>
        ))}
      </div>

      {/* Add Feedback Form */}
      <div className="pt-4 border-t space-y-4">
        <Input
          placeholder="Company Name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="mb-2"
        />
        <Textarea
          placeholder="Add your feedback..."
          value={newFeedback}
          onChange={(e) => setNewFeedback(e.target.value)}
          className="mb-2 resize-none"
          rows={3}
        />
        <Button 
          onClick={addFeedback}
          className="w-full"
          disabled={!companyName.trim() || !newFeedback.trim()}
        >
          Add Feedback
        </Button>
      </div>
    </div>
  );
}
