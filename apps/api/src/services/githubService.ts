// Use fetch directly instead of Octokit to avoid ES module issues
const makeGitHubRequest = async (url: string, token: string, options: any = {}) => {
  const response = await fetch(`https://api.github.com${url}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ConfigMaster/1.0',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

import crypto from 'crypto';
import { db } from '../index';
import { githubIntegrations, configurationGithubMappings, githubPullRequests } from '@config-management/database';
import { eq, and } from 'drizzle-orm';

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
  html_url: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface CreatePullRequestParams {
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
}

export class GitHubService {
  private algorithm = 'aes-256-gcm';
  private secretKey: string;

  constructor() {
    // Use the same encryption key as the settings service
    this.secretKey = process.env.ENCRYPTION_KEY || 'cm-default-key-32-chars-exactly!';
  }

  /**
   * Generate GitHub OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    const scope = 'repo,user:email';
    
    if (!clientId || !redirectUri) {
      throw new Error('GitHub OAuth not configured - missing GITHUB_CLIENT_ID or GITHUB_REDIRECT_URI');
    }
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope,
      state: state,
      response_type: 'code'
    });
    
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access token
   */
  async exchangeCodeForToken(code: string, state: string): Promise<{ access_token: string; user: GitHubUser }> {
    try {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('GitHub OAuth not configured');
      }
      
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
        }),
      });
      
      if (!tokenResponse.ok) {
        throw new Error(`GitHub OAuth error: ${tokenResponse.status}`);
      }
      
      const tokenData: any = await tokenResponse.json();
      
      if (tokenData.error) {
        throw new Error(`GitHub OAuth error: ${tokenData.error_description}`);
      }
      
      // Get user information with the access token
      const user = await this.getAuthenticatedUser(tokenData.access_token);
      
      return {
        access_token: tokenData.access_token,
        user: user
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw new Error('Failed to authorize with GitHub');
    }
  }

  /**
   * Get authenticated GitHub user
   */
  async getAuthenticatedUser(accessToken: string): Promise<GitHubUser> {
    try {
      const data: any = await makeGitHubRequest('/user', accessToken);
      return {
        id: data.id,
        login: data.login,
        name: data.name,
        email: data.email,
        avatar_url: data.avatar_url,
      };
    } catch (error) {
      console.error('Error getting authenticated user:', error);
      throw new Error('Failed to get GitHub user information');
    }
  }

  /**
   * Get user repositories
   */
  async getUserRepositories(accessToken: string, per_page = 100): Promise<GitHubRepository[]> {
    try {
      const data: any = await makeGitHubRequest(`/user/repos?sort=updated&per_page=${per_page}`, accessToken);

      return data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        default_branch: repo.default_branch,
        description: repo.description,
        html_url: repo.html_url,
      }));
    } catch (error) {
      console.error('Error getting user repositories:', error);
      throw new Error('Failed to get GitHub repositories');
    }
  }

  /**
   * Get repository branches
   */
  async getRepositoryBranches(accessToken: string, owner: string, repo: string): Promise<GitHubBranch[]> {
    try {
      const data: any = await makeGitHubRequest(`/repos/${owner}/${repo}/branches`, accessToken);

      return data.map((branch: any) => ({
        name: branch.name,
        sha: branch.commit.sha,
        protected: branch.protected || false,
      }));
    } catch (error) {
      console.error('Error getting repository branches:', error);
      throw new Error('Failed to get repository branches');
    }
  }

  /**
   * Create or update file content in repository
   */
  async createOrUpdateFile(
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string
  ): Promise<{ sha: string; commit_url: string }> {
    try {
      const encodedContent = Buffer.from(content).toString('base64');
      
      const body: any = {
        message,
        content: encodedContent,
        branch,
      };

      if (sha) {
        body.sha = sha;
      }

      const data: any = await makeGitHubRequest(`/repos/${owner}/${repo}/contents/${path}`, accessToken, {
        method: 'PUT',
        body
      });
      
      return {
        sha: data.content?.sha || '',
        commit_url: data.commit?.html_url || '',
      };
    } catch (error) {
      console.error('Error creating/updating file:', error);
      throw new Error('Failed to create or update file in repository');
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    accessToken: string,
    owner: string,
    repo: string,
    params: CreatePullRequestParams
  ): Promise<{ number: number; id: number; html_url: string; sha: string }> {
    try {
      const data: any = await makeGitHubRequest(`/repos/${owner}/${repo}/pulls`, accessToken, {
        method: 'POST',
        body: params
      });

      return {
        number: data.number,
        id: data.id,
        html_url: data.html_url,
        sha: data.head.sha,
      };
    } catch (error) {
      console.error('Error creating pull request:', error);
      throw new Error('Failed to create pull request');
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<{ content: string; sha: string; encoding: string } | null> {
    try {
      let url = `/repos/${owner}/${repo}/contents/${path}`;
      if (ref) url += `?ref=${ref}`;

      const data: any = await makeGitHubRequest(url, accessToken);
      
      if (Array.isArray(data) || data.type !== 'file') {
        return null;
      }

      return {
        content: data.content,
        sha: data.sha,
        encoding: data.encoding,
      };
    } catch (error: any) {
      if (error.message?.includes('404')) {
        return null;
      }
      console.error('Error getting file content:', error);
      throw new Error('Failed to get file content from repository');
    }
  }

  /**
   * Create a new branch from base branch
   */
  async createBranch(
    accessToken: string,
    owner: string,
    repo: string,
    branchName: string,
    baseBranch: string = 'main'
  ): Promise<string> {
    try {
      // Get the SHA of the base branch
      const baseRef: any = await makeGitHubRequest(`/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, accessToken);

      // Create new branch
      const newRef: any = await makeGitHubRequest(`/repos/${owner}/${repo}/git/refs`, accessToken, {
        method: 'POST',
        body: {
          ref: `refs/heads/${branchName}`,
          sha: baseRef.object.sha,
        }
      });

      return newRef.object.sha;
    } catch (error) {
      console.error('Error creating branch:', error);
      throw new Error('Failed to create branch in repository');
    }
  }

  /**
   * Encrypt access token for database storage
   */
  private encryptToken(token: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.secretKey);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt access token from database
   */
  private decryptToken(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted token format');
    }

    const [ivHex, encrypted] = parts;
    
    const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Store GitHub integration in database
   */
  async storeGitHubIntegration(params: {
    organizationId: string;
    name: string;
    accessToken: string;
    user: GitHubUser;
    repository: GitHubRepository;
    defaultBranch?: string;
    basePath?: string;
  }) {
    try {
      const encryptedToken = this.encryptToken(params.accessToken);
      
      const [integration] = await db.insert(githubIntegrations).values({
        organizationId: params.organizationId,
        name: params.name,
        githubUserId: params.user.id.toString(),
        githubUsername: params.user.login,
        accessToken: encryptedToken,
        repositoryId: params.repository.id.toString(),
        repositoryName: params.repository.name,
        repositoryFullName: params.repository.full_name,
        defaultBranch: params.defaultBranch || params.repository.default_branch,
        basePath: params.basePath || '/configs',
        isActive: true,
        syncStatus: 'connected',
      }).returning();

      return integration;
    } catch (error) {
      console.error('Error storing GitHub integration:', error);
      throw new Error('Failed to store GitHub integration');
    }
  }

  /**
   * Get GitHub integration with decrypted token
   */
  async getGitHubIntegration(integrationId: string, organizationId: string) {
    try {
      const [integration] = await db
        .select()
        .from(githubIntegrations)
        .where(
          and(
            eq(githubIntegrations.id, integrationId),
            eq(githubIntegrations.organizationId, organizationId)
          )
        );

      if (!integration) {
        return null;
      }

      return {
        ...integration,
        accessToken: this.decryptToken(integration.accessToken),
      };
    } catch (error) {
      console.error('Error getting GitHub integration:', error);
      throw new Error('Failed to get GitHub integration');
    }
  }
}

export const githubService = new GitHubService();