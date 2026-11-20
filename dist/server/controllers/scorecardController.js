"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDebriefSynthesis = exports.getScorecards = exports.addScorecard = void 0;
const db_1 = require("../db");
const generative_ai_1 = require("@google/generative-ai");
// In-memory / JSONB store backup for scorecards attached to job_candidates
const addScorecard = async (req, res) => {
    var _a, _b;
    try {
        const { jobId, candidateFilename } = req.params;
        const userEmail = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.email) || 'interviewer@hirenexa.internal';
        const userName = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.name) || userEmail.split('@')[0];
        const { stage, recommendation, overallNotes, criteria } = req.body;
        if (!stage || !recommendation) {
            return res.status(400).json({ error: 'Stage and recommendation are required' });
        }
        const newScorecard = {
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
        const { data: candidate, error: fetchErr } = await db_1.supabaseAdmin
            .from('job_candidates')
            .select('tracking')
            .eq('job_id', jobId)
            .eq('filename', candidateFilename)
            .single();
        if (fetchErr) {
            return res.status(404).json({ error: 'Candidate record not found for this job' });
        }
        const existingTracking = (candidate === null || candidate === void 0 ? void 0 : candidate.tracking) || {};
        const existingScorecards = Array.isArray(existingTracking.scorecards)
            ? existingTracking.scorecards
            : [];
        const updatedScorecards = [newScorecard, ...existingScorecards];
        const { error: updateErr } = await db_1.supabaseAdmin
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
        if (updateErr)
            throw updateErr;
        res.status(201).json(newScorecard);
    }
    catch (error) {
        console.error('Error adding scorecard:', error);
        res.status(500).json({ error: error.message || 'Failed to submit scorecard' });
    }
};
exports.addScorecard = addScorecard;
const getScorecards = async (req, res) => {
    var _a;
    try {
        const { jobId, candidateFilename } = req.params;
        const { data: candidate, error } = await db_1.supabaseAdmin
            .from('job_candidates')
            .select('tracking')
            .eq('job_id', jobId)
            .eq('filename', candidateFilename)
            .single();
        if (error) {
            return res.status(404).json({ error: 'Candidate not found' });
        }
        const scorecards = Array.isArray((_a = candidate === null || candidate === void 0 ? void 0 : candidate.tracking) === null || _a === void 0 ? void 0 : _a.scorecards)
            ? candidate.tracking.scorecards
            : [];
        res.status(200).json(scorecards);
    }
    catch (error) {
        console.error('Error fetching scorecards:', error);
        res.status(500).json({ error: 'Failed to fetch scorecards' });
    }
};
exports.getScorecards = getScorecards;
// Synthesize debrief summary using Gemini
const generateDebriefSynthesis = async (req, res) => {
    var _a, _b, _c;
    try {
        const { jobId, candidateFilename } = req.params;
        const { data: candidate, error } = await db_1.supabaseAdmin
            .from('job_candidates')
            .select('name, tracking, match_analysis')
            .eq('job_id', jobId)
            .eq('filename', candidateFilename)
            .single();
        if (error || !candidate) {
            return res.status(404).json({ error: 'Candidate not found' });
        }
        const scorecards = Array.isArray((_a = candidate === null || candidate === void 0 ? void 0 : candidate.tracking) === null || _a === void 0 ? void 0 : _a.scorecards)
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
                dist[sc.recommendation]++;
            }
        });
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not defined');
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
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
        const cleanJson = ((_b = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)) === null || _b === void 0 ? void 0 : _b[1]) || ((_c = text.match(/\{[\s\S]*\}/)) === null || _c === void 0 ? void 0 : _c[0]) || text;
        const parsed = JSON.parse(cleanJson);
        const synthesis = {
            jobId,
            candidateFilename,
            consensusScore: parsed.consensusScore || 75,
            recommendationDistribution: dist,
            strengthsSummary: parsed.strengthsSummary || [],
            divergencesAndConcerns: parsed.divergencesAndConcerns || [],
            suggestedDebriefQuestions: parsed.suggestedDebriefQuestions || [],
        };
        res.status(200).json(synthesis);
    }
    catch (error) {
        console.error('Error generating debrief synthesis:', error);
        res.status(500).json({ error: error.message || 'Failed to synthesize debrief' });
    }
};
exports.generateDebriefSynthesis = generateDebriefSynthesis;
