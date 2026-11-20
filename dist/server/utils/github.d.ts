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
/**
 * Extracts a GitHub username from an arbitrary URL or string
 * e.g. "https://github.com/torvalds/linux" -> "torvalds"
 */
export declare function extractGitHubUsername(input: string): string | null;
/**
 * Fetches public GitHub profile and repository telemetry for a candidate using native fetch
 */
export declare function fetchGitHubProfile(usernameOrUrl: string): Promise<GitHubProfileData | null>;
