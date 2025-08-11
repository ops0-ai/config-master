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

// Schema for GitHub integration creation
const githubIntegrationSchema = Joi.object({
  name: Joi.string().required(),
  repositoryId: Joi.string().required(),
  repositoryName: Joi.string().required(),
  repositoryFullName: Joi.string().required(),
  defaultBranch: Joi.string().default('main'),
  basePath: Joi.string().default('/configs'),
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
 * GET /api/github/auth-url
 * Get GitHub OAuth authorization URL
 */
router.get('/auth-url', authMiddleware, rbacMiddleware(), auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    // Generate a state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in session or cache (for now, we'll include user info in state)
    // In production, you'd want to use a proper session store
    const stateData = {
      userId: req.user!.id,
      organizationId: req.user!.organizationId,
      timestamp: Date.now()
    };
    
    // For simplicity, we'll encode the state data (in production, use proper session management)
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    const authUrl = githubService.getAuthorizationUrl(encodedState);
    
    res.json({ 
      authUrl,
      state: encodedState
    });
  } catch (error) {
    console.error('Error generating GitHub auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * GET /api/github/callback
 * Handle GitHub OAuth callback
 */
router.get('/callback', async (req, res): Promise<any> => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=${encodeURIComponent(error as string)}`);
    }
    
    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=missing_code_or_state`);
    }
    
    // Decode state to get user info
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=invalid_state`);
    }
    
    // Check state timestamp (should be within last 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=state_expired`);
    }
    
    // Exchange code for access token
    const { access_token, user } = await githubService.exchangeCodeForToken(code as string, state as string);
    
    // Get user repositories
    const repositories = await githubService.getUserRepositories(access_token);
    
    // Redirect back to frontend with success and data
    const successData = {
      user,
      repositories,
      accessToken: access_token,
      userId: stateData.userId,
      organizationId: stateData.organizationId
    };
    
    // Encode the success data
    const encodedData = Buffer.from(JSON.stringify(successData)).toString('base64');
    
    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?success=true&data=${encodedData}`);
  } catch (error) {
    console.error('Error handling GitHub callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=callback_failed`);
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