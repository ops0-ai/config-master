import { Router } from 'express';
import { db } from '../index';
import { githubIntegrations, configurationGithubMappings } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { rbacMiddleware } from '../middleware/rbacMiddleware';
import { auditMiddleware } from '../middleware/audit';
import { githubService } from '../services/githubService';
import Joi from 'joi';
import crypto from 'crypto';

const router = Router();

// Temporary in-memory storage for OAuth data
// In production, use Redis or database with TTL
const oauthDataStore = new Map<string, { data: any; timestamp: number }>();

// Clean up old sessions every 10 minutes  
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oauthDataStore.entries()) {
    if (now - value.timestamp > 1800000) { // 30 minutes (device codes expire in 15 min, give extra buffer)
      oauthDataStore.delete(key);
    }
  }
}, 600000); // 10 minutes

// Schema for GitHub integration creation
const githubIntegrationSchema = Joi.object({
  name: Joi.string().required(),
  repositoryId: Joi.string().required(),
  repositoryName: Joi.string().required(),
  repositoryFullName: Joi.string().required(),
  defaultBranch: Joi.string().default('main'),
  basePath: Joi.string().default('/configs'),
  accessToken: Joi.string().required(),
  user: Joi.object().required()
});

// Schema for OAuth callback
const oauthCallbackSchema = Joi.object({
  code: Joi.string().required(),
  state: Joi.string().required(),
});

/**
 * GET /api/github/integrations
 * Get all GitHub integrations for the organization
 */
router.get('/integrations', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const integrations = await db
      .select({
        id: githubIntegrations.id,
        name: githubIntegrations.name,
        githubUsername: githubIntegrations.githubUsername,
        repositoryName: githubIntegrations.repositoryName,
        repositoryFullName: githubIntegrations.repositoryFullName,
        defaultBranch: githubIntegrations.defaultBranch,
        basePath: githubIntegrations.basePath,
        isActive: githubIntegrations.isActive,
        autoFetch: githubIntegrations.autoFetch,
        fetchInterval: githubIntegrations.fetchInterval,
        lastFetchAt: githubIntegrations.lastFetchAt,
        lastSyncAt: githubIntegrations.lastSyncAt,
        syncStatus: githubIntegrations.syncStatus,
        createdAt: githubIntegrations.createdAt,
        updatedAt: githubIntegrations.updatedAt,
      })
      .from(githubIntegrations)
      .where(eq(githubIntegrations.organizationId, req.user!.organizationId));

    res.json(integrations);
  } catch (error) {
    console.error('Error fetching GitHub integrations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/github/auth/token
 * Authenticate with GitHub using Personal Access Token
 */
router.post('/auth/token', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Personal Access Token is required' });
    }
    
    // Validate token and get user info
    const user = await githubService.getAuthenticatedUser(token);
    
    // Get all user repositories and organizations
    const [repositories, organizations] = await Promise.all([
      githubService.getUserRepositories(token),
      githubService.getUserOrganizations(token)
    ]);
    
    // Group repositories by organization
    const repositoriesByOrg: Record<string, any[]> = {};
    const personalRepos: any[] = [];
    
    for (const repo of repositories) {
      if (repo.owner?.type === 'Organization') {
        if (!repositoriesByOrg[repo.owner.login]) {
          repositoriesByOrg[repo.owner.login] = [];
        }
        repositoriesByOrg[repo.owner.login].push(repo);
      } else {
        personalRepos.push(repo);
      }
    }
    
    res.json({ 
      success: true,
      user,
      organizations,
      repositoriesByOrg,
      personalRepos,
      accessToken: token
    });
  } catch (error) {
    console.error('Error authenticating with GitHub:', error);
    res.status(500).json({ error: 'Failed to authenticate with GitHub. Please check your Personal Access Token.' });
  }
});


/**
 * POST /api/github/integrations
 * Create a new GitHub integration
 */
router.post('/integrations', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = githubIntegrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { accessToken, user, ...integrationData } = req.body;

    if (!accessToken || !user) {
      return res.status(400).json({ error: 'Access token and user information are required' });
    }

    // Create the integration
    const integration = await githubService.storeGitHubIntegration({
      organizationId: req.user!.organizationId,
      name: value.name,
      accessToken,
      user,
      repository: {
        id: parseInt(value.repositoryId),
        name: value.repositoryName,
        full_name: value.repositoryFullName,
        private: true, // We'll assume private for now
        default_branch: value.defaultBranch,
        description: null,
        html_url: `https://github.com/${value.repositoryFullName}`,
      },
      defaultBranch: value.defaultBranch,
      basePath: value.basePath,
    });

    // Return integration without sensitive data
    const { accessToken: _, ...safeIntegration } = integration;
    res.status(201).json(safeIntegration);
  } catch (error) {
    console.error('Error creating GitHub integration:', error);
    res.status(500).json({ error: 'Failed to create GitHub integration' });
  }
});

/**
 * GET /api/github/session/:key
 * Get OAuth session data
 */
router.get('/session/:key', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { key } = req.params;
    
    const sessionData = oauthDataStore.get(key);
    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    // Verify the session belongs to the current user
    if (sessionData.data.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Group repositories by organization
    const repositoriesByOrg: Record<string, any[]> = {};
    const personalRepos: any[] = [];
    
    for (const repo of sessionData.data.repositories) {
      if (repo.owner?.type === 'Organization') {
        if (!repositoriesByOrg[repo.owner.login]) {
          repositoriesByOrg[repo.owner.login] = [];
        }
        repositoriesByOrg[repo.owner.login].push(repo);
      } else {
        personalRepos.push(repo);
      }
    }
    
    // Clean up session after retrieval
    oauthDataStore.delete(key);
    
    res.json({
      user: sessionData.data.user,
      organizations: sessionData.data.organizations,
      repositoriesByOrg,
      personalRepos,
      accessToken: sessionData.data.accessToken
    });
  } catch (error) {
    console.error('Error retrieving session data:', error);
    res.status(500).json({ error: 'Failed to retrieve session data' });
  }
});

/**
 * GET /api/github/integrations/:id/repositories/:owner/:repo/branches
 * Get branches for a repository
 */
router.get('/integrations/:id/repositories/:owner/:repo/branches', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id, owner, repo } = req.params;

    // Get the integration with decrypted token
    const integration = await githubService.getGitHubIntegration(id, req.user!.organizationId);
    
    if (!integration) {
      return res.status(404).json({ error: 'GitHub integration not found' });
    }

    const branches = await githubService.getRepositoryBranches(
      integration.accessToken,
      owner,
      repo
    );

    res.json(branches);
  } catch (error) {
    console.error('Error fetching repository branches:', error);
    res.status(500).json({ error: 'Failed to fetch repository branches' });
  }
});

/**
 * GET /api/github/integrations/:id/repositories/:owner/:repo/contents
 * Get repository contents (files and directories)
 */
router.get('/integrations/:id/repositories/:owner/:repo/contents', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id, owner, repo } = req.params;
    const { path = '', branch = 'main' } = req.query;

    // Get the integration with decrypted token
    const integration = await githubService.getGitHubIntegration(id, req.user!.organizationId);
    
    if (!integration) {
      return res.status(404).json({ error: 'GitHub integration not found' });
    }

    const contents = await githubService.getRepositoryContents(
      integration.accessToken,
      owner,
      repo,
      path as string,
      branch as string
    );

    res.json(contents);
  } catch (error) {
    console.error('Error fetching repository contents:', error);
    res.status(500).json({ error: 'Failed to fetch repository contents' });
  }
});

/**
 * GET /api/github/integrations/:id/repositories/:owner/:repo/file
 * Get file content from repository
 */
router.get('/integrations/:id/repositories/:owner/:repo/file', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id, owner, repo } = req.params;
    const { path, branch = 'main' } = req.query;

    if (!path) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Get the integration with decrypted token
    const integration = await githubService.getGitHubIntegration(id, req.user!.organizationId);
    
    if (!integration) {
      return res.status(404).json({ error: 'GitHub integration not found' });
    }

    const fileContent = await githubService.getFileContent(
      integration.accessToken,
      owner,
      repo,
      path as string,
      branch as string
    );

    if (!fileContent) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json(fileContent);
  } catch (error) {
    console.error('Error fetching file content:', error);
    res.status(500).json({ error: 'Failed to fetch file content' });
  }
});

/**
 * POST /api/github/integrations/:id/sync-configuration
 * Sync a configuration to GitHub
 */
router.post('/integrations/:id/sync-configuration', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id } = req.params;
    const { configurationId, relativePath, branch, content, commitMessage } = req.body;

    if (!configurationId || !relativePath || !branch || !content || !commitMessage) {
      return res.status(400).json({ 
        error: 'Configuration ID, relative path, branch, content, and commit message are required' 
      });
    }

    // Get the integration
    const integration = await githubService.getGitHubIntegration(id, req.user!.organizationId);
    
    if (!integration) {
      return res.status(404).json({ error: 'GitHub integration not found' });
    }

    const [owner, repo] = integration.repositoryFullName.split('/');

    // Check if file exists to get its SHA
    const existingFile = await githubService.getFileContent(
      integration.accessToken,
      owner,
      repo,
      relativePath,
      branch
    );

    // Create or update the file
    const result = await githubService.createOrUpdateFile(
      integration.accessToken,
      owner,
      repo,
      relativePath,
      content,
      commitMessage,
      branch,
      existingFile?.sha
    );

    // Update or create mapping
    const existingMapping = await db
      .select()
      .from(configurationGithubMappings)
      .where(
        and(
          eq(configurationGithubMappings.configurationId, configurationId),
          eq(configurationGithubMappings.githubIntegrationId, integration.id)
        )
      )
      .limit(1);

    if (existingMapping.length > 0) {
      await db
        .update(configurationGithubMappings)
        .set({
          relativePath,
          branch,
          lastSyncedSha: result.sha,
          lastSyncAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date(),
        })
        .where(eq(configurationGithubMappings.id, existingMapping[0].id));
    } else {
      await db.insert(configurationGithubMappings).values({
        configurationId,
        githubIntegrationId: integration.id,
        relativePath,
        branch,
        lastSyncedSha: result.sha,
        lastSyncAt: new Date(),
        syncStatus: 'synced',
      });
    }

    res.json({
      success: true,
      sha: result.sha,
      commitUrl: result.commit_url,
    });
  } catch (error) {
    console.error('Error syncing configuration to GitHub:', error);
    res.status(500).json({ error: 'Failed to sync configuration to GitHub' });
  }
});

/**
 * POST /api/github/integrations/:id/refresh
 * Refresh repositories using stored token
 */
router.post('/integrations/:id/refresh', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id } = req.params;

    // Get the integration with decrypted token
    const integration = await githubService.getGitHubIntegration(id, req.user!.organizationId);
    
    if (!integration) {
      return res.status(404).json({ error: 'GitHub integration not found' });
    }

    // Get all user repositories and organizations using stored token
    const [user, repositories, organizations] = await Promise.all([
      githubService.getAuthenticatedUser(integration.accessToken),
      githubService.getUserRepositories(integration.accessToken),
      githubService.getUserOrganizations(integration.accessToken)
    ]);
    
    // Group repositories by organization
    const repositoriesByOrg: Record<string, any[]> = {};
    const personalRepos: any[] = [];
    
    for (const repo of repositories) {
      if (repo.owner?.type === 'Organization') {
        if (!repositoriesByOrg[repo.owner.login]) {
          repositoriesByOrg[repo.owner.login] = [];
        }
        repositoriesByOrg[repo.owner.login].push(repo);
      } else {
        personalRepos.push(repo);
      }
    }
    
    res.json({ 
      success: true,
      user,
      organizations,
      repositoriesByOrg,
      personalRepos,
      accessToken: integration.accessToken
    });
  } catch (error) {
    console.error('Error refreshing GitHub repositories:', error);
    res.status(500).json({ error: 'Failed to refresh repositories' });
  }
});

/**
 * DELETE /api/github/integrations/:id
 * Delete GitHub integration
 */
router.delete('/integrations/:id', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id } = req.params;

    const integration = await db
      .select()
      .from(githubIntegrations)
      .where(
        and(
          eq(githubIntegrations.id, id),
          eq(githubIntegrations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!integration[0]) {
      return res.status(404).json({ error: 'GitHub integration not found' });
    }

    await db
      .delete(githubIntegrations)
      .where(eq(githubIntegrations.id, id));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting GitHub integration:', error);
    res.status(500).json({ error: 'Failed to delete GitHub integration' });
  }
});

/**
 * PUT /api/github/integrations/:id
 * Update GitHub integration settings
 */
router.put('/integrations/:id', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id } = req.params;
    const { name, defaultBranch, basePath, autoFetch, fetchInterval } = req.body;

    const integration = await db
      .select()
      .from(githubIntegrations)
      .where(
        and(
          eq(githubIntegrations.id, id),
          eq(githubIntegrations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!integration[0]) {
      return res.status(404).json({ error: 'GitHub integration not found' });
    }

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (defaultBranch !== undefined) updateData.defaultBranch = defaultBranch;
    if (basePath !== undefined) updateData.basePath = basePath;
    if (autoFetch !== undefined) updateData.autoFetch = autoFetch;
    if (fetchInterval !== undefined) updateData.fetchInterval = fetchInterval;

    const [updatedIntegration] = await db
      .update(githubIntegrations)
      .set(updateData)
      .where(eq(githubIntegrations.id, id))
      .returning();

    // Return without access token
    const { accessToken, ...safeIntegration } = updatedIntegration;
    res.json(safeIntegration);
  } catch (error) {
    console.error('Error updating GitHub integration:', error);
    res.status(500).json({ error: 'Failed to update GitHub integration' });
  }
});

export { router as githubRoutes };