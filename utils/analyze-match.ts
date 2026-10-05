import apiClient from "../lib/api-client";

// Thin client wrappers: Gemini is called server-side only (see
// api/utils/gemini.ts) — the API key never reaches the browser.

export async function analyzeMatch(job: any, resume: any) {
  try {
    const results = (await apiClient.jobs.analyzeMatches(job, [resume])) as any[];
    return results?.[0] ?? null;
  } catch (error) {
    console.error("Error in match analysis:", error);
    return null;
  }
}

/**
 * Process a batch of resumes against a job description.
 * Chunks are sent to the server (5 per request) so each request stays well
 * within the server's request timeout.
 * @param jobData Job details
 * @param resumes Array of resume data
 * @returns Array of resumes with match analysis
 */
export const analyzeBatchMatches = async (jobData: any, resumes: any[]) => {
  try {
    const batchSize = 5;
    const results: any[] = [];

    for (let i = 0; i < resumes.length; i += batchSize) {
      const batch = resumes.slice(i, i + batchSize);
      try {
        const batchResults = (await apiClient.jobs.analyzeMatches(
          jobData,
          batch
        )) as any[];

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
