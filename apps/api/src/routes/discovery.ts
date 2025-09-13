import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { DiscoveryService } from '../services/discoveryService';
import { githubService } from '../services/githubService';
import { db } from '../index';
import { organizations } from '@config-management/database';
import { eq } from 'drizzle-orm';
import archiver from 'archiver';

const router = Router();
const discoveryService = new DiscoveryService();

/**
 * POST /api/discovery/scan
 * Scan cloud resources for a specific integration and regions
 */
router.post('/scan', async (req: AuthenticatedRequest, res) => {
  try {
    const { integrationId, regions } = req.body;
    const organizationId = req.user?.organizationId;

    if (!integrationId || !regions || !Array.isArray(regions) || regions.length === 0) {
      return res.status(400).json({
        error: 'Integration ID and regions are required'
      });
    }

    const result = await discoveryService.scanResources(organizationId!, integrationId, regions);
    
    res.json(result);
  } catch (error) {
    console.error('Discovery scan error:', error);
    res.status(500).json({
      error: 'Failed to scan cloud resources',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/discovery/generate
 * Generate Infrastructure as Code (OpenTofu/Terraform) from selected resources
 */
router.post('/generate', async (req: AuthenticatedRequest, res) => {
  try {
    const { resources, provider = 'opentofu' } = req.body;
    const organizationId = req.user?.organizationId;

    if (!resources || !Array.isArray(resources) || resources.length === 0) {
      return res.status(400).json({
        error: 'Resources array is required'
      });
    }

    const result = await discoveryService.generateInfrastructureCode(
      organizationId!,
      resources,
      provider
    );
    
    console.log('Generated code result keys:', Object.keys(result));
    console.log('Modular structure exists:', !!result.modular);
    if (result.modular) {
      console.log('Modular files count:', Object.keys(result.modular.files || {}).length);
      console.log('Modular file list:', Object.keys(result.modular.files || {}));
    }
    
    res.json(result);
  } catch (error) {
    console.error('Code generation error:', error);
    res.status(500).json({
      error: 'Failed to generate infrastructure code',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/discovery/sessions
 * Get discovery sessions for the organization
 */
router.get('/sessions', async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const sessions = await discoveryService.getDiscoverySessions(organizationId!);
    
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching discovery sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch discovery sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/discovery/sessions/:sessionId
 * Get a specific discovery session with resources
 */
router.get('/sessions/:sessionId', async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;
    const organizationId = req.user?.organizationId;

    const session = await discoveryService.getDiscoverySession(organizationId!, sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Discovery session not found' });
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error fetching discovery session:', error);
    res.status(500).json({
      error: 'Failed to fetch discovery session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/discovery/sessions/:sessionId
 * Delete a discovery session and its resources
 */
router.delete('/sessions/:sessionId', async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;
    const organizationId = req.user?.organizationId;

    await discoveryService.deleteDiscoverySession(organizationId!, sessionId);
    
    res.json({ success: true, message: 'Discovery session deleted successfully' });
  } catch (error) {
    console.error('Error deleting discovery session:', error);
    res.status(500).json({
      error: 'Failed to delete discovery session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/discovery/sessions/:sessionId/regenerate
 * Regenerate code for a discovery session with updated selections
 */
router.post('/sessions/:sessionId/regenerate', async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;
    const { selectedResourceIds, provider = 'opentofu' } = req.body;
    const organizationId = req.user?.organizationId;

    if (!selectedResourceIds || !Array.isArray(selectedResourceIds)) {
      return res.status(400).json({
        error: 'Selected resource IDs array is required'
      });
    }

    const result = await discoveryService.regenerateCode(
      organizationId!,
      sessionId,
      selectedResourceIds,
      provider
    );
    
    res.json(result);
  } catch (error) {
    console.error('Code regeneration error:', error);
    res.status(500).json({
      error: 'Failed to regenerate infrastructure code',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/discovery/generate/github
 * Push generated Infrastructure as Code directly to GitHub repository
 */
router.post('/generate/github', async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      resources, 
      provider = 'opentofu', 
      githubIntegrationId, 
      repositoryPath = 'infrastructure', 
      branchName, 
      commitMessage,
      createPullRequest = false 
    } = req.body;
    const organizationId = req.user?.organizationId;

    if (!resources || !Array.isArray(resources) || resources.length === 0) {
      return res.status(400).json({
        error: 'Resources array is required'
      });
    }

    if (!githubIntegrationId) {
      return res.status(400).json({
        error: 'GitHub integration ID is required'
      });
    }

    // Generate the infrastructure code
    const result = await discoveryService.generateInfrastructureCode(
      organizationId!,
      resources,
      provider
    );

    // Push to GitHub
    const githubResult = await discoveryService.pushToGitHub({
      organizationId: organizationId!,
      integrationId: githubIntegrationId,
      generatedCode: result,
      repositoryPath,
      branchName: branchName || `pulse-infrastructure-${Date.now()}`,
      commitMessage: commitMessage || `Add infrastructure code generated by Pulse Discovery - ${new Date().toISOString()}`,
      createPullRequest,
      resources
    });
    
    res.json({
      ...result,
      github: githubResult
    });
  } catch (error) {
    console.error('GitHub sync error:', error);
    res.status(500).json({
      error: 'Failed to sync infrastructure code to GitHub',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/discovery/generate/download
 * Generate and download Infrastructure as Code as a ZIP file
 */
router.post('/generate/download', async (req: AuthenticatedRequest, res) => {
  try {
    const { resources, provider = 'opentofu', format = 'modular' } = req.body;
    const organizationId = req.user?.organizationId;

    if (!resources || !Array.isArray(resources) || resources.length === 0) {
      return res.status(400).json({
        error: 'Resources array is required'
      });
    }

    const result = await discoveryService.generateInfrastructureCode(
      organizationId!,
      resources,
      provider
    );

    // Set response headers for ZIP download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `pulse-infrastructure-${timestamp}.zip`;
    
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache'
    });

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ error: 'Failed to create archive' });
    });

    // Pipe archive to response
    archive.pipe(res);

    if (format === 'modular' && result.modular) {
      // Add all modular project files
      for (const [filePath, content] of Object.entries(result.modular.files)) {
        archive.append(content, { name: filePath });
      }
      
      // Add import scripts
      archive.append(generateImportScript(resources), { name: 'scripts/import-resources.sh' });
      archive.append(generateImportCommands(result.modular.structure), { name: 'scripts/terraform-import-commands.txt' });
      
    } else {
      // Legacy single-file format
      archive.append(result.terraform, { name: 'infrastructure.tf' });
      archive.append(JSON.stringify(result.statefile, null, 2), { name: 'terraform.tfstate' });
      archive.append(generateSimpleReadme(), { name: 'README.md' });
    }

    // Finalize the archive
    await archive.finalize();
    
  } catch (error) {
    console.error('Code generation and download error:', error);
    res.status(500).json({
      error: 'Failed to generate and download infrastructure code',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/discovery/github-sync
 * Sync discovered infrastructure to GitHub repository
 */
router.post('/github-sync', async (req: AuthenticatedRequest, res) => {
  try {
    const {
      integrationId,
      branch,
      folderPath,
      files,
      commitMessage,
      createPR,
      sessionId
    } = req.body;
    
    const organizationId = req.user?.organizationId;

    if (!integrationId || !branch || !folderPath || !files || !commitMessage) {
      return res.status(400).json({
        error: 'Missing required fields: integrationId, branch, folderPath, files, and commitMessage are required'
      });
    }

    // Get the GitHub integration
    const integration = await githubService.getGitHubIntegration(integrationId, organizationId!);
    if (!integration) {
      return res.status(404).json({ error: 'GitHub integration not found' });
    }

    const [owner, repo] = integration.repositoryFullName.split('/');
    let targetBranch = branch;
    let pullRequestUrl = null;

    try {
      // If creating PR, create a new branch
      if (createPR) {
        const newBranchName = `pulse-discovery-${Date.now()}`;
        await githubService.createBranch(
          integration.accessToken,
          owner,
          repo,
          newBranchName,
          branch
        );
        targetBranch = newBranchName;
      }

      // Upload all files to GitHub
      for (const [filePath, content] of Object.entries(files)) {
        // Check if file exists to get SHA for update
        const existingFile = await githubService.getFileContent(
          integration.accessToken,
          owner,
          repo,
          filePath,
          targetBranch
        );

        await githubService.createOrUpdateFile(
          integration.accessToken,
          owner,
          repo,
          filePath,
          content as string,
          commitMessage,
          targetBranch,
          existingFile?.sha
        );
      }

      // Create pull request if requested
      if (createPR) {
        // Get organization name
        let organizationName = 'Unknown Organization';
        try {
          const [org] = await db
            .select({ name: organizations.name })
            .from(organizations)
            .where(eq(organizations.id, organizationId!))
            .limit(1);
          if (org) {
            organizationName = org.name;
          }
        } catch (error) {
          console.error('Error fetching organization name:', error);
        }

        // Count resources and identify resource types
        const filesList = Object.keys(files);
        const terraformFiles = filesList.filter(f => f.endsWith('.tf'));
        const moduleCount = filesList.filter(f => f.includes('/modules/')).length > 0 
          ? filesList.filter(f => f.includes('/modules/')).map(f => f.split('/modules/')[1]?.split('/')[0]).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).length 
          : 0;
        
        // Get current date in readable format
        const dateStr = new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        const pr = await githubService.createPullRequest(
          integration.accessToken,
          owner,
          repo,
          {
            title: `[Pulse Discovery] Infrastructure as Code - ${folderPath} - ${dateStr}`,
            head: targetBranch,
            base: branch,
            body: `## 🔍 Pulse Infrastructure Discovery

This pull request contains **Infrastructure as Code** automatically generated from your live cloud resources using Pulse Discovery.

### 📋 Summary

This PR adds Terraform/OpenTofu configuration files that represent your existing cloud infrastructure. These files can be used to:
- 📖 Document your current infrastructure setup
- 🔄 Manage existing resources with Infrastructure as Code
- 🎯 Create similar environments (dev/staging/prod)
- 📊 Track infrastructure changes over time

### 📁 Files Included

**Total Files:** ${filesList.length}
${moduleCount > 0 ? `**Modules:** ${moduleCount}` : ''}
**Location:** \`${folderPath}/\`

<details>
<summary>Click to see all files (${filesList.length})</summary>

\`\`\`
${filesList.map(f => `${folderPath}/${f}`).join('\n')}
\`\`\`

</details>

### 🏗️ Infrastructure Components

The discovered infrastructure includes:
${terraformFiles.length > 0 ? `- **${terraformFiles.length}** Terraform configuration files` : ''}
${filesList.some(f => f.includes('variables.tf')) ? '- Variable definitions for customization' : ''}
${filesList.some(f => f.includes('outputs.tf')) ? '- Output values for resource references' : ''}
${filesList.some(f => f.includes('terraform.tfstate')) ? '- State file with current resource mappings' : ''}
${filesList.some(f => f.includes('README.md')) ? '- Documentation and usage instructions' : ''}
${filesList.some(f => f.includes('import-resources.sh')) ? '- Import scripts for existing resources' : ''}

### ⚙️ Next Steps

1. **Review the Code**: Carefully review all generated configuration files
2. **Check Sensitive Data**: Ensure no secrets or sensitive information is exposed
3. **Test Locally**: 
   \`\`\`bash
   cd ${folderPath}
   terraform init
   terraform plan
   \`\`\`
4. **Import Resources** (if needed):
   - Use the provided import scripts to link existing resources
   - Run \`terraform import\` commands for resource adoption
5. **Apply Changes**: Once verified, you can manage these resources with Terraform

### ⚠️ Important Notes

- **State Management**: The included state file contains references to your existing resources
- **Resource Naming**: Resource names have been sanitized and may differ from original names
- **Dependencies**: Review resource dependencies and adjust if needed
- **Credentials**: Ensure proper authentication is configured before applying changes

### 🔐 Security Checklist

Before merging, please verify:
- [ ] No hardcoded secrets or credentials in the code
- [ ] Sensitive variables are properly marked as sensitive
- [ ] State file doesn't contain sensitive information
- [ ] Resource access controls are appropriate
- [ ] Network security rules are correctly configured

### 📊 Generation Details

- **Generated by**: ${req.user?.name || req.user?.email || 'Unknown User'}
- **Organization**: ${organizationName}
- **Platform**: Pulse Infrastructure Discovery
- **Date**: ${new Date().toISOString()}
- **Session ID**: ${sessionId || 'Not specified'}
- **Target Folder**: \`${folderPath}/\`
- **Commit Message**: ${commitMessage}

### 📚 Documentation

For more information about working with the generated infrastructure code:
- [Terraform Import Documentation](https://www.terraform.io/docs/import/index.html)
- [OpenTofu Documentation](https://opentofu.org/docs/)
- [Pulse Platform Documentation](#)

---

*This infrastructure code was automatically generated. Please review carefully before merging and applying to your environment.*`,
            draft: false
          }
        );
        pullRequestUrl = pr.html_url;
      }

      res.json({
        success: true,
        message: createPR 
          ? 'Successfully created pull request with infrastructure code' 
          : 'Successfully synced infrastructure code to GitHub',
        branch: targetBranch,
        pullRequestUrl,
        filesUploaded: Object.keys(files).length
      });

    } catch (error) {
      console.error('GitHub sync operation error:', error);
      throw error;
    }

  } catch (error) {
    console.error('GitHub sync error:', error);
    res.status(500).json({
      error: 'Failed to sync to GitHub',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate import script for discovered resources
 */
function generateImportScript(resources: any[]): string {
  return `#!/bin/bash

# Terraform Import Script
# Generated by Pulse Infrastructure Discovery

set -e

echo "🔄 Importing discovered infrastructure resources..."
echo "Total resources to import: ${resources.length}"
echo ""

# Initialize Terraform if not already done
if [ ! -d ".terraform" ]; then
    echo "📦 Initializing Terraform..."
    terraform init
    echo ""
fi

# Import commands (commented out for safety)
# Uncomment and run each import command after reviewing the resources

${resources.map((resource, index) => {
  const resourceType = getImportResourceType(resource.resourceType);
  const moduleName = getModuleName(resource.resourceType);
  const resourceName = sanitizeResourceName(resource.name);
  
  return `# ${index + 1}. ${resource.name} (${resource.resourceType})
# terraform import 'module.${moduleName}.${resourceType}.imported["${resourceName}"]' ${resource.resourceId}`;
}).join('\n\n')}

echo ""
echo "✅ Import script generated successfully!"
echo "📝 Please review and uncomment the import commands above before running them."
echo "💡 Run 'terraform plan' after importing to verify the configuration."
`;
}

/**
 * Generate import commands file
 */
function generateImportCommands(structure: any): string {
  return `# Terraform Import Commands
# Generated by Pulse Infrastructure Discovery

# IMPORTANT: Review these commands before executing
# Make sure your Terraform configuration matches the existing resources

# To use these commands:
# 1. Initialize Terraform: terraform init
# 2. Run each import command below
# 3. Run terraform plan to verify
# 4. Run terraform apply if needed

# Example import commands:
# (Uncomment and modify as needed)

${Object.keys(structure.modules || {}).map(moduleName => 
  `# Import commands for ${moduleName} module
# terraform import 'module.${moduleName}.resource_type.resource_name' resource_id`
).join('\n')}
`;
}

/**
 * Generate simple README for legacy format
 */
function generateSimpleReadme(): string {
  return `# Infrastructure as Code

Generated by Pulse Infrastructure Discovery

## Files

- \`infrastructure.tf\` - Main Terraform configuration
- \`terraform.tfstate\` - State file for importing resources

## Usage

1. Initialize Terraform: \`terraform init\`
2. Import existing resources using the resource IDs in the configuration
3. Run \`terraform plan\` to review changes
4. Run \`terraform apply\` to manage resources

## Important

Review all configurations before applying changes to ensure they match your existing infrastructure.
`;
}

// Helper functions
function getImportResourceType(resourceType: string): string {
  const typeMap: Record<string, string> = {
    'aws::ec2::instance': 'aws_instance',
    'aws::ec2::vpc': 'aws_vpc',
    'aws::s3::bucket': 'aws_s3_bucket',
    'aws::rds::instance': 'aws_db_instance',
    'aws::lambda::function': 'aws_lambda_function',
    'aws::iam::role': 'aws_iam_role'
  };
  return typeMap[resourceType] || 'aws_resource';
}

function getModuleName(resourceType: string): string {
  const nameMap: Record<string, string> = {
    'aws::ec2::instance': 'ec2_instances',
    'aws::ec2::vpc': 'vpc',
    'aws::s3::bucket': 's3_buckets',
    'aws::rds::instance': 'rds_instances',
    'aws::lambda::function': 'lambda_functions',
    'aws::iam::role': 'iam_roles'
  };
  return nameMap[resourceType] || resourceType.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function sanitizeResourceName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^[0-9]/, 'resource_$&').toLowerCase();
}

export default router;