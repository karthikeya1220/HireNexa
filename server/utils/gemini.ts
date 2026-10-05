import { GoogleGenerativeAI } from '@google/generative-ai';

// Server-only Gemini access — the API key never reaches the browser.
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('Please define the GEMINI_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(apiKey);

// Shape of the JSON Gemini returns for a resume (extra fields preserved).
export type ResumeAnalysis = {
  name?: string;
  Name?: string;
  phone_number?: string;
  email?: string;
  key_skills?: string[];
  skills?: string[];
  education_details?: unknown[];
  work_experience_details?: unknown[];
  [key: string]: unknown;
};

// Shape of a match-analysis result. `filename` is attached by the batch
// processor so callers can map results back to source resumes.
export type MatchAnalysis = {
  matchPercentage?: number;
  matchingSkills?: string[];
  missingRequirements?: string[];
  experienceMatch?: boolean;
  educationMatch?: boolean;
  overallAssessment?: string;
  filename?: string;
};

type ResumeLike = { filename?: string } & Record<string, unknown>;

// Extract the first JSON object from a model response (handles ```json fences).
const extractJson = (text: string): string | null => {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  const bare = text.match(/\{[\s\S]*\}/);
  if (bare) return bare[0].trim();
  return null;
};

// Analyze a resume file buffer and return the parsed candidate details.
export const analyzeResumeBuffer = async (
  fileBuffer: Buffer,
  mimeType: string = 'application/pdf'
): Promise<ResumeAnalysis> => {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: {
      temperature: 0.7,
      topP: 1,
      topK: 1,
      maxOutputTokens: 2048,
    },
  });

  const prompt = `You are an experienced IT recruitment specialist. Carefully analyze the attached resume and extract the following candidate's details:
    - Name
    - Phone number
    - Email
    - Social profile links
    - Education details
    - Work experience details
    - Key skills (Return as a single flat array without subcategories)
    - Project experience
    - Profile summary (Give a brief analysis of the candidate's profile)

    Ensure the output is in valid JSON format with no additional formatting, markdown, or code block syntax.`;

  let responseText: string;
  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: fileBuffer.toString('base64'),
              },
            },
          ],
        },
      ],
    });
    responseText = result.response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to analyze resume with AI model');
  }

  const cleanResponse = responseText
    .replace(/```json\n?/, '')
    .replace(/```\n?$/, '')
    .trim();

  let analysisJson: ResumeAnalysis;
  try {
    analysisJson = JSON.parse(cleanResponse);
  } catch (parseError) {
    console.error('Error parsing JSON response:', parseError);
    throw new Error('Invalid JSON response from AI model');
  }

  // Validate that the response contains essential resume fields
  const isValidResume =
    analysisJson &&
    typeof analysisJson === 'object' &&
    (analysisJson.name || analysisJson.Name) &&
    ((analysisJson.key_skills &&
      Array.isArray(analysisJson.key_skills) &&
      analysisJson.key_skills.length > 0) ||
      (analysisJson.skills &&
        Array.isArray(analysisJson.skills) &&
        analysisJson.skills.length > 0));

  if (!isValidResume) {
    console.error('Invalid resume data from AI model:', analysisJson);
    throw new Error('The uploaded file does not appear to be a valid resume');
  }

  return analysisJson;
};

// Score a single resume against a job. Returns null on failure (parity with
// the previous client-side implementation, which never threw).
export const analyzeMatch = async (job: unknown, resume: unknown): Promise<MatchAnalysis | null> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const prompt = `
      # Job Description and Resume Matching Analysis
      
      ## Job Details:
      ${JSON.stringify(job, null, 2)}
      
      ## Resume:
      ${JSON.stringify(resume, null, 2)}
      
      ## Task:
      Analyze how well this resume matches the job description. Provide:
      1. Match percentage (number between 0-100)
      2. List of matching skills found in both job and resume
      3. List of required skills/qualifications missing in the resume
      4. Whether the candidate's experience level matches requirements (true/false)
      5. Whether the candidate's education matches requirements (true/false)
      6. A brief overall assessment of the candidate's fit
      
      ## Output Format (JSON):
      {
        "matchPercentage": 85,
        "matchingSkills": ["skill1", "skill2"],
        "missingRequirements": ["req1", "req2"],
        "experienceMatch": true,
        "educationMatch": true,
        "overallAssessment": "This candidate is a strong match because..."
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonStr = extractJson(text);
    if (jsonStr) {
      return JSON.parse(jsonStr);
    }
    try {
      return JSON.parse(text);
    } catch {
      console.error('Failed to parse JSON response:', text);
      return null;
    }
  } catch (error) {
    console.error('Error in match analysis:', error);
    return null;
  }
};

// Process a batch of resumes against a job description, in batches of 5 to
// stay within API rate limits. Results keep the source resume's filename.
export const analyzeBatchMatches = async (
  jobData: unknown,
  resumes: ResumeLike[]
): Promise<MatchAnalysis[]> => {
  try {
    const batchSize = 5;
    const results: MatchAnalysis[] = [];

    for (let i = 0; i < resumes.length; i += batchSize) {
      const batch = resumes.slice(i, i + batchSize);
      try {
        const batchResults = await Promise.all(
          batch.map((resume) => analyzeMatch(jobData, resume))
        );

        const validResults = batchResults
          .map((result, index): MatchAnalysis | null => {
            if (!result) return null;
            return { ...result, filename: batch[index].filename };
          })
          .filter((result): result is MatchAnalysis => result !== null);

        results.push(...validResults);
      } catch (batchError) {
        console.error('Error processing batch:', batchError);
        // Continue with next batch instead of failing the entire process
      }
    }

    return results;
  } catch (error) {
    console.error('Error in batch match analysis:', error);
    return [];
  }
};
