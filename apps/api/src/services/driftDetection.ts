import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { 
  servers, 
  configurations, 
  configurationStates, 
  deployments 
} from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import * as cron from 'node-cron';
import { executeAnsiblePlaybook } from './ansibleExecutor';
import { connectToServer } from './serverConnection';

interface DriftCheckResult {
  serverId: string;
  configurationId: string;
  hasDrift: boolean;
  driftDetails: any;
  actualState: any;
  expectedState: any;
}

export class DriftDetectionService {
  private db: PostgresJsDatabase;

  constructor(database: PostgresJsDatabase) {
    this.db = database;
  }

  async checkServerDrift(serverId: string): Promise<DriftCheckResult[]> {
    try {
      // Get server information
      const server = await this.db
        .select()
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      if (!server[0]) {
        throw new Error('Server not found');
      }

      // Get all configuration states for this server
      const states = await this.db
        .select()
        .from(configurationStates)
        .where(eq(configurationStates.serverId, serverId));

      const results: DriftCheckResult[] = [];

      for (const state of states) {
        try {
          const driftResult = await this.checkConfigurationDrift(
            server[0], 
            state
          );
          results.push(driftResult);

          // Update the configuration state in database
          await this.db
            .update(configurationStates)
            .set({
              actualState: driftResult.actualState,
              status: driftResult.hasDrift ? 'drift_detected' : 'compliant',
              lastChecked: new Date(),
              driftDetected: driftResult.hasDrift,
              driftDetails: driftResult.driftDetails,
              updatedAt: new Date(),
            })
            .where(eq(configurationStates.id, state.id));

        } catch (error) {
          console.error(`Error checking drift for configuration ${state.configurationId}:`, error);
          
          // Update state to indicate check failed
          await this.db
            .update(configurationStates)
            .set({
              status: 'check_failed',
              lastChecked: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(configurationStates.id, state.id));
        }
      }

      return results;
    } catch (error) {
      console.error(`Error checking drift for server ${serverId}:`, error);
      throw error;
    }
  }

  private async checkConfigurationDrift(
    server: any, 
    configState: any
  ): Promise<DriftCheckResult> {
    // Get the configuration details
    const configuration = await this.db
      .select()
      .from(configurations)
      .where(eq(configurations.id, configState.configurationId))
      .limit(1);

    if (!configuration[0]) {
      throw new Error('Configuration not found');
    }

    // Create a drift detection playbook
    const driftCheckPlaybook = this.createDriftCheckPlaybook(
      configuration[0],
      configState.expectedState
    );

    // Execute drift detection
    const connection = await connectToServer(
      server.ipAddress,
      server.port,
      server.username,
      server.pemKeyId
    );

    if (!connection.success) {
      throw new Error(`Cannot connect to server: ${connection.error}`);
    }

    // Run fact gathering and state check commands
    const actualState = await this.gatherServerState(server, configuration[0]);
    
    // Compare actual vs expected state
    const driftAnalysis = this.analyzeDrift(
      configState.expectedState,
      actualState,
      configuration[0].type
    );

    return {
      serverId: server.id,
      configurationId: configState.configurationId,
      hasDrift: driftAnalysis.hasDrift,
      driftDetails: driftAnalysis.details,
      actualState,
      expectedState: configState.expectedState,
    };
  }

  private createDriftCheckPlaybook(configuration: any, expectedState: any): string {
    const configType = configuration.type.toLowerCase();
    
    // Generate fact-gathering playbook based on configuration type
    switch (configType) {
      case 'nginx':
        return `---
- name: Check NGINX configuration drift
  hosts: all
  gather_facts: yes
  tasks:
    - name: Check if NGINX is installed
      package_facts:
        manager: auto

    - name: Check NGINX service status
      service_facts:

    - name: Get NGINX configuration file
      slurp:
        src: /etc/nginx/nginx.conf
      register: nginx_config
      ignore_errors: yes

    - name: Check NGINX process
      shell: ps aux | grep nginx | grep -v grep
      register: nginx_processes
      ignore_errors: yes

    - name: Check listening ports
      shell: netstat -tulpn | grep :80
      register: nginx_ports
      ignore_errors: yes`;

      case 'docker':
        return `---
- name: Check Docker configuration drift
  hosts: all
  gather_facts: yes
  tasks:
    - name: Check if Docker is installed
      package_facts:
        manager: auto

    - name: Check Docker service status
      service_facts:

    - name: Get Docker version
      shell: docker version --format '{{.Server.Version}}'
      register: docker_version
      ignore_errors: yes

    - name: Check Docker containers
      shell: docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
      register: docker_containers
      ignore_errors: yes

    - name: Check Docker images
      shell: docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'
      register: docker_images
      ignore_errors: yes`;

      default:
        return `---
- name: Generic configuration drift check
  hosts: all
  gather_facts: yes
  tasks:
    - name: Gather all facts
      setup:

    - name: Check running processes
      shell: ps aux
      register: running_processes

    - name: Check installed packages
      package_facts:
        manager: auto

    - name: Check services
      service_facts:`;
    }
  }

  private async gatherServerState(server: any, configuration: any): Promise<any> {
    // This would execute fact-gathering commands on the server
    // For now, we'll return mock data based on configuration type
    const configType = configuration.type.toLowerCase();

    switch (configType) {
      case 'nginx':
        return {
          packages: {
            nginx: { installed: true, version: '1.18.0' }
          },
          services: {
            nginx: { state: 'running', enabled: true }
          },
          ports: [80, 443],
          config_files: {
            '/etc/nginx/nginx.conf': { exists: true, checksum: 'abc123' }
          }
        };

      case 'docker':
        return {
          packages: {
            'docker-ce': { installed: true, version: '20.10.8' }
          },
          services: {
            docker: { state: 'running', enabled: true }
          },
          containers: [],
          images: []
        };

      default:
        return {
          packages: {},
          services: {},
          files: {}
        };
    }
  }

  private analyzeDrift(expectedState: any, actualState: any, configType: string): {
    hasDrift: boolean;
    details: any;
  } {
    const driftDetails: any = {
      packages: {},
      services: {},
      files: {},
      ports: {},
    };

    let hasDrift = false;

    // Compare packages
    if (expectedState.packages) {
      for (const [packageName, expectedPackage] of Object.entries(expectedState.packages)) {
        const actualPackage = actualState.packages?.[packageName];
        const expected = expectedPackage as any;

        if (!actualPackage) {
          driftDetails.packages[packageName] = {
            status: 'missing',
            expected: expected,
            actual: null
          };
          hasDrift = true;
        } else if (expected.version && actualPackage.version !== expected.version) {
          driftDetails.packages[packageName] = {
            status: 'version_mismatch',
            expected: expected.version,
            actual: actualPackage.version
          };
          hasDrift = true;
        }
      }
    }

    // Compare services
    if (expectedState.services) {
      for (const [serviceName, expectedService] of Object.entries(expectedState.services)) {
        const actualService = actualState.services?.[serviceName];
        const expected = expectedService as any;

        if (!actualService) {
          driftDetails.services[serviceName] = {
            status: 'missing',
            expected: expected,
            actual: null
          };
          hasDrift = true;
        } else {
          if (expected.state && actualService.state !== expected.state) {
            driftDetails.services[serviceName] = {
              status: 'state_mismatch',
              field: 'state',
              expected: expected.state,
              actual: actualService.state
            };
            hasDrift = true;
          }

          if (expected.enabled !== undefined && actualService.enabled !== expected.enabled) {
            driftDetails.services[serviceName] = {
              ...driftDetails.services[serviceName],
              status: 'config_mismatch',
              field: 'enabled',
              expected: expected.enabled,
              actual: actualService.enabled
            };
            hasDrift = true;
          }
        }
      }
    }

    // Compare ports
    if (expectedState.ports) {
      const expectedPorts = Array.isArray(expectedState.ports) ? expectedState.ports : [expectedState.ports];
      const actualPorts = Array.isArray(actualState.ports) ? actualState.ports : [];

      for (const expectedPort of expectedPorts) {
        if (!actualPorts.includes(expectedPort)) {
          driftDetails.ports[expectedPort] = {
            status: 'not_listening',
            expected: 'listening',
            actual: 'not_found'
          };
          hasDrift = true;
        }
      }
    }

    return {
      hasDrift,
      details: driftDetails
    };
  }

  async runFullDriftScan(organizationId: string): Promise<void> {
    console.log(`Starting drift scan for organization ${organizationId}`);

    try {
      // Get all active servers for the organization
      const organizationServers = await this.db
        .select()
        .from(servers)
        .where(eq(servers.organizationId, organizationId));

      console.log(`Found ${organizationServers.length} servers to check for drift`);

      // Check drift for each server
      for (const server of organizationServers) {
        try {
          console.log(`Checking drift for server ${server.name} (${server.id})`);
          await this.checkServerDrift(server.id);
        } catch (error) {
          console.error(`Error checking drift for server ${server.id}:`, error);
        }
      }

      console.log(`Drift scan completed for organization ${organizationId}`);
    } catch (error) {
      console.error(`Error running drift scan for organization ${organizationId}:`, error);
    }
  }
}

export function startDriftDetectionService(database: PostgresJsDatabase): void {
  const driftService = new DriftDetectionService(database);

  // Run drift detection every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Starting scheduled drift detection scan');
    
    try {
      // Get all organizations from the database
      const { organizations } = await import('@config-management/database');
      const allOrganizations = await database.select().from(organizations);
      
      if (allOrganizations.length === 0) {
        console.log('No organizations found, skipping drift detection');
        return;
      }

      // Run drift detection for each organization
      for (const org of allOrganizations) {
        try {
          console.log(`Running drift scan for organization: ${org.name} (${org.id})`);
          await driftService.runFullDriftScan(org.id);
        } catch (error) {
          console.error(`Error in drift scan for organization ${org.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in scheduled drift detection:', error);
    }
  });

  console.log('🔍 Drift detection service started with hourly scans');
}