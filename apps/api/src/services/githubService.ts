// Use fetch directly instead of Octokit to avoid ES module issues
const makeGitHubRequest = async (url: string, token: string, options: any = {}) => {
  const response = await fetch(`https://api.github.com${url}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Pulse/1.0',
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
  owner?: {
    login: string;
    type: string;
  };
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
   * Generate GitHub App installation URL
   */
  generateInstallationUrl(sessionKey: string): string {
    // Use GitHub web flow with public parameters
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      client_id: 'Ov23liYxmiSPFEqvyYmL', // GitHub public client (works without secret)
      redirect_uri: `${baseUrl.replace('3000', '5005')}/api/github/callback`,
      scope: 'repo read:org user:email',
      state: sessionKey
    });
    
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token using web flow
   */
  async exchangeCodeForToken(code: string): Promise<{ access_token: string; user: GitHubUser }> {
    try {
      // Use a proxy service that handles the client secret server-side
      // Or use GitHub CLI's approach with device flow fallback
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: 'Ov23liYxmiSPFEqvyYmL',
          client_secret: '', // Public client, no secret needed for web flow
          code: code
        })
      });

      if (!response.ok) {
        throw new Error(`GitHub token exchange error: ${response.status}`);
      }

      const tokenData: any = await response.json();

      if (tokenData.error) {
        // If web flow fails, we'll need to use device flow
        throw new Error(`GitHub requires authentication. Please use the device flow.`);
      }

      // Get user information with the access token
      const user = await this.getAuthenticatedUser(tokenData.access_token);

      return {
        access_token: tokenData.access_token,
        user: user
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw new Error('Failed to authenticate with GitHub');
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
   * Get user's organizations
   */
  async getUserOrganizations(accessToken: string): Promise<any[]> {
    try {
      const orgs = await makeGitHubRequest('/user/orgs', accessToken);
      return orgs as any[];
    } catch (error) {
      console.error('Error getting user organizations:', error);
      throw new Error('Failed to get GitHub organizations');
    }
  }

  /**
   * Get all repositories accessible to the user (personal + organizations)
   */
  async getAllAccessibleRepositories(accessToken: string): Promise<GitHubRepository[]> {
    try {
      const allRepos: GitHubRepository[] = [];
      let page = 1;
      const per_page = 100;
      
      // Fetch all pages of repositories
      while (true) {
        const response = await fetch(`https://api.github.com/user/repos?page=${page}&per_page=${per_page}&sort=updated`, {
          headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Pulse/1.0'
          }
        });

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const repos = await response.json() as any[];
        
        if (repos.length === 0) {
          break;
        }

        allRepos.push(...repos.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private,
          default_branch: repo.default_branch,
          description: repo.description,
          html_url: repo.html_url,
          owner: {
            login: repo.owner.login,
            type: repo.owner.type
          }
        })));

        // Check if there are more pages
        const linkHeader = response.headers.get('link');
        if (!linkHeader || !linkHeader.includes('rel="next"')) {
          break;
        }
        
        page++;
      }

      return allRepos;
    } catch (error) {
      console.error('Error getting all repositories:', error);
      throw new Error('Failed to get GitHub repositories');
    }
  }

  /**
   * Get user repositories (kept for backward compatibility)
   */
  async getUserRepositories(accessToken: string, per_page = 100): Promise<GitHubRepository[]> {
    // Now using getAllAccessibleRepositories to get all repos
    return this.getAllAccessibleRepositories(accessToken);
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
   * Get repository contents (files and directories)
   */
  async getRepositoryContents(
    accessToken: string,
    owner: string,
    repo: string,
    path: string = '',
    ref?: string
  ): Promise<any[]> {
    try {
      let url = `/repos/${owner}/${repo}/contents/${path}`;
      if (ref) url += `?ref=${ref}`;

      const data: any = await makeGitHubRequest(url, accessToken);
      
      // If it's a single file, wrap it in an array
      if (!Array.isArray(data)) {
        return [data];
      }
      
      return data;
    } catch (error: any) {
      if (error.message?.includes('404')) {
        return [];
      }
      console.error('Error getting repository contents:', error);
      throw new Error('Failed to get repository contents');
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
    const key = Buffer.from(this.secretKey.padEnd(32, '0').slice(0, 32), 'utf8');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt access token from database
   */
  private decryptToken(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      // Handle legacy format or plain tokens for backward compatibility
      if (!encryptedData.includes(':')) {
        return encryptedData; // Assume it's a plain token
      }
      throw new Error('Invalid encrypted token format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(this.secretKey.padEnd(32, '0').slice(0, 32), 'utf8');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
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