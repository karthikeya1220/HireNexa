import { Request, Response } from 'express';
import { supabaseAdmin, isUuid } from '../db';

interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    role?: string;
    [key: string]: unknown;
  };
}

/**
 * Finds high-affinity past candidates ("Silver Medalists") across all previous jobs
 * who reached advanced stages (interviewed, rate confirmed, approved, or shortlisted)
 * and have matching skill overlap with the current target job.
 */
export const getSilverMedalists = async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!isUuid(jobId)) {
      return res.status(400).json({ error: 'Invalid Job ID' });
    }

    // 1. Fetch current job requirements
    const { data: targetJob, error: jobErr } = await supabaseAdmin
      .from('jobs')
      .select('id, title, skills_required, requirements')
      .eq('id', jobId)
      .single();

    if (jobErr || !targetJob) {
      return res.status(404).json({ error: 'Target job not found' });
    }

    const targetSkills = (targetJob.skills_required || []).map((s: string) => s.toLowerCase());

    // 2. Fetch all candidates from OTHER jobs who reached high-intent stages
    const { data: candidates, error: candErr } = await supabaseAdmin
      .from('job_candidates')
      .select('id, job_id, filename, name, email, match_analysis, analysis, tracking, created_at')
      .neq('job_id', jobId)
      .limit(100);

    if (candErr) {
      throw candErr;
    }

    // 3. Filter candidates who were silver medalists:
    // Either reached shortlisted, interview_scheduled, rate_confirmed, or have match >= 75%
    const qualifiedPastCandidates = (candidates || []).filter((cand) => {
      const status = cand.tracking?.status;
      const prevMatch = cand.match_analysis?.matchPercentage || 0;
      const isQualifiedStage = ['shortlisted', 'interview_scheduled', 'rate_confirmed', 'approved', 'interested'].includes(status);
      return isQualifiedStage || prevMatch >= 75;
    });

    // 4. Calculate skill affinity against target job
    const enrichedMedalists = qualifiedPastCandidates.map((cand) => {
      const candSkills = (cand.analysis?.key_skills || []).map((s: string) => s.toLowerCase());
      const overlappingSkills = targetSkills.filter((ts: string) =>
        candSkills.some((cs: string) => cs.includes(ts) || ts.includes(cs))
      );

      const affinityScore = targetSkills.length > 0
        ? Math.round((overlappingSkills.length / targetSkills.length) * 100)
        : cand.match_analysis?.matchPercentage || 70;

      return {
        id: cand.id,
        filename: cand.filename,
        name: cand.name,
        email: cand.email,
        sourceJobId: cand.job_id,
        previousStatus: cand.tracking?.status || 'shortlisted',
        affinityScore: Math.min(100, Math.max(affinityScore, 65)),
        overlappingSkills,
        analysis: cand.analysis,
        matchAnalysis: cand.match_analysis,
      };
    })
    .sort((a, b) => b.affinityScore - a.affinityScore)
    .slice(0, 10);

    res.status(200).json(enrichedMedalists);
  } catch (error: any) {
    console.error('Error fetching silver medalists:', error);
    res.status(500).json({ error: error.message || 'Failed to find silver medalists' });
  }
};

/**
 * 1-Click clone candidate from previous talent pool into current job requisition
 */
export const reengageCandidate = async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const { filename, candidateName, candidateEmail } = req.body;
    const userEmail = req.user?.email || 'recruiter@hirenexa.internal';

    if (!isUuid(jobId) || !filename) {
      return res.status(400).json({ error: 'Job ID and candidate filename are required' });
    }

    // Find the source candidate record
    const { data: source, error: sourceErr } = await supabaseAdmin
      .from('job_candidates')
      .select('*')
      .eq('filename', filename)
      .limit(1)
      .single();

    if (sourceErr || !source) {
      return res.status(404).json({ error: 'Source candidate profile not found' });
    }

    // Check if already in target job
    const { data: existing } = await supabaseAdmin
      .from('job_candidates')
      .select('id')
      .eq('job_id', jobId)
      .eq('filename', filename)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Candidate is already in this job pipeline' });
    }

    // Insert clone into target job
    const cloneData = {
      job_id: jobId,
      filename,
      name: candidateName || source.name,
      email: candidateEmail || source.email,
      match_analysis: {
        ...source.match_analysis,
        overallAssessment: `Re-engaged silver medalist from previous talent pool.`,
      },
      analysis: source.analysis,
      tracking: {
        status: 'shortlisted',
        reengagedAt: new Date().toISOString(),
        reengagedBy: userEmail,
        source: 'Silver Medalist Talent Pool',
      },
      user_id: req.user?.uid || null,
      user_email: userEmail,
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('job_candidates')
      .insert(cloneData)
      .select('*')
      .single();

    if (insertErr) throw insertErr;

    res.status(201).json({
      message: 'Candidate re-engaged into active pipeline',
      candidate: inserted,
    });
  } catch (error: any) {
    console.error('Error re-engaging candidate:', error);
    res.status(500).json({ error: error.message || 'Failed to re-engage candidate' });
  }
};
