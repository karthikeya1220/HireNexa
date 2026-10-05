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
export declare const toResume: (row: ResumeRow) => IResume;
