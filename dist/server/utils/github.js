"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractGitHubUsername = extractGitHubUsername;
exports.fetchGitHubProfile = fetchGitHubProfile;
/**
 * Extracts a GitHub username from an arbitrary URL or string
 * e.g. "https://github.com/torvalds/linux" -> "torvalds"
 */
function extractGitHubUsername(input) {
    if (!input)
        return null;
    const match = input.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) {
        const username = match[1];
        // Ignore non-user paths
        if (['topics', 'trending', 'features', 'pricing', 'about', 'security', 'login', 'signup'].includes(username.toLowerCase())) {
            return null;
        }
        return username;
    }
    return null;
}
/**
 * Fetches public GitHub profile and repository telemetry for a candidate using native fetch
 */
async function fetchGitHubProfile(usernameOrUrl) {
    const username = extractGitHubUsername(usernameOrUrl) || usernameOrUrl.replace(/^@/, '').trim();
    if (!username)
        return null;
    try {
        const headers = {
            'User-Agent': 'HireNexa-ATS-Agent',
            'Accept': 'application/vnd.github.v3+json',
        };
        if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        }
        // 1. Fetch user profile
        const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
            headers,
        });
        if (!userRes.ok)
            return null;
        const user = (await userRes.json());
        // 2. Fetch top public repos sorted by updated/pushed
        const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=15&type=owner`, {
            headers,
        });
        const reposData = reposRes.ok ? await reposRes.json() : [];
        const repos = Array.isArray(reposData) ? reposData : [];
        // Filter out forks to highlight original work
        const nonForkRepos = Array.isArray(repos) ? repos.filter(r => !r.fork) : [];
        const candidateRepos = nonForkRepos.length > 0 ? nonForkRepos : (Array.isArray(repos) ? repos : []);
        // Compute top languages
        const langCounts = {};
        candidateRepos.forEach(r => {
            if (r.language) {
                langCounts[r.language] = (langCounts[r.language] || 0) + 1;
            }
        });
        const topLanguages = Object.entries(langCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([lang]) => lang);
        // Pick top repos (prioritize stars, then recency)
        const featuredRepos = candidateRepos
            .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
            .slice(0, 4)
            .map(r => ({
            name: r.name,
            description: r.description || null,
            stars: r.stargazers_count || 0,
            forks: r.forks_count || 0,
            language: r.language || null,
            url: r.html_url,
            updatedAt: r.updated_at,
        }));
        return {
            username: user.login,
            name: user.name || null,
            bio: user.bio || null,
            publicReposCount: user.public_repos || 0,
            followers: user.followers || 0,
            avatarUrl: user.avatar_url,
            topLanguages,
            featuredRepos,
            profileUrl: user.html_url,
        };
    }
    catch (err) {
        console.warn(`[GitHub Enrichment] Could not fetch profile for "${username}": ${err.message}`);
        return null;
    }
}
