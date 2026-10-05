// resumes table row/API shapes. Note the API historically speaks
// `fileHash` (camel) while every other field is snake_case — keep that.

export interface IResume {
  _id: string;
  user_id: string;
  filename: string;
  filelink: string;
  fileHash: string;
  analysis: Record<string, unknown>;
  vendor_id?: string | null;
  vendor_name?: string | null;
  uploaded_at: string;
  updated_at: string;
}

export interface ResumeRow {
  id: string;
  user_id: string;
  filename: string;
  filelink: string;
  file_hash: string;
  analysis?: Record<string, unknown> | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  uploaded_at: string;
  updated_at: string;
}

export const toResume = (row: ResumeRow): IResume => ({
  _id: row.id,
  user_id: row.user_id,
  filename: row.filename,
  filelink: row.filelink,
  fileHash: row.file_hash,
  analysis: (row.analysis as Record<string, unknown>) ?? {},
  vendor_id: row.vendor_id,
  vendor_name: row.vendor_name,
  uploaded_at: row.uploaded_at,
  updated_at: row.updated_at,
});
