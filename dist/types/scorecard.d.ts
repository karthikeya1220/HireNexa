export interface ScorecardCriterion {
    id: string;
    name: string;
    description: string;
    rating: number;
    notes?: string;
}
export interface InterviewScorecard {
    id: string;
    candidateFilename: string;
    jobId: string;
    stage: string;
    interviewerEmail: string;
    interviewerName: string;
    recommendation: 'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire';
    overallNotes: string;
    criteria: ScorecardCriterion[];
    createdAt: string;
}
export interface DebriefSynthesis {
    jobId: string;
    candidateFilename: string;
    consensusScore: number;
    recommendationDistribution: {
        strong_hire: number;
        hire: number;
        no_hire: number;
        strong_no_hire: number;
    };
    strengthsSummary: string[];
    divergencesAndConcerns: string[];
    suggestedDebriefQuestions: string[];
}
