"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reengageCandidate = exports.getSilverMedalists = void 0;
const db_1 = require("../db");
/**
 * Finds high-affinity past candidates ("Silver Medalists") across all previous jobs
 * who reached advanced stages (interviewed, rate confirmed, approved, or shortlisted)
 * and have matching skill overlap with the current target job.
 */
const getSilverMedalists = async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!(0, db_1.isUuid)(jobId)) {
            return res.status(400).json({ error: 'Invalid Job ID' });
        }
        // 1. Fetch current job requirements
        const { data: targetJob, error: jobErr } = await db_1.supabaseAdmin
            .from('jobs')
            .select('id, title, skills_required, requirements')
            .eq('id', jobId)
            .single();
        if (jobErr || !targetJob) {
            return res.status(404).json({ error: 'Target job not found' });
        }
        const targetSkills = (targetJob.skills_required || []).map((s) => s.toLowerCase());
        // 2. Fetch all candidates from OTHER jobs who reached high-intent stages
        const { data: candidates, error: candErr } = await db_1.supabaseAdmin
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
            var _a, _b;
            const status = (_a = cand.tracking) === null || _a === void 0 ? void 0 : _a.status;
            const prevMatch = ((_b = cand.match_analysis) === null || _b === void 0 ? void 0 : _b.matchPercentage) || 0;
            const isQualifiedStage = ['shortlisted', 'interview_scheduled', 'rate_confirmed', 'approved', 'interested'].includes(status);
            return isQualifiedStage || prevMatch >= 75;
        });
        // 4. Calculate skill affinity against target job
        const enrichedMedalists = qualifiedPastCandidates.map((cand) => {
            var _a, _b, _c;
            const candSkills = (((_a = cand.analysis) === null || _a === void 0 ? void 0 : _a.key_skills) || []).map((s) => s.toLowerCase());
            const overlappingSkills = targetSkills.filter((ts) => candSkills.some((cs) => cs.includes(ts) || ts.includes(cs)));
            const affinityScore = targetSkills.length > 0
                ? Math.round((overlappingSkills.length / targetSkills.length) * 100)
                : ((_b = cand.match_analysis) === null || _b === void 0 ? void 0 : _b.matchPercentage) || 70;
            return {
                id: cand.id,
                filename: cand.filename,
                name: cand.name,
                email: cand.email,
                sourceJobId: cand.job_id,
                previousStatus: ((_c = cand.tracking) === null || _c === void 0 ? void 0 : _c.status) || 'shortlisted',
                affinityScore: Math.min(100, Math.max(affinityScore, 65)),
                overlappingSkills,
                analysis: cand.analysis,
                matchAnalysis: cand.match_analysis,
            };
        })
            .sort((a, b) => b.affinityScore - a.affinityScore)
            .slice(0, 10);
        res.status(200).json(enrichedMedalists);
    }
    catch (error) {
        console.error('Error fetching silver medalists:', error);
        res.status(500).json({ error: error.message || 'Failed to find silver medalists' });
    }
};
exports.getSilverMedalists = getSilverMedalists;
/**
 * 1-Click clone candidate from previous talent pool into current job requisition
 */
const reengageCandidate = async (req, res) => {
    var _a, _b;
    try {
        const { jobId } = req.params;
        const { filename, candidateName, candidateEmail } = req.body;
        const userEmail = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.email) || 'recruiter@hirenexa.internal';
        if (!(0, db_1.isUuid)(jobId) || !filename) {
            return res.status(400).json({ error: 'Job ID and candidate filename are required' });
        }
        // Find the source candidate record
        const { data: source, error: sourceErr } = await db_1.supabaseAdmin
            .from('job_candidates')
            .select('*')
            .eq('filename', filename)
            .limit(1)
            .single();
        if (sourceErr || !source) {
            return res.status(404).json({ error: 'Source candidate profile not found' });
        }
        // Check if already in target job
        const { data: existing } = await db_1.supabaseAdmin
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
            user_id: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.uid) || null,
            user_email: userEmail,
        };
        const { data: inserted, error: insertErr } = await db_1.supabaseAdmin
            .from('job_candidates')
            .insert(cloneData)
            .select('*')
            .single();
        if (insertErr)
            throw insertErr;
        res.status(201).json({
            message: 'Candidate re-engaged into active pipeline',
            candidate: inserted,
        });
    }
    catch (error) {
        console.error('Error re-engaging candidate:', error);
        res.status(500).json({ error: error.message || 'Failed to re-engage candidate' });
    }
};
exports.reengageCandidate = reengageCandidate;
