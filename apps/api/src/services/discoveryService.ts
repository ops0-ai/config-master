import { 
  EC2Client, 
  DescribeInstancesCommand,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeSecurityGroupsCommand,
} from '@aws-sdk/client-ec2';
import { 
  S3Client, 
  ListBucketsCommand,
  GetBucketLocationCommand 
} from '@aws-sdk/client-s3';
import { 
  RDSClient, 
  DescribeDBInstancesCommand 
} from '@aws-sdk/client-rds';
import { 
  LambdaClient, 
  ListFunctionsCommand 
} from '@aws-sdk/client-lambda';
import { 
  IAMClient, 
  ListRolesCommand 
} from '@aws-sdk/client-iam';
import { 
  ElasticLoadBalancingV2Client, 
  DescribeLoadBalancersCommand 
} from '@aws-sdk/client-elastic-load-balancing-v2';

import { db } from '../index';
import { awsIntegrations, discoverySession, discoveryResources, discoveryCodeGenerations } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { AWSService } from './awsService';
import { TerraformModuleGenerator } from './terraformModuleGenerator';
import { githubService } from './githubService';

interface DiscoveryResource {
  id: string;
  resourceType: string;
  resourceId: string;
  name: string;
  region: string;
  provider: string;
  tags: Record<string, string>;
  metadata: any;
}

interface GeneratedCode {
  terraform: string;
  statefile: any;
  modular?: {
    files: Record<string, string>;
    structure: any;
  };
}

export class DiscoveryService {
  private awsService = new AWSService();
  private moduleGenerator = new TerraformModuleGenerator();

  /**
   * Scan AWS resources across multiple regions
   */
  async scanResources(
    organizationId: string, 
    integrationId: string, 
    regions: string[]
  ): Promise<{ 
    sessionId: string; 
    resources: DiscoveryResource[]; 
    summary: any 
  }> {
    console.log(`🔍 Starting resource discovery for integration ${integrationId} in regions: ${regions.join(', ')}`);

    // Get AWS integration details
    const integration = await db
      .select()
      .from(awsIntegrations)
      .where(and(
        eq(awsIntegrations.id, integrationId),
        eq(awsIntegrations.organizationId, organizationId)
      ))
      .limit(1);

    if (!integration.length) {
      throw new Error('AWS integration not found');
    }

    const awsIntegration = integration[0];

    // Create discovery session
    const sessionResult = await db
      .insert(discoverySession)
      .values({
        organizationId,
        integrationId,
        provider: 'aws',
        regions,
        status: 'scanning',
        metadata: {
          integrationName: awsIntegration.name,
          startedAt: new Date().toISOString()
        }
      })
      .returning();

    const sessionId = sessionResult[0].id;

    try {
      let allResources: DiscoveryResource[] = [];
      const summary = {
        totalResources: 0,
        resourcesByType: {} as Record<string, number>,
        resourcesByRegion: {} as Record<string, number>
      };

      // Scan each region
      for (const region of regions) {
        console.log(`📡 Scanning region: ${region}`);
        const regionResources = await this.scanRegionResources(
          awsIntegration.roleArn,
          awsIntegration.externalId!,
          region
        );

        allResources = allResources.concat(regionResources);
        summary.resourcesByRegion[region] = regionResources.length;
      }

      // Save discovered resources
      if (allResources.length > 0) {
        const resourcesForDb = allResources.map(resource => ({
          sessionId,
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
          name: resource.name,
          region: resource.region,
          provider: resource.provider,
          tags: resource.tags,
          metadata: resource.metadata
        }));

        await db.insert(discoveryResources).values(resourcesForDb);
      }

      // Update summary statistics
      summary.totalResources = allResources.length;
      allResources.forEach(resource => {
        summary.resourcesByType[resource.resourceType] = 
          (summary.resourcesByType[resource.resourceType] || 0) + 1;
      });

      // Update session status
      await db
        .update(discoverySession)
        .set({
          status: 'completed',
          resourceCount: allResources.length,
          metadata: {
            ...sessionResult[0].metadata,
            completedAt: new Date().toISOString(),
            summary
          },
          updatedAt: new Date()
        })
        .where(eq(discoverySession.id, sessionId));

      console.log(`✅ Discovery completed: ${allResources.length} resources found`);

      return {
        sessionId,
        resources: allResources,
        summary
      };

    } catch (error) {
      // Update session with error status
      await db
        .update(discoverySession)
        .set({
          status: 'failed',
          metadata: {
            ...sessionResult[0].metadata,
            failedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          updatedAt: new Date()
        })
        .where(eq(discoverySession.id, sessionId));

      throw error;
    }
  }

  /**
   * Scan resources in a specific AWS region
   */
  private async scanRegionResources(
    roleArn: string,
    externalId: string,
    region: string
  ): Promise<DiscoveryResource[]> {
    const resources: DiscoveryResource[] = [];

    try {
      // Get AWS credentials using test connection which internally assumes role
      const testResult = await this.awsService.testConnection(roleArn, externalId);
      if (!testResult.success) {
        throw new Error(`Failed to assume AWS role: ${testResult.error}`);
      }

      // We need to assume the role again to get credentials for scanning
      // This is a limitation since assumeRole is private, we'll need to expose it or add a method
      const credentials = await this.getAWSCredentials(roleArn, externalId);
      if (!credentials) {
        throw new Error('Failed to get AWS credentials');
      }

      const awsConfig = {
        region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      };

      // Scan EC2 instances
      await this.scanEC2Instances(awsConfig, region, resources);

      // Scan VPCs
      await this.scanVPCs(awsConfig, region, resources);

      // Scan Security Groups
      await this.scanSecurityGroups(awsConfig, region, resources);

      // Scan Subnets
      await this.scanSubnets(awsConfig, region, resources);

      // Scan S3 buckets (region-agnostic but we'll check location)
      if (region === 'us-east-1') { // Only scan S3 once
        await this.scanS3Buckets(awsConfig, region, resources);
      }

      // Scan RDS instances
      await this.scanRDSInstances(awsConfig, region, resources);

      // Scan Lambda functions
      await this.scanLambdaFunctions(awsConfig, region, resources);

      // Scan IAM roles (only in us-east-1 as it's global)
      if (region === 'us-east-1') {
        await this.scanIAMRoles(awsConfig, region, resources);
      }

      // Scan Load Balancers
      await this.scanLoadBalancers(awsConfig, region, resources);

    } catch (error) {
      console.error(`❌ Error scanning region ${region}:`, error);
      // Continue with other regions even if one fails
    }

    return resources;
  }

  /**
   * Scan EC2 instances
   */
  private async scanEC2Instances(awsConfig: any, region: string, resources: DiscoveryResource[]): Promise<void> {
    try {
      const ec2Client = new EC2Client(awsConfig);
      const command = new DescribeInstancesCommand({});
      const response = await ec2Client.send(command);

      for (const reservation of response.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          const nameTag = instance.Tags?.find(tag => tag.Key === 'Name');
          const tags: Record<string, string> = {};
          
          instance.Tags?.forEach(tag => {
            if (tag.Key && tag.Value) {
              tags[tag.Key] = tag.Value;
            }
          });

          resources.push({
            id: `aws-ec2-${instance.InstanceId}-${region}`,
            resourceType: 'aws::ec2::instance',
            resourceId: instance.InstanceId!,
            name: nameTag?.Value || instance.InstanceId!,
            region,
            provider: 'aws',
            tags,
            metadata: {
              instanceType: instance.InstanceType,
              state: instance.State?.Name,
              publicIp: instance.PublicIpAddress,
              privateIp: instance.PrivateIpAddress,
              vpcId: instance.VpcId,
              subnetId: instance.SubnetId,
              imageId: instance.ImageId,
              keyName: instance.KeyName,
              launchTime: instance.LaunchTime?.toISOString()
            }
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning EC2 instances in ${region}:`, error);
    }
  }

  /**
   * Scan VPCs
   */
  private async scanVPCs(awsConfig: any, region: string, resources: DiscoveryResource[]): Promise<void> {
    try {
      const ec2Client = new EC2Client(awsConfig);
      const command = new DescribeVpcsCommand({});
      const response = await ec2Client.send(command);

      for (const vpc of response.Vpcs || []) {
        const nameTag = vpc.Tags?.find(tag => tag.Key === 'Name');
        const tags: Record<string, string> = {};
        
        vpc.Tags?.forEach(tag => {
          if (tag.Key && tag.Value) {
            tags[tag.Key] = tag.Value;
          }
        });

        resources.push({
          id: `aws-vpc-${vpc.VpcId}-${region}`,
          resourceType: 'aws::ec2::vpc',
          resourceId: vpc.VpcId!,
          name: nameTag?.Value || vpc.VpcId!,
          region,
          provider: 'aws',
          tags,
          metadata: {
            cidrBlock: vpc.CidrBlock,
            state: vpc.State,
            isDefault: vpc.IsDefault,
            dhcpOptionsId: vpc.DhcpOptionsId,
            instanceTenancy: vpc.InstanceTenancy
          }
        });
      }
    } catch (error) {
      console.error(`Error scanning VPCs in ${region}:`, error);
    }
  }

  /**
   * Scan Security Groups
   */
  private async scanSecurityGroups(awsConfig: any, region: string, resources: DiscoveryResource[]): Promise<void> {
    try {
      const ec2Client = new EC2Client(awsConfig);
      const command = new DescribeSecurityGroupsCommand({});
      const response = await ec2Client.send(command);

      for (const sg of response.SecurityGroups || []) {
        const tags: Record<string, string> = {};
        
        sg.Tags?.forEach(tag => {
          if (tag.Key && tag.Value) {
            tags[tag.Key] = tag.Value;
          }
        });

        resources.push({
          id: `aws-sg-${sg.GroupId}-${region}`,
          resourceType: 'aws::ec2::security-group',
          resourceId: sg.GroupId!,
          name: sg.GroupName!,
          region,
          provider: 'aws',
          tags,
          metadata: {
            description: sg.Description,
            vpcId: sg.VpcId,
            ownerId: sg.OwnerId,
            inboundRules: sg.IpPermissions?.length || 0,
            outboundRules: sg.IpPermissionsEgress?.length || 0
          }
        });
      }
    } catch (error) {
      console.error(`Error scanning Security Groups in ${region}:`, error);
    }
  }

  /**
   * Scan Subnets
   */
  private async scanSubnets(awsConfig: any, region: string, resources: DiscoveryResource[]): Promise<void> {
    try {
      const ec2Client = new EC2Client(awsConfig);
      const command = new DescribeSubnetsCommand({});
      const response = await ec2Client.send(command);

      for (const subnet of response.Subnets || []) {
        const nameTag = subnet.Tags?.find(tag => tag.Key === 'Name');
        const tags: Record<string, string> = {};
        
        subnet.Tags?.forEach(tag => {
          if (tag.Key && tag.Value) {
            tags[tag.Key] = tag.Value;
          }
        });

        resources.push({
          id: `aws-subnet-${subnet.SubnetId}-${region}`,
          resourceType: 'aws::ec2::subnet',
          resourceId: subnet.SubnetId!,
          name: nameTag?.Value || subnet.SubnetId!,
          region,
          provider: 'aws',
          tags,
          metadata: {
            cidrBlock: subnet.CidrBlock,
            vpcId: subnet.VpcId,
            availabilityZone: subnet.AvailabilityZone,
            state: subnet.State,
            mapPublicIpOnLaunch: subnet.MapPublicIpOnLaunch,
            availableIpAddressCount: subnet.AvailableIpAddressCount
          }
        });
      }
    } catch (error) {
      console.error(`Error scanning Subnets in ${region}:`, error);
    }
  }

  /**
   * Scan S3 buckets
   */
  private async scanS3Buckets(awsConfig: any, region: string, resources: DiscoveryResource[]): Promise<void> {
    try {
      const s3Client = new S3Client({ ...awsConfig, region: 'us-east-1' }); // S3 is global
      const command = new ListBucketsCommand({});
      const response = await s3Client.send(command);

      for (const bucket of response.Buckets || []) {
        try {
          // Get bucket location
          const locationResponse = await s3Client.send(
            new GetBucketLocationCommand({ Bucket: bucket.Name })
          );
          const bucketRegion = locationResponse.LocationConstraint || 'us-east-1';

          resources.push({
            id: `aws-s3-${bucket.Name}-${bucketRegion}`,
            resourceType: 'aws::s3::bucket',
            resourceId: bucket.Name!,
            name: bucket.Name!,
            region: bucketRegion,
            provider: 'aws',
            tags: {}, // S3 bucket tags require separate API call
            metadata: {
              creationDate: bucket.CreationDate?.toISOString()
            }
          });
        } catch (bucketError) {
          console.error(`Error getting S3 bucket details for ${bucket.Name}:`, bucketError);
        }
      }
    } catch (error) {
      console.error(`Error scanning S3 buckets:`, error);
    }
  }

  /**
   * Scan RDS instances
   */
  private async scanRDSInstances(awsConfig: any, region: string, resources: DiscoveryResource[]): Promise<void> {
    try {
      const rdsClient = new RDSClient(awsConfig);
      const command = new DescribeDBInstancesCommand({});
      const response = await rdsClient.send(command);

      for (const dbInstance of response.DBInstances || []) {
        const tags: Record<string, string> = {};
        
        // RDS tags would need separate API call
        resources.push({
          id: `aws-rds-${dbInstance.DBInstanceIdentifier}-${region}`,
          resourceType: 'aws::rds::instance',
          resourceId: dbInstance.DBInstanceIdentifier!,
          name: dbInstance.DBInstanceIdentifier!,
          region,
          provider: 'aws',
          tags,
          metadata: {
            engine: dbInstance.Engine,
            engineVersion: dbInstance.EngineVersion,
            dbInstanceClass: dbInstance.DBInstanceClass,
            allocatedStorage: dbInstance.AllocatedStorage,
            dbInstanceStatus: dbInstance.DBInstanceStatus,
            endpoint: dbInstance.Endpoint?.Address,
            port: dbInstance.Endpoint?.Port,
            multiAZ: dbInstance.MultiAZ,
            vpcSecurityGroups: dbInstance.VpcSecurityGroups?.map(sg => sg.VpcSecurityGroupId)
          }
        });
      }
    } catch (error) {
      console.error(`Error scanning RDS instances in ${region}:`, error);
    }
  }

  /**
   * Scan Lambda functions
   */
  private async scanLambdaFunctions(awsConfig: any, region: string, resources: DiscoveryResource[]): Promise<void> {
    try {
      const lambdaClient = new LambdaClient(awsConfig);
      const command = new ListFunctionsCommand({});
      const response = await lambdaClient.send(command);

      for (const func of response.Functions || []) {
        resources.push({
          id: `aws-lambda-${func.FunctionName}-${region}`,
          resourceType: 'aws::lambda::function',
          resourceId: func.FunctionName!,
          name: func.FunctionName!,
          region,
          provider: 'aws',
          tags: {}, // Lambda tags would need separate API call
          metadata: {
            runtime: func.Runtime,
            handler: func.Handler,
            codeSize: func.CodeSize,
            timeout: func.Timeout,
            memorySize: func.MemorySize,
            lastModified: func.LastModified,
            version: func.Version,
            role: func.Role
          }
        });
      }
    } catch (error) {
      console.error(`Error scanning Lambda functions in ${region}:`, error);
    }
  }

  /**
   * Scan IAM roles
   */
  private async scanIAMRoles(awsConfig: any, region: string, resources: DiscoveryResource[]): Promise<void> {
    try {
      const iamClient = new IAMClient({ ...awsConfig, region: 'us-east-1' }); // IAM is global
      const command = new ListRolesCommand({ MaxItems: 100 });
      const response = await iamClient.send(command);

      for (const role of response.Roles || []) {
        resources.push({
          id: `aws-iam-role-${role.RoleName}-global`,
          resourceType: 'aws::iam::role',
          resourceId: role.RoleName!,
          name: role.RoleName!,
          region: 'global',
          provider: 'aws',
          tags: {}, // IAM role tags would need separate API call
          metadata: {
            arn: role.Arn,
            path: role.Path,
            createDate: role.CreateDate?.toISOString(),
            description: role.Description,
            maxSessionDuration: role.MaxSessionDuration
          }
        });
      }
    } catch (error) {
      console.error(`Error scanning IAM roles:`, error);
    }
  }

  /**
   * Scan Load Balancers
   */
  private async scanLoadBalancers(awsConfig: any, region: string, resources: DiscoveryResource[]): Promise<void> {
    try {
      const elbClient = new ElasticLoadBalancingV2Client(awsConfig);
      const command = new DescribeLoadBalancersCommand({});
      const response = await elbClient.send(command);

      for (const lb of response.LoadBalancers || []) {
        resources.push({
          id: `aws-elb-${lb.LoadBalancerName}-${region}`,
          resourceType: 'aws::elb::load-balancer',
          resourceId: lb.LoadBalancerArn!,
          name: lb.LoadBalancerName!,
          region,
          provider: 'aws',
          tags: {}, // ELB tags would need separate API call
          metadata: {
            arn: lb.LoadBalancerArn,
            type: lb.Type,
            scheme: lb.Scheme,
            vpcId: lb.VpcId,
            state: lb.State?.Code,
            dnsName: lb.DNSName,
            canonicalHostedZoneId: lb.CanonicalHostedZoneId,
            createdTime: lb.CreatedTime?.toISOString(),
            availabilityZones: lb.AvailabilityZones?.map((az: any) => az.ZoneName)
          }
        });
      }
    } catch (error) {
      console.error(`Error scanning Load Balancers in ${region}:`, error);
    }
  }

  /**
   * Generate Infrastructure as Code from selected resources
   */
  async generateInfrastructureCode(
    organizationId: string,
    resources: DiscoveryResource[],
    provider: string = 'opentofu'
  ): Promise<GeneratedCode & { sessionId?: string }> {
    console.log(`🏗️ Generating ${provider} code for ${resources.length} resources`);

    // Generate traditional single-file approach (backward compatibility)
    const terraform = this.generateTerraformCode(resources);
    const statefile = this.generateStateFile(resources);

    // Generate modular project structure
    console.log('🔧 About to generate modular project...');
    const modularProject = this.moduleGenerator.generateModularProject(
      resources, 
      `pulse-infrastructure-${organizationId.split('-')[0]}`
    );
    
    console.log('📁 Generated modular project with files:', Object.keys(modularProject.files));
    console.log('📊 File count:', Object.keys(modularProject.files).length);

    const result = {
      terraform,
      statefile,
      modular: {
        files: modularProject.files,
        structure: modularProject.structure
      }
    };
    
    console.log('📤 Returning result with keys:', Object.keys(result));
    console.log('📤 Modular property exists:', !!result.modular);
    
    // Skip saving session for generated code since it doesn't have a valid integration
    // TODO: Create a separate table for generated code sessions if needed
    let sessionId = null;
    
    try {
      // For now, skip saving code generations too since we don't have sessionId
      // This prevents the UUID errors but means no URL sharing for generated code
      
      return { ...result, sessionId: undefined };
    } catch (err) {
      console.error('Error saving session:', err);
      return result;
    }
  }

  /**
   * Generate Terraform/OpenTofu configuration code
   */
  private generateTerraformCode(resources: DiscoveryResource[]): string {
    let terraformCode = '';

    // Group resources by type for better organization
    const resourcesByType = resources.reduce((acc, resource) => {
      const type = resource.resourceType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(resource);
      return acc;
    }, {} as Record<string, DiscoveryResource[]>);

    // Generate provider configuration
    terraformCode += `# Generated Infrastructure as Code
# Platform: Pulse (formerly ConfigMaster)
# Generated at: ${new Date().toISOString()}

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1" # Update this to your preferred region
}

`;

    // Generate data sources and resources for each type
    for (const [resourceType, resourceList] of Object.entries(resourcesByType)) {
      terraformCode += `# ${resourceType.toUpperCase()} Resources\n`;
      
      for (const resource of resourceList) {
        const terraformResource = this.convertToTerraformResource(resource);
        terraformCode += terraformResource + '\n\n';
      }
    }

    return terraformCode;
  }

  /**
   * Convert a discovered resource to Terraform resource configuration
   */
  private convertToTerraformResource(resource: DiscoveryResource): string {
    const resourceName = this.sanitizeResourceName(resource.name);
    
    switch (resource.resourceType) {
      case 'aws::ec2::instance':
        return this.generateEC2InstanceResource(resource, resourceName);
      case 'aws::ec2::vpc':
        return this.generateVPCResource(resource, resourceName);
      case 'aws::ec2::subnet':
        return this.generateSubnetResource(resource, resourceName);
      case 'aws::ec2::security-group':
        return this.generateSecurityGroupResource(resource, resourceName);
      case 'aws::s3::bucket':
        return this.generateS3BucketResource(resource, resourceName);
      case 'aws::rds::instance':
        return this.generateRDSInstanceResource(resource, resourceName);
      case 'aws::lambda::function':
        return this.generateLambdaFunctionResource(resource, resourceName);
      case 'aws::iam::role':
        return this.generateIAMRoleResource(resource, resourceName);
      case 'aws::elb::load-balancer':
        return this.generateLoadBalancerResource(resource, resourceName);
      default:
        return `# Unsupported resource type: ${resource.resourceType}\n# Resource ID: ${resource.resourceId}`;
    }
  }

  private generateEC2InstanceResource(resource: DiscoveryResource, resourceName: string): string {
    return `resource "aws_instance" "${resourceName}" {
  # Imported from existing instance: ${resource.resourceId}
  ami           = "${resource.metadata.imageId || 'ami-placeholder'}"
  instance_type = "${resource.metadata.instanceType || 't3.micro'}"
  ${resource.metadata.keyName ? `key_name      = "${resource.metadata.keyName}"` : ''}
  ${resource.metadata.subnetId ? `subnet_id     = "${resource.metadata.subnetId}"` : ''}

  tags = {
${Object.entries(resource.tags).map(([key, value]) => `    "${key}" = "${value}"`).join('\n')}
  }
}`;
  }

  private generateVPCResource(resource: DiscoveryResource, resourceName: string): string {
    return `resource "aws_vpc" "${resourceName}" {
  # Imported from existing VPC: ${resource.resourceId}
  cidr_block           = "${resource.metadata.cidrBlock || '10.0.0.0/16'}"
  instance_tenancy     = "${resource.metadata.instanceTenancy || 'default'}"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
${Object.entries(resource.tags).map(([key, value]) => `    "${key}" = "${value}"`).join('\n')}
  }
}`;
  }

  private generateSubnetResource(resource: DiscoveryResource, resourceName: string): string {
    return `resource "aws_subnet" "${resourceName}" {
  # Imported from existing subnet: ${resource.resourceId}
  vpc_id                  = "${resource.metadata.vpcId}"
  cidr_block              = "${resource.metadata.cidrBlock}"
  availability_zone       = "${resource.metadata.availabilityZone}"
  map_public_ip_on_launch = ${resource.metadata.mapPublicIpOnLaunch || false}

  tags = {
${Object.entries(resource.tags).map(([key, value]) => `    "${key}" = "${value}"`).join('\n')}
  }
}`;
  }

  private generateSecurityGroupResource(resource: DiscoveryResource, resourceName: string): string {
    return `resource "aws_security_group" "${resourceName}" {
  # Imported from existing security group: ${resource.resourceId}
  name        = "${resource.name}"
  description = "${resource.metadata.description || 'Imported security group'}"
  ${resource.metadata.vpcId ? `vpc_id      = "${resource.metadata.vpcId}"` : ''}

  # Note: Ingress and egress rules need to be defined separately
  # Original rules count: ${resource.metadata.inboundRules} ingress, ${resource.metadata.outboundRules} egress

  tags = {
${Object.entries(resource.tags).map(([key, value]) => `    "${key}" = "${value}"`).join('\n')}
  }
}`;
  }

  private generateS3BucketResource(resource: DiscoveryResource, resourceName: string): string {
    return `resource "aws_s3_bucket" "${resourceName}" {
  # Imported from existing S3 bucket: ${resource.resourceId}
  bucket = "${resource.resourceId}"

  tags = {
${Object.entries(resource.tags).map(([key, value]) => `    "${key}" = "${value}"`).join('\n')}
  }
}`;
  }

  private generateRDSInstanceResource(resource: DiscoveryResource, resourceName: string): string {
    return `resource "aws_db_instance" "${resourceName}" {
  # Imported from existing RDS instance: ${resource.resourceId}
  identifier     = "${resource.resourceId}"
  engine         = "${resource.metadata.engine}"
  engine_version = "${resource.metadata.engineVersion}"
  instance_class = "${resource.metadata.dbInstanceClass}"
  allocated_storage = ${resource.metadata.allocatedStorage}
  
  # These values need to be set for import to work
  db_name  = "placeholder"  # Update with actual database name
  username = "placeholder"  # Update with actual username
  password = "placeholder"  # Update with actual password
  
  skip_final_snapshot = true

  tags = {
${Object.entries(resource.tags).map(([key, value]) => `    "${key}" = "${value}"`).join('\n')}
  }
}`;
  }

  private generateLambdaFunctionResource(resource: DiscoveryResource, resourceName: string): string {
    return `resource "aws_lambda_function" "${resourceName}" {
  # Imported from existing Lambda function: ${resource.resourceId}
  function_name = "${resource.resourceId}"
  role         = "${resource.metadata.role}"
  handler      = "${resource.metadata.handler}"
  runtime      = "${resource.metadata.runtime}"
  timeout      = ${resource.metadata.timeout || 3}
  memory_size  = ${resource.metadata.memorySize || 128}
  
  # Code source needs to be specified
  filename         = "placeholder.zip"  # Update with actual code source
  source_code_hash = "placeholder"      # Update with actual hash

  tags = {
${Object.entries(resource.tags).map(([key, value]) => `    "${key}" = "${value}"`).join('\n')}
  }
}`;
  }

  private generateIAMRoleResource(resource: DiscoveryResource, resourceName: string): string {
    return `resource "aws_iam_role" "${resourceName}" {
  # Imported from existing IAM role: ${resource.resourceId}
  name = "${resource.resourceId}"
  path = "${resource.metadata.path || '/'}"
  
  # Trust policy needs to be specified
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"  # Update based on actual trust policy
        }
      }
    ]
  })

  tags = {
${Object.entries(resource.tags).map(([key, value]) => `    "${key}" = "${value}"`).join('\n')}
  }
}`;
  }

  private generateLoadBalancerResource(resource: DiscoveryResource, resourceName: string): string {
    return `resource "aws_lb" "${resourceName}" {
  # Imported from existing load balancer: ${resource.resourceId}
  name               = "${resource.name}"
  load_balancer_type = "${resource.metadata.type || 'application'}"
  scheme             = "${resource.metadata.scheme || 'internet-facing'}"
  
  # Subnets need to be specified based on availability zones
  # subnets = [subnet1, subnet2]  # Update with actual subnet IDs

  tags = {
${Object.entries(resource.tags).map(([key, value]) => `    "${key}" = "${value}"`).join('\n')}
  }
}`;
  }

  /**
   * Generate Terraform state file for importing existing resources
   */
  private generateStateFile(resources: DiscoveryResource[]): any {
    const stateFile = {
      version: 4,
      terraform_version: "1.5.0",
      serial: 1,
      lineage: `imported-${Date.now()}`,
      outputs: {},
      resources: [] as any[]
    };

    for (const resource of resources) {
      const resourceName = this.sanitizeResourceName(resource.name);
      const terraformType = this.getTerraformResourceType(resource.resourceType);
      
      if (terraformType) {
        stateFile.resources.push({
          mode: "managed",
          type: terraformType,
          name: resourceName,
          provider: "provider[\"registry.terraform.io/hashicorp/aws\"]",
          instances: [
            {
              schema_version: 1,
              attributes: this.getResourceAttributes(resource),
              sensitive_attributes: [],
              private: "placeholder"
            }
          ]
        });
      }
    }

    return stateFile;
  }

  private getTerraformResourceType(resourceType: string): string | null {
    const typeMapping: Record<string, string> = {
      'aws::ec2::instance': 'aws_instance',
      'aws::ec2::vpc': 'aws_vpc',
      'aws::ec2::subnet': 'aws_subnet',
      'aws::ec2::security-group': 'aws_security_group',
      'aws::s3::bucket': 'aws_s3_bucket',
      'aws::rds::instance': 'aws_db_instance',
      'aws::lambda::function': 'aws_lambda_function',
      'aws::iam::role': 'aws_iam_role',
      'aws::elb::load-balancer': 'aws_lb'
    };
    
    return typeMapping[resourceType] || null;
  }

  private getResourceAttributes(resource: DiscoveryResource): any {
    // Basic attributes that all resources should have
    const baseAttributes = {
      id: resource.resourceId,
      tags: resource.tags,
      tags_all: resource.tags,
      ...resource.metadata
    };

    return baseAttributes;
  }

  private sanitizeResourceName(name: string): string {
    // Convert name to valid Terraform resource name
    return name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^[0-9]/, 'resource_$&')
      .toLowerCase();
  }

  /**
   * Get discovery sessions for organization
   */
  async getDiscoverySessions(organizationId: string) {
    return db
      .select()
      .from(discoverySession)
      .where(eq(discoverySession.organizationId, organizationId))
      .orderBy(discoverySession.createdAt);
  }

  /**
   * Get specific discovery session with resources
   */
  async getDiscoverySession(organizationId: string, sessionId: string) {
    const session = await db
      .select()
      .from(discoverySession)
      .where(and(
        eq(discoverySession.id, sessionId),
        eq(discoverySession.organizationId, organizationId)
      ))
      .limit(1);

    if (!session.length) {
      return null;
    }

    const resources = await db
      .select()
      .from(discoveryResources)
      .where(eq(discoveryResources.sessionId, sessionId));

    // Get generated code if exists
    const codeGeneration = await db
      .select()
      .from(discoveryCodeGenerations)
      .where(eq(discoveryCodeGenerations.sessionId, sessionId))
      .limit(1);

    return {
      ...session[0],
      resources,
      generatedCode: codeGeneration.length > 0 ? {
        terraform: codeGeneration[0].terraformCode,
        statefile: codeGeneration[0].stateFile,
        modular: null // We'll reconstruct this if needed
      } : null
    };
  }

  /**
   * Delete discovery session and resources
   */
  async deleteDiscoverySession(organizationId: string, sessionId: string) {
    // Verify session belongs to organization
    const session = await db
      .select()
      .from(discoverySession)
      .where(and(
        eq(discoverySession.id, sessionId),
        eq(discoverySession.organizationId, organizationId)
      ))
      .limit(1);

    if (!session.length) {
      throw new Error('Discovery session not found');
    }

    // Delete resources first (foreign key constraint)
    await db.delete(discoveryResources).where(eq(discoveryResources.sessionId, sessionId));
    
    // Delete session
    await db.delete(discoverySession).where(eq(discoverySession.id, sessionId));
  }

  /**
   * Regenerate code for existing session with new resource selection
   */
  async regenerateCode(
    organizationId: string,
    sessionId: string,
    selectedResourceIds: string[],
    provider: string = 'opentofu'
  ): Promise<GeneratedCode> {
    const session = await this.getDiscoverySession(organizationId, sessionId);
    
    if (!session) {
      throw new Error('Discovery session not found');
    }

    const selectedResources = session.resources.filter(r => 
      selectedResourceIds.includes(r.id)
    ).map(r => ({
      id: r.id,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      name: r.name,
      region: r.region,
      provider: r.provider,
      tags: r.tags || {},
      metadata: r.metadata
    }));

    return this.generateInfrastructureCode(organizationId, selectedResources, provider);
  }

  /**
   * Get AWS credentials by assuming role - wrapper around AWSService
   */
  private async getAWSCredentials(roleArn: string, externalId: string): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  } | null> {
    const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts');
    
    try {
      const stsClient = new STSClient({ region: 'us-east-1' });
      
      const command = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `DiscoverySession-${Date.now()}`,
        ExternalId: externalId,
        DurationSeconds: 3600, // 1 hour
      });

      const response = await stsClient.send(command);
      
      if (!response.Credentials) {
        throw new Error('No credentials returned from assume role');
      }

      return {
        accessKeyId: response.Credentials.AccessKeyId!,
        secretAccessKey: response.Credentials.SecretAccessKey!,
        sessionToken: response.Credentials.SessionToken!
      };

    } catch (error) {
      console.error('❌ Failed to assume AWS role for discovery:', error);
      return null;
    }
  }

  /**
   * Push generated Infrastructure as Code to GitHub repository
   */
  async pushToGitHub(params: {
    organizationId: string;
    integrationId: string;
    generatedCode: any;
    repositoryPath: string;
    branchName: string;
    commitMessage: string;
    createPullRequest: boolean;
    resources: DiscoveryResource[];
  }) {
    try {
      // Get GitHub integration
      const integration = await githubService.getGitHubIntegration(params.integrationId, params.organizationId);
      if (!integration) {
        throw new Error('GitHub integration not found');
      }

      const [owner, repo] = integration.repositoryFullName.split('/');
      const accessToken = integration.accessToken;

      // Create a new branch if it doesn't exist
      try {
        await githubService.createBranch(
          accessToken,
          owner,
          repo,
          params.branchName,
          integration.defaultBranch
        );
      } catch (error) {
        // Branch might already exist, continue
        console.log('Branch might already exist:', error);
      }

      const filesToPush: { path: string; content: string }[] = [];
      const results: any[] = [];

      if (params.generatedCode.modular && params.generatedCode.modular.files) {
        // Push modular files
        for (const [filePath, content] of Object.entries(params.generatedCode.modular.files)) {
          filesToPush.push({
            path: `${params.repositoryPath}/${filePath}`,
            content: content as string
          });
        }
      } else {
        // Push legacy single files
        filesToPush.push(
          {
            path: `${params.repositoryPath}/infrastructure.tf`,
            content: params.generatedCode.terraform
          },
          {
            path: `${params.repositoryPath}/terraform.tfstate`,
            content: JSON.stringify(params.generatedCode.statefile, null, 2)
          }
        );
      }

      // Add a README for the infrastructure
      const readmeContent = this.generateInfrastructureReadme(params.resources, params.generatedCode.modular ? 'modular' : 'single');
      filesToPush.push({
        path: `${params.repositoryPath}/README.md`,
        content: readmeContent
      });

      // Push all files to GitHub
      for (const file of filesToPush) {
        try {
          const result = await githubService.createOrUpdateFile(
            accessToken,
            owner,
            repo,
            file.path,
            file.content,
            `${params.commitMessage} - ${file.path}`,
            params.branchName
          );
          results.push({ path: file.path, ...result });
        } catch (error) {
          console.error(`Error pushing file ${file.path}:`, error);
          results.push({ path: file.path, error: (error as Error).message });
        }
      }

      let pullRequestUrl = null;
      if (params.createPullRequest) {
        try {
          const pr = await githubService.createPullRequest(
            accessToken,
            owner,
            repo,
            {
              title: `Infrastructure Discovery: Add ${params.resources.length} resources`,
              head: params.branchName,
              base: integration.defaultBranch,
              body: `## Infrastructure Discovery Results

This pull request adds Infrastructure as Code for ${params.resources.length} discovered cloud resources.

### Generated Resources:
${params.resources.map(r => `- **${r.name}** (${r.resourceType}) in ${r.region}`).join('\n')}

### Files Added:
${results.map(r => `- \`${r.path}\``).join('\n')}

Generated by Pulse Infrastructure Discovery 🚀`,
              draft: false
            }
          );
          pullRequestUrl = pr.html_url;
        } catch (error) {
          console.error('Error creating pull request:', error);
        }
      }

      return {
        branchName: params.branchName,
        repositoryUrl: `https://github.com/${integration.repositoryFullName}`,
        branchUrl: `https://github.com/${integration.repositoryFullName}/tree/${params.branchName}`,
        pullRequestUrl,
        filesUploaded: results.filter(r => !r.error).length,
        totalFiles: filesToPush.length,
        results
      };

    } catch (error) {
      console.error('Error pushing to GitHub:', error);
      throw new Error(`Failed to push to GitHub: ${(error as Error).message}`);
    }
  }

  /**
   * Generate README for infrastructure repository
   */
  private generateInfrastructureReadme(resources: DiscoveryResource[], format: 'modular' | 'single'): string {
    const resourceSummary = resources.reduce((acc: Record<string, number>, resource) => {
      acc[resource.resourceType] = (acc[resource.resourceType] || 0) + 1;
      return acc;
    }, {});

    const resourcesList = Object.entries(resourceSummary)
      .map(([type, count]) => `- **${type}**: ${count} resource${count > 1 ? 's' : ''}`)
      .join('\n');

    return `# Infrastructure as Code

Generated by Pulse Infrastructure Discovery on ${new Date().toISOString()}

## Overview

This repository contains Infrastructure as Code for ${resources.length} cloud resources discovered and converted to OpenTofu/Terraform configuration.

## Resources

${resourcesList}

## Structure

${format === 'modular' ? `This infrastructure uses a modular approach:

\`\`\`
infrastructure/
├── main.tf              # Main configuration and module calls
├── variables.tf         # Input variables
├── outputs.tf           # Output values
├── terraform.tf         # Provider configuration
├── *.tfvars            # Environment-specific variables
└── modules/            # Resource modules
    ├── ec2_instances/
    ├── s3_buckets/
    ├── rds_instances/
    └── ...
\`\`\`

Each module is self-contained with its own variables, resources, and outputs.` : `This infrastructure uses a single-file approach:

\`\`\`
infrastructure/
├── infrastructure.tf    # All resources and configuration
└── terraform.tfstate   # State file for importing existing resources
\`\`\``}

## Usage

1. **Initialize Terraform:**
   \`\`\`bash
   cd infrastructure/
   tofu init
   \`\`\`

2. **Review the plan:**
   \`\`\`bash
   tofu plan
   \`\`\`

3. **Import existing resources** (if managing existing infrastructure):
   \`\`\`bash
   # Review the import commands in the generated scripts
   # Run import commands for each resource
   \`\`\`

4. **Apply the configuration:**
   \`\`\`bash
   tofu apply
   \`\`\`

## Important Notes

- **Review before applying**: This configuration was generated from existing resources. Review all settings before applying.
- **State management**: Consider using remote state storage for team collaboration.
- **Security**: Ensure sensitive values are properly managed using variables or secret management.

## Generated Resources

| Resource | Type | Region |
|----------|------|--------|
${resources.map(r => `| ${r.name} | ${r.resourceType} | ${r.region} |`).join('\n')}

---
*Generated with ❤️ by [Pulse](https://pulse.dev) Infrastructure Discovery*
`;
  }
}