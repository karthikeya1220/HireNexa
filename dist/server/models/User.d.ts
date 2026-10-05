export interface IUser {
    uid: string;
    email: string;
    name?: string | null;
    role: 'user' | 'admin' | 'recruiter';
    profile_complete?: boolean;
    created_at: string;
    updated_at: string;
}
export type PublicUser = Pick<IUser, 'uid' | 'email' | 'name' | 'role' | 'created_at'>;
export declare const toPublicUser: (row: IUser) => PublicUser;
