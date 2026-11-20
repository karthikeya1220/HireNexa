export interface JobRubricCategory {
  key: string;
  label: string;
  weight: number; // e.g. 35, 30, 25, 10
  description: string;
}

export interface CustomJobRubric {
  categories: JobRubricCategory[];
  bonusMax?: number;
  requiredKeywords?: string[];
  customPromptCriteria?: string;
}

export const DEFAULT_JOB_RUBRIC: CustomJobRubric = {
  categories: [
    {
      key: 'production_experience',
      label: 'Production Experience',
      weight: 35,
      description: 'Production systems, real-world scale, commercial shipping, architecture ownership.',
    },
    {
      key: 'technical_skills',
      label: 'Technical Skills Fit',
      weight: 30,
      description: 'Alignment with required languages, databases, cloud, and core frameworks.',
    },
    {
      key: 'self_projects_and_code',
      label: 'Projects & Code Depth',
      weight: 25,
      description: 'Self-driven projects, GitHub activity, open-source work, and code rigor.',
    },
    {
      key: 'domain_and_education',
      label: 'Domain & Background',
      weight: 10,
      description: 'Relevance of education, foundational computer science, and domain specialization.',
    },
  ],
  bonusMax: 15,
};
