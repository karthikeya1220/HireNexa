import apiClient from "../lib/api-client";

// Thin client wrappers: Gemini is called server-side only (see
// server/utils/gemini.ts) — the API key never reaches the browser.

export interface RubricCategoryScore {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  evidence: string;
}

export interface RubricBonus {
  key: string;
  label: string;
  points: number;
  reason: string;
}

export interface GitHubRepoSummary {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  url: string;
  updatedAt: string;
}

export interface GitHubProfileData {
  username: string;
  name: string | null;
  bio: string | null;
  publicReposCount: number;
  followers: number;
  avatarUrl: string;
  topLanguages: string[];
  featuredRepos: GitHubRepoSummary[];
  profileUrl: string;
}

export interface MatchAnalysis {
  filename: string;
  matchPercentage: number;
  matchingSkills: string[];
  missingRequirements: string[];
  experienceMatch: boolean;
  educationMatch: boolean;
  overallAssessment?: string;
  categoryBreakdown?: RubricCategoryScore[];
  bonuses?: RubricBonus[];
  flagsOrGaps?: string[];
  githubEnrichment?: GitHubProfileData | null;
}

/**
 * Process a batch of resumes against a job description.
 * Chunks are sent to the server (5 per request) so each request stays well
 * within the server's request timeout.
 * @param jobData Job details
 * @param resumes Array of resume data
 * @returns Array of resumes with match analysis
 */
export const analyzeBatchMatches = async (
  jobData: unknown,
  resumes: unknown[]
): Promise<MatchAnalysis[]> => {
  try {
    const batchSize = 5;
    const results: MatchAnalysis[] = [];

    for (let i = 0; i < resumes.length; i += batchSize) {
      const batch = resumes.slice(i, i + batchSize);
      try {
        const batchResults = (await apiClient.jobs.analyzeMatches(
          jobData,
          batch
        )) as MatchAnalysis[];

        if (Array.isArray(batchResults)) {
          results.push(...batchResults);
        }
      } catch (batchError) {
        console.error("Error processing batch:", batchError);
        // Continue with next batch instead of failing the entire process
      }
    }

    return results;
  } catch (error) {
    console.error("Error in batch match analysis:", error);
    return [];
  }
};
