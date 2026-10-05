import { type SupabaseClient } from '@supabase/supabase-js';
export declare const supabaseAdmin: SupabaseClient;
export declare const PG_UNIQUE_VIOLATION = "23505";
export declare const PG_CHECK_VIOLATION = "23514";
export declare const PG_INVALID_INPUT = "22P02";
export declare const throwOnError: (error: {
    message: string;
} | null) => void;
export declare const httpStatusForDbError: (error: unknown) => number | null;
export declare const isUuid: (value: string) => boolean;
