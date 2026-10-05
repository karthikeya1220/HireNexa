// users table row shape (Supabase Postgres). The API has always spoken
// uid/email/name/role — that contract is unchanged from the Mongo era.

export interface IUser {
  uid: string;
  email: string;
  name?: string | null;
  role: 'user' | 'admin' | 'recruiter';
  profile_complete?: boolean;
  created_at: string;
  updated_at: string;
}

// Columns the API returns (mirrors the old `.select('uid email name role created_at')`).
export type PublicUser = Pick<IUser, 'uid' | 'email' | 'name' | 'role' | 'created_at'>;

export const toPublicUser = (row: IUser): PublicUser => ({
  uid: row.uid,
  email: row.email,
  name: row.name ?? undefined,
  role: row.role,
  created_at: row.created_at,
});
