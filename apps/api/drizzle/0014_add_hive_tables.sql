-- ==============================
-- HIVE AGENT SYSTEM TABLES
-- ==============================

-- Hive Agents Registry
CREATE TABLE IF NOT EXISTS "hive_agents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    "api_key" varchar(255) UNIQUE NOT NULL, -- Format: hive_<nanoid>
    "name" varchar(255) NOT NULL, -- User-friendly name
    "hostname" varchar(255) NOT NULL,
    "ip_address" inet,
    "os_type" varchar(50), -- linux, windows, darwin
    "os_version" varchar(100),
    "arch" varchar(20), -- amd64, arm64
    "status" varchar(50) DEFAULT 'offline', -- online, offline, degraded, error
    "last_heartbeat" timestamp,
    "installed_at" timestamp DEFAULT now(),
    "version" varchar(50),
    "capabilities" jsonb DEFAULT '[]'::jsonb, -- Features the agent supports
    "system_info" jsonb DEFAULT '{}'::jsonb, -- CPU, RAM, Disk info
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Hive Agent Configurations (like Vector/Fluent-bit config)
CREATE TABLE IF NOT EXISTS "hive_agent_configs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id" uuid NOT NULL REFERENCES hive_agents(id) ON DELETE CASCADE,
    "config_type" varchar(50) NOT NULL, -- logs, metrics, traces, outputs
    "config_name" varchar(255) NOT NULL,
    "enabled" boolean DEFAULT true,
    "config" jsonb NOT NULL, -- Actual configuration
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    UNIQUE(agent_id, config_type, config_name)
);

-- Hive Telemetry Data (for buffering/querying)
CREATE TABLE IF NOT EXISTS "hive_telemetry" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id" uuid NOT NULL REFERENCES hive_agents(id) ON DELETE CASCADE,
    "type" varchar(50) NOT NULL, -- log, metric, trace, event
    "source" varchar(255), -- Source identifier (file path, service name)
    "data" jsonb NOT NULL,
    "timestamp" timestamp NOT NULL,
    "processed" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Hive Issues/Alerts detected by agents
CREATE TABLE IF NOT EXISTS "hive_issues" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id" uuid NOT NULL REFERENCES hive_agents(id) ON DELETE CASCADE,
    "severity" varchar(20) NOT NULL, -- critical, error, warning, info
    "category" varchar(100), -- system, application, security, performance
    "title" varchar(500) NOT NULL,
    "description" text,
    "error_pattern" text, -- Regex or pattern that triggered this
    "context" jsonb DEFAULT '{}'::jsonb, -- Additional context
    "suggested_fix" text,
    "auto_fixable" boolean DEFAULT false,
    "detected_at" timestamp DEFAULT now() NOT NULL,
    "acknowledged_at" timestamp,
    "resolved_at" timestamp,
    "resolution_type" varchar(50), -- manual, auto, ignored
    "resolution_details" text
);

-- Hive Command Execution History
CREATE TABLE IF NOT EXISTS "hive_commands" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id" uuid NOT NULL REFERENCES hive_agents(id) ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES users(id),
    "session_id" uuid, -- For grouping related commands
    "command_type" varchar(50) NOT NULL, -- shell, script, diagnostic, fix
    "command" text NOT NULL,
    "parameters" jsonb DEFAULT '{}'::jsonb,
    "response" text,
    "exit_code" integer,
    "executed_at" timestamp DEFAULT now() NOT NULL,
    "completed_at" timestamp,
    "status" varchar(50) DEFAULT 'pending', -- pending, running, success, failed, timeout
    "execution_time_ms" integer,
    "metadata" jsonb DEFAULT '{}'::jsonb
);

-- Hive Output Endpoints Configuration
CREATE TABLE IF NOT EXISTS "hive_output_endpoints" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    "name" varchar(255) NOT NULL,
    "type" varchar(50) NOT NULL, -- http, elasticsearch, prometheus, loki, datadog, etc
    "endpoint_url" text NOT NULL,
    "auth_type" varchar(50), -- none, basic, bearer, api_key
    "auth_config" jsonb DEFAULT '{}'::jsonb, -- Encrypted auth details
    "headers" jsonb DEFAULT '{}'::jsonb, -- Additional headers
    "batch_size" integer DEFAULT 1000,
    "flush_interval_seconds" integer DEFAULT 10,
    "retry_config" jsonb DEFAULT '{"max_retries": 3, "backoff_seconds": 5}'::jsonb,
    "enabled" boolean DEFAULT true,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Agent to Output Endpoint mappings
CREATE TABLE IF NOT EXISTS "hive_agent_outputs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id" uuid NOT NULL REFERENCES hive_agents(id) ON DELETE CASCADE,
    "endpoint_id" uuid NOT NULL REFERENCES hive_output_endpoints(id) ON DELETE CASCADE,
    "data_types" jsonb DEFAULT '["logs", "metrics"]'::jsonb, -- Which data types to send
    "filters" jsonb DEFAULT '{}'::jsonb, -- Optional filters
    "enabled" boolean DEFAULT true,
    "created_at" timestamp DEFAULT now() NOT NULL,
    UNIQUE(agent_id, endpoint_id)
);

-- Create indexes for performance
CREATE INDEX idx_hive_agents_organization_id ON hive_agents(organization_id);
CREATE INDEX idx_hive_agents_status ON hive_agents(status);
CREATE INDEX idx_hive_agents_api_key ON hive_agents(api_key);
CREATE INDEX idx_hive_telemetry_agent_id ON hive_telemetry(agent_id);
CREATE INDEX idx_hive_telemetry_timestamp ON hive_telemetry(timestamp);
CREATE INDEX idx_hive_issues_agent_id ON hive_issues(agent_id);
CREATE INDEX idx_hive_issues_severity ON hive_issues(severity);
CREATE INDEX idx_hive_commands_agent_id ON hive_commands(agent_id);
CREATE INDEX idx_hive_commands_user_id ON hive_commands(user_id);

-- Note: RBAC permissions for Hive are handled by the RBAC seeder