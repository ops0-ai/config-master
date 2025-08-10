import { 
  EC2Client, 
  DescribeInstancesCommand, 
  DescribeRegionsCommand,
  Instance as EC2Instance
} from '@aws-sdk/client-ec2';
import { 
  STSClient, 
  AssumeRoleCommand, 
  GetCallerIdentityCommand 
} from '@aws-sdk/client-sts';
import { db } from '../index';
import { awsIntegrations, awsInstances } from '@config-management/database';
import { eq } from 'drizzle-orm';

interface AssumeRoleCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration?: Date;
}

interface AWSInstance {
  instanceId: string;
  region: string;
  name?: string;
  state: string;
  instanceType?: string;
  publicIp?: string;
  privateIp?: string;
  publicDns?: string;
  privateDns?: string;
  keyName?: string;
  vpcId?: string;
  subnetId?: string;
  securityGroups: any[];
  tags: Record<string, string>;
  platform?: string;
  launchTime?: Date;
  metadata: any;
}

export class AWSService {
  private credentials: AssumeRoleCredentials | null = null;
  private credentialsExpiry: Date | null = null;

  /**
   * Get all available AWS regions
   */
  async getAvailableRegions(): Promise<string[]> {
    try {
      // Use a basic client to get regions (no credentials needed for this)
      const ec2Client = new EC2Client({ region: 'us-east-1' });
      const command = new DescribeRegionsCommand({});
      const response = await ec2Client.send(command);
      
      return response.Regions?.map(region => region.RegionName!).filter(Boolean) || [];
    } catch (error) {
      console.error('Error fetching AWS regions:', error);
      // Return common regions as fallback
      return [
        'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
        'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
        'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-south-1'
      ];
    }
  }

  /**
   * Test AWS connection by assuming the role
   */
  async testConnection(roleArn: string, externalId: string): Promise<{
    success: boolean;
    identity?: any;
    error?: string;
  }> {
    try {
      console.log('🔐 Testing AWS connection with assume role...');
      
      const credentials = await this.assumeRole(roleArn, externalId);
      if (!credentials) {
        return { success: false, error: 'Failed to assume role' };
      }

      // Test the credentials by getting caller identity
      const stsClient = new STSClient({
        region: 'us-east-1',
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
        }
      });

      const identityCommand = new GetCallerIdentityCommand({});
      const identity = await stsClient.send(identityCommand);

      console.log('✅ AWS connection successful');
      console.log('👤 Identity:', identity.Arn);

      return {
        success: true,
        identity: {
          arn: identity.Arn,
          userId: identity.UserId,
          account: identity.Account
        }
      };

    } catch (error) {
      console.error('❌ AWS connection test failed:', error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide more specific error messages
        if (errorMessage.includes('is not authorized to perform: sts:AssumeRole')) {
          errorMessage = `❌ AssumeRole Permission Denied: The current AWS user/role does not have permission to assume the target role. Please check:
1. The Trust Policy of the target role includes your current AWS principal (arn:aws:iam::359375618857:user/ops0-user)
2. Your current AWS credentials have sts:AssumeRole permission
3. The External ID matches exactly
4. The role ARN is correct`;
        } else if (errorMessage.includes('No credentials')) {
          errorMessage = 'AWS credentials not configured. Please set up AWS credentials in your environment.';
        } else if (errorMessage.includes('InvalidUserID.NotFound')) {
          errorMessage = 'AWS user or role not found. Please check the trust policy configuration.';
        } else if (errorMessage.includes('ValidationError')) {
          errorMessage = 'Invalid role ARN format. Please check the role ARN is correct.';
        }
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Assume role and get temporary credentials
   */
  private async assumeRole(roleArn: string, externalId: string): Promise<AssumeRoleCredentials | null> {
    try {
      // Check if we have valid cached credentials
      if (this.credentials && this.credentialsExpiry && new Date() < this.credentialsExpiry) {
        console.log('🔄 Using cached AWS credentials');
        return this.credentials;
      }

      console.log('🔑 Assuming AWS role:', roleArn);
      
      const stsClient = new STSClient({ region: 'us-east-1' });
      
      const command = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `ConfigManagement-${Date.now()}`,
        ExternalId: externalId,
        DurationSeconds: 3600, // 1 hour
      });

      const response = await stsClient.send(command);
      
      if (!response.Credentials) {
        throw new Error('No credentials returned from assume role');
      }

      const credentials = {
        accessKeyId: response.Credentials.AccessKeyId!,
        secretAccessKey: response.Credentials.SecretAccessKey!,
        sessionToken: response.Credentials.SessionToken!,
        expiration: response.Credentials.Expiration,
      };

      // Cache the credentials
      this.credentials = credentials;
      this.credentialsExpiry = response.Credentials.Expiration || new Date(Date.now() + 3500000); // 58 minutes

      console.log('✅ Successfully assumed AWS role');
      return credentials;

    } catch (error) {
      console.error('❌ Failed to assume AWS role:', error);
      throw error;
    }
  }

  /**
   * Fetch EC2 instances from specified regions
   */
  async fetchInstances(
    integrationId: string,
    roleArn: string,
    externalId: string,
    regions: string[]
  ): Promise<{ success: boolean; instanceCount: number; errors: string[] }> {
    try {
      console.log(`🚀 Starting AWS instance sync for regions: ${regions.join(', ')}`);
      
      const credentials = await this.assumeRole(roleArn, externalId);
      if (!credentials) {
        throw new Error('Failed to get AWS credentials');
      }

      let totalInstances = 0;
      const errors: string[] = [];

      // Clear existing instances for this integration
      await db.delete(awsInstances).where(eq(awsInstances.integrationId, integrationId));

      // Fetch instances from each region
      for (const region of regions) {
        try {
          console.log(`📡 Fetching instances from ${region}...`);
          
          const ec2Client = new EC2Client({
            region,
            credentials: {
              accessKeyId: credentials.accessKeyId,
              secretAccessKey: credentials.secretAccessKey,
              sessionToken: credentials.sessionToken,
            }
          });

          const command = new DescribeInstancesCommand({});
          const response = await ec2Client.send(command);

          const instances: AWSInstance[] = [];
          
          // Process reservations and instances
          for (const reservation of response.Reservations || []) {
            for (const instance of reservation.Instances || []) {
              const awsInstance = this.transformEC2Instance(instance, region);
              instances.push(awsInstance);
            }
          }

          // Save instances to database
          if (instances.length > 0) {
            const dbInstances = instances.map(instance => ({
              integrationId,
              instanceId: instance.instanceId,
              region: instance.region,
              name: instance.name,
              state: instance.state,
              instanceType: instance.instanceType,
              publicIp: instance.publicIp,
              privateIp: instance.privateIp,
              publicDns: instance.publicDns,
              privateDns: instance.privateDns,
              keyName: instance.keyName,
              vpcId: instance.vpcId,
              subnetId: instance.subnetId,
              securityGroups: instance.securityGroups,
              tags: instance.tags,
              platform: instance.platform,
              launchTime: instance.launchTime,
              metadata: instance.metadata,
            }));

            await db.insert(awsInstances).values(dbInstances);
            console.log(`✅ Saved ${instances.length} instances from ${region}`);
            totalInstances += instances.length;
          } else {
            console.log(`ℹ️  No instances found in ${region}`);
          }

        } catch (regionError) {
          const errorMsg = `Failed to fetch instances from ${region}: ${regionError instanceof Error ? regionError.message : 'Unknown error'}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      // Update integration sync status
      await db
        .update(awsIntegrations)
        .set({
          lastSyncAt: new Date(),
          syncStatus: errors.length > 0 ? 'partial' : 'success',
          updatedAt: new Date(),
        })
        .where(eq(awsIntegrations.id, integrationId));

      console.log(`🎉 Sync completed: ${totalInstances} instances total, ${errors.length} errors`);

      return {
        success: errors.length === 0,
        instanceCount: totalInstances,
        errors
      };

    } catch (error) {
      console.error('💥 AWS instance sync failed:', error);
      
      // Update integration with error status
      await db
        .update(awsIntegrations)
        .set({
          syncStatus: 'error',
          updatedAt: new Date(),
        })
        .where(eq(awsIntegrations.id, integrationId));

      throw error;
    }
  }

  /**
   * Transform EC2 instance to our format
   */
  private transformEC2Instance(instance: EC2Instance, region: string): AWSInstance {
    // Extract name from tags
    const nameTag = instance.Tags?.find(tag => tag.Key === 'Name');
    const name = nameTag?.Value;

    // Convert tags to key-value object
    const tags: Record<string, string> = {};
    instance.Tags?.forEach(tag => {
      if (tag.Key && tag.Value) {
        tags[tag.Key] = tag.Value;
      }
    });

    // Extract security groups
    const securityGroups = instance.SecurityGroups?.map(sg => ({
      groupId: sg.GroupId,
      groupName: sg.GroupName,
    })) || [];

    return {
      instanceId: instance.InstanceId!,
      region,
      name,
      state: instance.State?.Name || 'unknown',
      instanceType: instance.InstanceType,
      publicIp: instance.PublicIpAddress,
      privateIp: instance.PrivateIpAddress,
      publicDns: instance.PublicDnsName,
      privateDns: instance.PrivateDnsName,
      keyName: instance.KeyName,
      vpcId: instance.VpcId,
      subnetId: instance.SubnetId,
      securityGroups,
      tags,
      platform: instance.Platform || 'linux',
      launchTime: instance.LaunchTime,
      metadata: {
        architecture: instance.Architecture,
        hypervisor: instance.Hypervisor,
        virtualizationType: instance.VirtualizationType,
        rootDeviceType: instance.RootDeviceType,
        stateTransitionReason: instance.StateTransitionReason,
        imageId: instance.ImageId,
        monitoring: instance.Monitoring?.State,
        placement: instance.Placement,
      }
    };
  }

  /**
   * Generate IAM policy document for the assume role
   */
  static generateIAMPolicy(): {
    trustPolicy: any;
    permissionsPolicy: any;
    instructions: string[];
  } {
    const trustPolicy = {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "AWS": "arn:aws:iam::359375618857:user/ops0-user"
          },
          "Action": "sts:AssumeRole",
          "Condition": {
            "StringEquals": {
              "sts:ExternalId": "GENERATED_EXTERNAL_ID"
            }
          }
        }
      ]
    };

    const permissionsPolicy = {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "ec2:DescribeInstances",
            "ec2:DescribeRegions",
            "ec2:DescribeAvailabilityZones",
            "ec2:DescribeTags",
            "ec2:DescribeSecurityGroups",
            "ec2:DescribeVpcs",
            "ec2:DescribeSubnets"
          ],
          "Resource": "*"
        }
      ]
    };

    const instructions = [
      "1. Log into your AWS Console and go to IAM > Roles",
      "2. Click 'Create Role'",
      "3. Select 'Custom trust policy' and paste the Trust Policy JSON below",
      "4. Replace 'GENERATED_EXTERNAL_ID' in the trust policy with the External ID shown above",
      "5. Click 'Next' and create a new policy using the Permissions Policy JSON",
      "6. Attach the permissions policy to the role",
      "7. Give the role a name (e.g., 'ConfigManagementRole')",
      "8. Copy the Role ARN after creation and use it in the form below",
      "9. Make sure the External ID matches exactly between the trust policy and this form"
    ];

    return {
      trustPolicy,
      permissionsPolicy,
      instructions
    };
  }
}