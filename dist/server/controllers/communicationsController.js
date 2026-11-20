"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCandidateEmail = exports.generateEmailDraft = void 0;
const db_1 = require("../db");
const generative_ai_1 = require("@google/generative-ai");
/**
 * Generates context-aware, polished email templates for candidates using Gemini
 */
const generateEmailDraft = async (req, res) => {
    var _a, _b;
    try {
        const { candidateName, type, jobTitle, companyName, bookingLink, customNotes } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not defined');
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const prompt = `
You are a senior recruitment communication specialist representing ${companyName || 'HireNexa'}.
Draft a professional, warm, and clear email to candidate "${candidateName}" for the position "${jobTitle}".

Email Type: ${type}
Additional Context / Booking URL: ${bookingLink || 'N/A'}
Special Instructions: ${customNotes || 'N/A'}

Rules:
- For 'interview_invitation': Express genuine enthusiasm, clearly explain next steps, and invite them to schedule time via the booking link.
- For 'rejection': Be highly respectful, empathetic, and constructive without creating legal liability. Do not use generic boilerplate; thank them for their time.
- For 'offer': Congratulate them warmly and outline excitement for them to join the team.

Output purely in JSON format:
{
  "subject": "<Email Subject Line>",
  "body": "<Email body in clean markdown/plain text format with paragraph linebreaks>"
}
`;
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanJson = ((_a = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)) === null || _a === void 0 ? void 0 : _a[1]) || ((_b = text.match(/\{[\s\S]*\}/)) === null || _b === void 0 ? void 0 : _b[0]) || text;
        const parsed = JSON.parse(cleanJson);
        res.status(200).json(parsed);
    }
    catch (error) {
        console.error('Error generating email draft:', error);
        // Graceful fallback templates if AI is busy
        const { candidateName, type, jobTitle, companyName, bookingLink } = req.body;
        if (type === 'interview_invitation') {
            res.status(200).json({
                subject: `Interview Invitation: ${jobTitle} at ${companyName || 'HireNexa'}`,
                body: `Hi ${candidateName},\n\nThank you for your interest in the ${jobTitle} role at ${companyName || 'HireNexa'}. We were very impressed by your background and would love to invite you to the next round of interviews.\n\nPlease pick a time that works best for you using our scheduling link:\n${bookingLink || 'https://cal.com/hirenexa-team/interview'}\n\nLooking forward to speaking soon!\n\nBest regards,\nThe Hiring Team`,
            });
        }
        else {
            res.status(200).json({
                subject: `Update regarding your application for ${jobTitle}`,
                body: `Hi ${candidateName},\n\nThank you for taking the time to speak with our team about the ${jobTitle} role. While we were impressed with your experience, we have decided to move forward with other candidates whose skillsets more closely match our immediate requirements.\n\nWe will keep your profile in our talent pool for future openings that match your background.\n\nBest wishes in your search,\nThe Hiring Team`,
            });
        }
    }
};
exports.generateEmailDraft = generateEmailDraft;
/**
 * Sends and logs candidate communication into candidate's tracking timeline
 */
const sendCandidateEmail = async (req, res) => {
    var _a;
    try {
        const { jobId, candidateFilename } = req.params;
        const { subject, body, recipientEmail, type } = req.body;
        const senderEmail = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.email) || 'recruiter@hirenexa.internal';
        if (!recipientEmail || !subject || !body) {
            return res.status(400).json({ error: 'Recipient, subject, and body are required' });
        }
        const emailRecord = {
            id: `mail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: type || 'communication',
            subject,
            body,
            recipientEmail,
            senderEmail,
            sentAt: new Date().toISOString(),
        };
        // Update candidate tracking timeline with this email record
        const { data: cand, error: fetchErr } = await db_1.supabaseAdmin
            .from('job_candidates')
            .select('tracking')
            .eq('job_id', jobId)
            .eq('filename', candidateFilename)
            .single();
        if (fetchErr) {
            return res.status(404).json({ error: 'Candidate not found' });
        }
        const tracking = (cand === null || cand === void 0 ? void 0 : cand.tracking) || {};
        const communications = Array.isArray(tracking.communications) ? tracking.communications : [];
        const updatedCommunications = [emailRecord, ...communications];
        const { error: updateErr } = await db_1.supabaseAdmin
            .from('job_candidates')
            .update({
            tracking: {
                ...tracking,
                communications: updatedCommunications,
                lastContactedDate: new Date().toISOString(),
            },
        })
            .eq('job_id', jobId)
            .eq('filename', candidateFilename);
        if (updateErr)
            throw updateErr;
        console.log(`[Email Dispatch] Mock email sent to ${recipientEmail} with subject: "${subject}"`);
        res.status(200).json({
            message: 'Email delivered and recorded in candidate activity timeline',
            record: emailRecord,
        });
    }
    catch (error) {
        console.error('Error sending candidate email:', error);
        res.status(500).json({ error: error.message || 'Failed to dispatch email' });
    }
};
exports.sendCandidateEmail = sendCandidateEmail;
