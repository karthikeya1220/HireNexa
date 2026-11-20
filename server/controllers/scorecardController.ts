import { Request, Response } from 'express';
import { supabaseAdmin } from '../db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { type InterviewScorecard, type DebriefSynthesis } from '../../types/scorecard';

interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    role?: string;
    [key: string]: unknown;
  };
}

// In-memory / JSONB store backup for scorecards attached to job_candidates
export const addScorecard = async (req: AuthRequest, res: Response) => {
  try {
    const { jobId, candidateFilename } = req.params;
    const userEmail = req.user?.email || 'interviewer@hirenexa.internal';
    const userName = req.user?.name || userEmail.split('@')[0];
    const { stage, recommendation, overallNotes, criteria } = req.body;

    if (!stage || !recommendation) {
      return res.status(400).json({ error: 'Stage and recommendation are required' });
    }

    const newScorecard: InterviewScorecard = {
      id: `sc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      candidateFilename,
      jobId,
      stage,
      interviewerEmail: userEmail,
      interviewerName: userName,
      recommendation,
      overallNotes: overallNotes || '',
      criteria: Array.isArray(criteria) ? criteria : [],
      createdAt: new Date().toISOString(),
    };

    // Fetch existing tracking data to store scorecards inside tracking.scorecards
    const { data: candidate, error: fetchErr } = await supabaseAdmin
      .from('job_candidates')
      .select('tracking')
      .eq('job_id', jobId)
      .eq('filename', candidateFilename)
      .single();

    if (fetchErr) {
      return res.status(404).json({ error: 'Candidate record not found for this job' });
    }

    const existingTracking = candidate?.tracking || {};
    const existingScorecards: InterviewScorecard[] = Array.isArray(existingTracking.scorecards)
      ? existingTracking.scorecards
      : [];

    const updatedScorecards = [newScorecard, ...existingScorecards];

    const { error: updateErr } = await supabaseAdmin
      .from('job_candidates')
      .update({
        tracking: {
          ...existingTracking,
          scorecards: updatedScorecards,
          lastUpdated: new Date().toISOString(),
        },
      })
      .eq('job_id', jobId)
      .eq('filename', candidateFilename);

    if (updateErr) throw updateErr;

    res.status(201).json(newScorecard);
  } catch (error: any) {
    console.error('Error adding scorecard:', error);
    res.status(500).json({ error: error.message || 'Failed to submit scorecard' });
  }
};

export const getScorecards = async (req: AuthRequest, res: Response) => {
  try {
    const { jobId, candidateFilename } = req.params;

    const { data: candidate, error } = await supabaseAdmin
      .from('job_candidates')
      .select('tracking')
      .eq('job_id', jobId)
      .eq('filename', candidateFilename)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const scorecards: InterviewScorecard[] = Array.isArray(candidate?.tracking?.scorecards)
      ? candidate.tracking.scorecards
      : [];

    res.status(200).json(scorecards);
  } catch (error: any) {
    console.error('Error fetching scorecards:', error);
    res.status(500).json({ error: 'Failed to fetch scorecards' });
  }
};

// Synthesize debrief summary using Gemini
export const generateDebriefSynthesis = async (req: AuthRequest, res: Response) => {
  try {
    const { jobId, candidateFilename } = req.params;

    const { data: candidate, error } = await supabaseAdmin
      .from('job_candidates')
      .select('name, tracking, match_analysis')
      .eq('job_id', jobId)
      .eq('filename', candidateFilename)
      .single();

    if (error || !candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const scorecards: InterviewScorecard[] = Array.isArray(candidate?.tracking?.scorecards)
      ? candidate.tracking.scorecards
      : [];

    if (scorecards.length === 0) {
      return res.status(400).json({ error: 'At least one scorecard is required to synthesize a debrief' });
    }

    const dist = {
      strong_hire: 0,
      hire: 0,
      no_hire: 0,
      strong_no_hire: 0,
    };

    scorecards.forEach((sc) => {
      if (sc.recommendation in dist) {
        dist[sc.recommendation as keyof typeof dist]++;
      }
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are an executive talent debrief facilitator.
Synthesize the interview panel's feedback for candidate: ${candidate.name}

Scorecards Submitted:
${JSON.stringify(scorecards, null, 2)}

Provide an objective synthesis highlighting consensus strengths, points of divergence (disagreements between interviewers), and suggested debrief questions.

Respond in exact JSON format:
{
  "consensusScore": <number 0-100 indicating panel alignment>,
  "strengthsSummary": ["strength 1 with interviewer attribution", "strength 2"],
  "divergencesAndConcerns": ["point of divergence or gap observed across scorecards"],
  "suggestedDebriefQuestions": ["pointed question for the hiring team debrief meeting"]
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] || text.match(/\{[\s\S]*\}/)?.[0] || text;
    const parsed = JSON.parse(cleanJson);

    const synthesis: DebriefSynthesis = {
      jobId,
      candidateFilename,
      consensusScore: parsed.consensusScore || 75,
      recommendationDistribution: dist,
      strengthsSummary: parsed.strengthsSummary || [],
      divergencesAndConcerns: parsed.divergencesAndConcerns || [],
      suggestedDebriefQuestions: parsed.suggestedDebriefQuestions || [],
    };

    res.status(200).json(synthesis);
  } catch (error: any) {
    console.error('Error generating debrief synthesis:', error);
    res.status(500).json({ error: error.message || 'Failed to synthesize debrief' });
  }
};
