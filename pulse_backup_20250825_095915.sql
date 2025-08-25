--
-- PostgreSQL database dump
--

\restrict byerzMZuRPv24aiTmgh5Tk6LSVSybgJOk7CxC8M4zFSiTNqQEZyUvZOUscPqekQ

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asset_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamp without time zone DEFAULT now() NOT NULL,
    returned_at timestamp without time zone,
    returned_by uuid,
    assignment_type character varying(50) DEFAULT 'permanent'::character varying,
    expected_return_date date,
    assignment_notes text,
    return_notes text,
    assignment_location character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    organization_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.asset_assignments OWNER TO postgres;

--
-- Name: asset_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    parent_category_id uuid,
    organization_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.asset_categories OWNER TO postgres;

--
-- Name: asset_custom_field_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_custom_field_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    custom_field_id uuid NOT NULL,
    field_value text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.asset_custom_field_values OWNER TO postgres;

--
-- Name: asset_custom_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_custom_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    field_name character varying(255) NOT NULL,
    field_type character varying(50) NOT NULL,
    field_options jsonb,
    is_required boolean DEFAULT false NOT NULL,
    organization_id uuid NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.asset_custom_fields OWNER TO postgres;

--
-- Name: asset_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    performed_by uuid NOT NULL,
    notes text,
    organization_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.asset_history OWNER TO postgres;

--
-- Name: asset_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    address text,
    parent_location_id uuid,
    organization_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.asset_locations OWNER TO postgres;

--
-- Name: asset_maintenance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    maintenance_type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'scheduled'::character varying NOT NULL,
    scheduled_date date,
    completed_date date,
    cost numeric(10,2),
    currency character varying(3) DEFAULT 'USD'::character varying,
    vendor character varying(255),
    description text NOT NULL,
    notes text,
    performed_by uuid,
    organization_id uuid NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.asset_maintenance OWNER TO postgres;

--
-- Name: assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_tag character varying(100) NOT NULL,
    serial_number character varying(255),
    asset_type character varying(50) NOT NULL,
    brand character varying(100) NOT NULL,
    model character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'available'::character varying NOT NULL,
    condition character varying(50) DEFAULT 'good'::character varying,
    purchase_date date,
    purchase_price numeric(10,2),
    currency character varying(3) DEFAULT 'USD'::character varying,
    supplier character varying(255),
    warranty_start_date date,
    warranty_end_date date,
    warranty_provider character varying(255),
    location character varying(255),
    cost_center character varying(100),
    department character varying(100),
    category character varying(100),
    subcategory character varying(100),
    specifications jsonb DEFAULT '{}'::jsonb,
    notes text,
    barcode character varying(255),
    qr_code character varying(255),
    image_url character varying(500),
    is_active boolean DEFAULT true NOT NULL,
    mdm_device_id uuid,
    organization_id uuid NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.assets OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    organization_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    resource character varying(100) NOT NULL,
    resource_id uuid,
    details jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: aws_instances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.aws_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid NOT NULL,
    instance_id character varying(255) NOT NULL,
    region character varying(50) NOT NULL,
    name character varying(255),
    state character varying(50),
    instance_type character varying(50),
    public_ip character varying(45),
    private_ip character varying(45),
    public_dns text,
    private_dns text,
    key_name character varying(255),
    vpc_id character varying(255),
    subnet_id character varying(255),
    security_groups jsonb DEFAULT '[]'::jsonb,
    tags jsonb DEFAULT '{}'::jsonb,
    platform character varying(50),
    launch_time timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.aws_instances OWNER TO postgres;

--
-- Name: aws_integrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.aws_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    role_arn text NOT NULL,
    external_id character varying(255) NOT NULL,
    regions jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_sync_at timestamp without time zone,
    sync_status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.aws_integrations OWNER TO postgres;

--
-- Name: configuration_github_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuration_github_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    configuration_id uuid NOT NULL,
    github_integration_id uuid NOT NULL,
    relative_path character varying(512) NOT NULL,
    branch character varying(255) NOT NULL,
    auto_sync boolean DEFAULT false NOT NULL,
    sync_on_change boolean DEFAULT true NOT NULL,
    last_synced_sha character varying(40),
    last_sync_at timestamp without time zone,
    sync_status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.configuration_github_mappings OWNER TO postgres;

--
-- Name: configuration_states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configuration_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    configuration_id uuid NOT NULL,
    expected_state jsonb NOT NULL,
    actual_state jsonb,
    status character varying(50) DEFAULT 'unknown'::character varying NOT NULL,
    last_checked timestamp without time zone,
    drift_detected boolean DEFAULT false NOT NULL,
    drift_details jsonb,
    organization_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.configuration_states OWNER TO postgres;

--
-- Name: configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type character varying(100) NOT NULL,
    ansible_playbook text NOT NULL,
    variables jsonb,
    tags jsonb,
    organization_id uuid NOT NULL,
    created_by uuid NOT NULL,
    is_template boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    source character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    approval_status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone,
    rejection_reason text,
    metadata jsonb
);


ALTER TABLE public.configurations OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255),
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: deployments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deployments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    configuration_id uuid NOT NULL,
    target_type character varying(50) NOT NULL,
    target_id uuid NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    logs text,
    output text,
    error_message text,
    executed_by uuid NOT NULL,
    organization_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    section character varying(100) DEFAULT 'general'::character varying,
    version integer DEFAULT 1 NOT NULL,
    parent_deployment_id uuid,
    schedule_type character varying(20) DEFAULT 'immediate'::character varying,
    scheduled_for timestamp without time zone,
    cron_expression character varying(100),
    timezone character varying(50) DEFAULT 'UTC'::character varying,
    is_active boolean DEFAULT true,
    next_run_at timestamp without time zone,
    last_run_at timestamp without time zone,
    approval_status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone,
    rejection_reason text
);


ALTER TABLE public.deployments OWNER TO postgres;

--
-- Name: github_integrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.github_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    github_user_id character varying(255) NOT NULL,
    github_username character varying(255) NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    token_expires_at timestamp without time zone,
    repository_id character varying(255) NOT NULL,
    repository_name character varying(255) NOT NULL,
    repository_full_name character varying(512) NOT NULL,
    default_branch character varying(255) DEFAULT 'main'::character varying NOT NULL,
    base_path character varying(512) DEFAULT '/configs'::character varying,
    is_active boolean DEFAULT true NOT NULL,
    auto_fetch boolean DEFAULT false NOT NULL,
    fetch_interval integer DEFAULT 300,
    last_fetch_at timestamp without time zone,
    last_sync_at timestamp without time zone,
    sync_status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.github_integrations OWNER TO postgres;

--
-- Name: github_pull_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.github_pull_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    github_integration_id uuid NOT NULL,
    configuration_id uuid,
    pr_number integer NOT NULL,
    pr_id character varying(255) NOT NULL,
    title character varying(512) NOT NULL,
    description text,
    head_branch character varying(255) NOT NULL,
    base_branch character varying(255) NOT NULL,
    state character varying(50) NOT NULL,
    html_url text NOT NULL,
    created_by uuid NOT NULL,
    merged_at timestamp without time zone,
    closed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.github_pull_requests OWNER TO postgres;

--
-- Name: mdm_commands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mdm_commands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    command_type character varying(50) NOT NULL,
    command text,
    parameters jsonb DEFAULT '{}'::jsonb,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    output text,
    error_message text,
    exit_code integer,
    sent_at timestamp without time zone,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    timeout integer DEFAULT 300,
    initiated_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.mdm_commands OWNER TO postgres;

--
-- Name: mdm_devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mdm_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    organization_id uuid NOT NULL,
    device_name character varying(255) NOT NULL,
    device_id character varying(255) NOT NULL,
    serial_number character varying(255),
    model character varying(255),
    os_version character varying(100),
    architecture character varying(50),
    ip_address character varying(45),
    mac_address character varying(17),
    hostname character varying(255),
    status character varying(50) DEFAULT 'offline'::character varying NOT NULL,
    last_seen timestamp without time zone,
    last_heartbeat timestamp without time zone,
    battery_level integer,
    is_charging boolean,
    agent_version character varying(50),
    agent_install_path text,
    enrolled_at timestamp without time zone DEFAULT now() NOT NULL,
    enrolled_by uuid,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.mdm_devices OWNER TO postgres;

--
-- Name: mdm_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mdm_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    organization_id uuid NOT NULL,
    profile_type character varying(50) DEFAULT 'macos'::character varying NOT NULL,
    allow_remote_commands boolean DEFAULT true NOT NULL,
    allow_lock_device boolean DEFAULT true NOT NULL,
    allow_shutdown boolean DEFAULT false NOT NULL,
    allow_restart boolean DEFAULT true NOT NULL,
    allow_wake_on_lan boolean DEFAULT true NOT NULL,
    require_authentication boolean DEFAULT true NOT NULL,
    max_session_duration integer DEFAULT 3600,
    allowed_ip_ranges jsonb DEFAULT '[]'::jsonb,
    enrollment_key character varying(255) NOT NULL,
    enrollment_expires_at timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.mdm_profiles OWNER TO postgres;

--
-- Name: mdm_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mdm_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    session_token character varying(255) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    last_activity timestamp without time zone DEFAULT now() NOT NULL,
    ended_at timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.mdm_sessions OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    generated_configuration text,
    configuration_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    claude_api_key text,
    default_region character varying(50) DEFAULT 'us-east-1'::character varying,
    max_concurrent_deployments integer DEFAULT 5,
    deployment_timeout integer DEFAULT 300,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organization_settings OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    owner_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    features_enabled jsonb DEFAULT '{"mdm": true, "chat": true, "assets": true, "pemKeys": true, "servers": true, "training": true, "auditLogs": true, "deployments": true, "serverGroups": true, "configurations": true, "awsIntegrations": true, "githubIntegrations": true}'::jsonb
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: pem_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pem_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    encrypted_private_key text NOT NULL,
    public_key text,
    fingerprint character varying(255),
    organization_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pem_keys OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    description text,
    is_system boolean DEFAULT true NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    organization_id uuid NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: server_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.server_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    default_pem_key_id uuid,
    organization_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    type character varying(50) DEFAULT 'mixed'::character varying
);


ALTER TABLE public.server_groups OWNER TO postgres;

--
-- Name: servers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    hostname character varying(255) NOT NULL,
    ip_address character varying(45) NOT NULL,
    port integer DEFAULT 22 NOT NULL,
    username character varying(255) DEFAULT 'root'::character varying NOT NULL,
    operating_system character varying(100),
    os_version character varying(100),
    status character varying(50) DEFAULT 'unknown'::character varying NOT NULL,
    last_seen timestamp without time zone,
    group_id uuid,
    pem_key_id uuid,
    organization_id uuid NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    type character varying(50) DEFAULT 'linux'::character varying NOT NULL,
    encrypted_password text
);


ALTER TABLE public.servers OWNER TO postgres;

--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(255) NOT NULL,
    value jsonb NOT NULL,
    description text,
    category character varying(100) DEFAULT 'general'::character varying NOT NULL,
    is_readonly boolean DEFAULT false NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: user_organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    joined_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_organizations OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp without time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    password_hash text NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id uuid,
    is_super_admin boolean DEFAULT false NOT NULL,
    has_completed_onboarding boolean DEFAULT false NOT NULL,
    auth_method character varying DEFAULT 'password'::character varying,
    sso_provider_id character varying,
    external_user_id character varying,
    last_sso_login_at timestamp without time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: asset_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_assignments (id, asset_id, user_id, assigned_by, assigned_at, returned_at, returned_by, assignment_type, expected_return_date, assignment_notes, return_notes, assignment_location, is_active, organization_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: asset_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_categories (id, name, description, parent_category_id, organization_id, is_active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: asset_custom_field_values; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_custom_field_values (id, asset_id, custom_field_id, field_value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: asset_custom_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_custom_fields (id, field_name, field_type, field_options, is_required, organization_id, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: asset_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_history (id, asset_id, action, old_values, new_values, performed_by, notes, organization_id, created_at) FROM stdin;
\.


--
-- Data for Name: asset_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_locations (id, name, description, address, parent_location_id, organization_id, is_active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: asset_maintenance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_maintenance (id, asset_id, maintenance_type, status, scheduled_date, completed_date, cost, currency, vendor, description, notes, performed_by, organization_id, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assets (id, asset_tag, serial_number, asset_type, brand, model, status, condition, purchase_date, purchase_price, currency, supplier, warranty_start_date, warranty_end_date, warranty_provider, location, cost_center, department, category, subcategory, specifications, notes, barcode, qr_code, image_url, is_active, mdm_device_id, organization_id, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, organization_id, action, resource, resource_id, details, ip_address, user_agent, created_at) FROM stdin;
64d0e609-6f34-48da-b949-b1be0f868717	0e9742f5-3508-46d1-a054-565459e61caf	4625e2d1-0da5-40b9-a3e5-b7e46b6fc4c2	viewed	admin	\N	"{\\"method\\":\\"GET\\",\\"path\\":\\"/api/admin/organizations\\",\\"statusCode\\":200,\\"duration\\":6,\\"query\\":{}}"	::ffff:172.253.124.94	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-25 14:59:03.946549
30ae36c6-b45d-4533-bac0-6adac2729b71	0e9742f5-3508-46d1-a054-565459e61caf	4625e2d1-0da5-40b9-a3e5-b7e46b6fc4c2	viewed	admin	\N	"{\\"method\\":\\"GET\\",\\"path\\":\\"/api/admin/organizations\\",\\"statusCode\\":200,\\"duration\\":3,\\"query\\":{}}"	::ffff:172.253.124.94	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-25 14:59:06.202737
ab703b7d-4fe6-4b86-9d9a-94e8a2fbed5e	0e9742f5-3508-46d1-a054-565459e61caf	4625e2d1-0da5-40b9-a3e5-b7e46b6fc4c2	viewed	admin	\N	"{\\"method\\":\\"GET\\",\\"path\\":\\"/api/admin/organizations\\",\\"statusCode\\":200,\\"duration\\":4,\\"query\\":{}}"	::ffff:172.253.124.94	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-25 14:59:09.519816
e50fa5ea-a405-4a12-accc-c1acb25663d5	0e9742f5-3508-46d1-a054-565459e61caf	4625e2d1-0da5-40b9-a3e5-b7e46b6fc4c2	viewed	admin	\N	"{\\"method\\":\\"GET\\",\\"path\\":\\"/api/admin/organizations\\",\\"statusCode\\":200,\\"duration\\":1,\\"query\\":{}}"	::ffff:172.253.124.94	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-25 14:59:11.273713
\.


--
-- Data for Name: aws_instances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.aws_instances (id, integration_id, instance_id, region, name, state, instance_type, public_ip, private_ip, public_dns, private_dns, key_name, vpc_id, subnet_id, security_groups, tags, platform, launch_time, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: aws_integrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.aws_integrations (id, organization_id, name, role_arn, external_id, regions, is_active, last_sync_at, sync_status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: configuration_github_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configuration_github_mappings (id, configuration_id, github_integration_id, relative_path, branch, auto_sync, sync_on_change, last_synced_sha, last_sync_at, sync_status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: configuration_states; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configuration_states (id, server_id, configuration_id, expected_state, actual_state, status, last_checked, drift_detected, drift_details, organization_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: configurations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.configurations (id, name, description, type, ansible_playbook, variables, tags, organization_id, created_by, is_template, version, created_at, updated_at, source, approval_status, approved_by, approved_at, rejection_reason, metadata) FROM stdin;
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversations (id, title, user_id, organization_id, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: deployments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deployments (id, name, description, configuration_id, target_type, target_id, status, started_at, completed_at, logs, output, error_message, executed_by, organization_id, created_at, updated_at, section, version, parent_deployment_id, schedule_type, scheduled_for, cron_expression, timezone, is_active, next_run_at, last_run_at, approval_status, approved_by, approved_at, rejection_reason) FROM stdin;
\.


--
-- Data for Name: github_integrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.github_integrations (id, organization_id, name, github_user_id, github_username, access_token, refresh_token, token_expires_at, repository_id, repository_name, repository_full_name, default_branch, base_path, is_active, auto_fetch, fetch_interval, last_fetch_at, last_sync_at, sync_status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: github_pull_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.github_pull_requests (id, github_integration_id, configuration_id, pr_number, pr_id, title, description, head_branch, base_branch, state, html_url, created_by, merged_at, closed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mdm_commands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mdm_commands (id, device_id, organization_id, command_type, command, parameters, status, output, error_message, exit_code, sent_at, started_at, completed_at, timeout, initiated_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mdm_devices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mdm_devices (id, profile_id, organization_id, device_name, device_id, serial_number, model, os_version, architecture, ip_address, mac_address, hostname, status, last_seen, last_heartbeat, battery_level, is_charging, agent_version, agent_install_path, enrolled_at, enrolled_by, is_active, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mdm_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mdm_profiles (id, name, description, organization_id, profile_type, allow_remote_commands, allow_lock_device, allow_shutdown, allow_restart, allow_wake_on_lan, require_authentication, max_session_duration, allowed_ip_ranges, enrollment_key, enrollment_expires_at, is_active, created_by, created_at, updated_at) FROM stdin;
e98d5407-ff70-4c91-86d7-2ea20bbafb00	Default MacOS Profile	Default MDM profile for MacOS devices - automatically created	4625e2d1-0da5-40b9-a3e5-b7e46b6fc4c2	macos	t	t	f	t	t	t	3600	"[]"	9dce43df6fb393c5eac20f5fe80b79dfde77b2935fe7e216ea8a4b93c727aa56	\N	t	0e9742f5-3508-46d1-a054-565459e61caf	2025-08-25 14:56:37.853293	2025-08-25 14:56:37.853293
\.


--
-- Data for Name: mdm_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mdm_sessions (id, device_id, user_id, organization_id, session_token, ip_address, user_agent, started_at, last_activity, ended_at, is_active) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, conversation_id, role, content, generated_configuration, configuration_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organization_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_settings (id, organization_id, claude_api_key, default_region, max_concurrent_deployments, deployment_timeout, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, description, owner_id, created_at, updated_at, is_active, is_primary, metadata, features_enabled) FROM stdin;
4625e2d1-0da5-40b9-a3e5-b7e46b6fc4c2	Pulse Admin Organization	Default admin organization for Pulse MDM	0e9742f5-3508-46d1-a054-565459e61caf	2025-08-25 14:56:37.640504	2025-08-25 14:56:37.640504	t	t	{}	{"mdm": true, "chat": true, "assets": true, "pemKeys": true, "servers": true, "training": true, "auditLogs": true, "deployments": true, "serverGroups": true, "configurations": true, "awsIntegrations": true, "githubIntegrations": true}
\.


--
-- Data for Name: pem_keys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pem_keys (id, name, description, encrypted_private_key, public_key, fingerprint, organization_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, resource, action, description, is_system) FROM stdin;
1302ba45-5c4c-4378-85d5-411606032e19	pem-keys	delete	Delete PEM keys	t
03aa45b1-d1c2-445d-b103-5ca9d2002930	mdm	read	View MDM profiles and devices	t
00a9085b-7176-4306-8a77-650826f28c84	asset	delete	Delete assets	t
0832df0d-471c-43bc-bbec-f9db442e8669	servers	execute	Test server connections	t
110f450d-3989-416d-89d0-974f01c88e4f	server-groups	write	Create and modify server groups	t
3081ddf2-0b06-4c88-83ed-0797cceae48a	pem-keys	write	Upload and modify PEM keys	t
003c1f1a-daff-4cec-b4c5-f85eac94dc55	deployments	execute	Execute and redeploy configurations	t
196d74c2-e183-4de6-8c00-ded9152c0ef9	github-integrations	delete	Delete GitHub integrations	t
17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	servers	read	View servers	t
014d7cfe-6724-487f-ae0b-5e31b4aa67fd	server-groups	execute	Manage server group operations	t
0590f05c-c457-420f-b182-9a399a3a8244	configurations	read	View configurations	t
02bffd49-c135-4d8c-af77-05b5181a0e90	configurations	write	Create and modify configurations	t
0a27bdb6-2468-45f8-8d73-de4ae16f7323	aws-integrations	write	Create and modify AWS integrations	t
073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	github-integrations	validate	Validate GitHub tokens	t
0237267d-c079-4aed-b6aa-3f5ad0f5c872	asset	create	Create new assets	t
0b737bae-4174-495e-9feb-95ab3cff3ef0	asset	import	Import assets from external sources	t
10da1d2f-86a8-4595-b530-1a591102c4a8	asset	export	Export assets to external systems	t
163eaa31-6f22-4fcb-923f-366c33aba3ae	settings	read	View organization settings	t
0417bb7a-d226-4f74-8dd4-ff77a0134e6f	pem-keys	read	View PEM keys	t
365266da-4c88-4e72-9edb-503016d27e6a	deployments	read	View deployments	t
093115b8-ceba-40d8-9e74-5b20471d3efd	audit-logs	view	View audit logs	t
11a72c49-345c-4766-ab40-729eacd11c2f	aws-integrations	read	View AWS integrations	t
2cbf8685-c7ff-4386-91e3-9870096ee9eb	mdm	write	Create and modify MDM profiles	t
07761b5d-06f0-46ca-af2d-44cabb1bb860	asset	assign	Assign assets to users/locations	t
016936c4-1259-49a6-83fb-e6a00ec371b5	users	read	View users and roles	t
146c406f-7923-4adc-b88a-1d6ab8f38a78	users	delete	Delete users	t
205f38c0-53d0-4707-a0e4-4b40d5f4de4f	roles	read	View roles and permissions	t
0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	servers	write	Create and modify servers	t
08da5ad0-5dd8-4798-bb83-6e07b1e9039e	pem-keys	execute	Test PEM key connections	t
0c35f906-93ab-4d2f-9016-89b5bfa01bf2	aws-integrations	delete	Delete AWS integrations	t
063da0b1-cbb4-4c97-a0f6-1e0feef62541	github-integrations	read	View GitHub integrations	t
0903bb18-b157-4cb7-8851-197196b0d258	roles	delete	Delete roles	t
0b18592a-4647-49ca-a04a-59102a764a11	server-groups	read	View server groups	t
2385db70-6554-42e0-8700-19cbfb834e63	training	read	Access infrastructure training modules	t
052f466b-b37e-472f-941f-9f80f2a610d3	github-integrations	sync	Sync configurations to GitHub	t
1e537ed9-855a-4715-9198-8103d4c0a7c7	deployments	write	Create and modify deployments	t
08367bc8-16c9-4d59-890e-c62e240d05f0	chat	delete	Delete chat conversations	t
40f55215-e0c9-4518-82fb-5e9604ccb4a9	aws-integrations	import	Import AWS instances as servers	t
07a87450-35bb-437b-871c-c1ff3c2fa045	deployments	delete	Delete deployments	t
21d04133-0cc1-4936-b52f-ea85073f9182	chat	read	View configuration chat	t
14977a9d-924a-48ff-bccb-3a5f6478ddac	mdm	delete	Delete MDM profiles	t
1cdddc57-ebbd-4a73-8441-e4e31adc88a9	settings	write	Modify organization settings	t
1f15bec9-cd43-4103-bd5a-47fcb98f2df7	configurations	execute	Validate and test configurations	t
1237e3fc-df10-42b2-b420-afa9960718b1	configurations	delete	Delete configurations	t
0123642e-820f-444e-aef7-8ed79c587fb8	chat	write	Use AI configuration assistant	t
021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	audit-logs	export	Export audit logs	t
0133d7cf-c035-484a-bc49-6d65fcb89200	aws-integrations	sync	Sync AWS instances	t
1105a2b9-b16e-4032-9a1e-cfaff26084e0	dashboard	read	View dashboard and analytics	t
049a375c-51c6-4acb-8b1b-b8a1b3a469f7	roles	write	Create and modify roles	t
1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	asset	read	View assets	t
127f9164-8694-42e7-9c05-49d938a26136	users	write	Create and modify users	t
0092c8e1-4295-4d9c-b07d-4608225d1aaf	servers	delete	Delete servers	t
0ceb957e-34ef-4727-b719-cf5e1866fff7	server-groups	delete	Delete server groups	t
07a33458-341a-4714-8585-4f9baddbc278	mdm	execute	Send commands to MDM devices	t
0c1b6e2e-b3ba-4982-acdd-411e496aede2	github-integrations	write	Create and modify GitHub integrations	t
054cae28-56f7-4e36-bd21-f2fc9faeb641	configurations	approve	Approve or reject configurations for deployment	t
1e8d3192-ebe1-42d7-baca-09ade44e4e5f	asset	update	Update existing assets	t
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (id, role_id, permission_id, created_at) FROM stdin;
8cb382f5-204f-4d21-8f48-914510b6a274	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.645775
b34ea0e1-24d2-48a5-a456-bcb6530b7eea	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.646369
39ae43a1-f748-4743-b16f-b60497f9c946	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.646768
f7720a4c-681f-4960-9f09-de4b4ec0ae39	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.647083
3ab9c953-fccb-4c5c-b19f-2b88e8205b79	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.647408
2d798ffb-a153-470f-b467-7f4a7e332a49	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.647679
782b6465-2af9-46a5-9e8f-4558ec6875e7	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.647956
c24ff342-ec8d-43f1-bb34-6e34932f85b9	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.648264
b9e0fc5a-3f8e-467e-a972-a00d5e8110d0	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.648529
73b42fac-f486-43de-8b5f-c0cab0c7be1d	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.648816
5c3fe2aa-00d8-4cf6-8079-26e2dc05ff0a	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.649159
c71d018b-377a-44a1-a93e-bee58036b2b4	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.649439
729f4f01-4732-4a58-b3ff-e097cb40876f	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.649808
4526a28e-32f8-4bae-b7d3-10877bac5e02	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.650164
91cc27db-9f08-43d9-9279-29dd092f7ee5	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.650513
93eba8b2-89d9-4745-9ed9-a348ab93fb84	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.650803
2063b1d7-dbe6-43ee-ba60-e55dff42d795	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.651091
b1817b9c-2ab1-4b40-9630-9fdf038dfdd5	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.651366
cf4002d8-d0f0-43d9-bc92-205ec1073844	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.651642
783a9a89-60f1-4b6d-aaa7-91b9146ffbb9	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.651907
37a9da1d-5757-4d36-a51c-b0cf285fe5b2	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.652176
2f16eaae-3bee-4bdb-b637-3994161309eb	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.652449
bdb2133a-057b-4bc0-a73b-ecdd72e80c50	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.652717
cb8ffac9-f08e-4ce3-9d1b-f29099f8fafe	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.652977
b31fb0c1-ca3a-48b3-8ce7-8741bde061fb	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.653242
f040c3e2-04b4-4c9a-9ecb-3f08b69bf09c	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.653512
45a5d490-d48e-46a1-ad6f-36cd0a623611	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.653778
4bddca33-e940-4989-aa29-12fa9a6f7b84	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.654032
c589bf39-120c-486e-b85f-e0bdfac4c59b	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.6543
867eedcb-b816-43a9-aabd-4b25d7b56a8e	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.654563
70c5feaf-b7d6-4ff7-a81f-90f4b6690a4c	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.654807
67cef82e-3f64-4274-bb44-35bbdabec1e6	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.655065
3540417b-9ae9-4453-a20d-5bc63cb94ac7	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.655334
8f5afc32-87d4-4e00-bf69-87150812179a	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.655638
fab14f6e-9ecc-4b82-b27d-b6174844595c	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.65594
9ed2f055-c3e6-48cf-b52d-571321914731	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.656387
55b6d043-047f-4d16-a9ef-37228a453ff0	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.656749
e8220a8a-8058-4a60-ad0a-c689b778e06c	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.657059
65d09341-c969-489c-ae57-b5d8b153bfb5	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.657349
0ed23535-0a2d-4c1c-80df-2a10510ca6bf	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.657627
74cf0525-563a-43a4-9c66-0bfb5f3f497c	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.657897
f074d7e7-8a8d-4fbc-90c5-8fba6ee1d0d2	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.658169
b670f9b0-d4dd-4a9d-b2a1-12fd091f5f0c	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.658434
f59ed802-8a23-4b6c-bfce-732ca1a12d47	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.658685
50aa6037-ac32-403f-9209-7955e4e46b63	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.65893
b03fc4d0-57d1-441a-b55e-054777e9737b	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.659193
d17fe8d5-b107-4ba1-9af2-efb2fde4f306	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.659459
4b5c03c9-88bb-45ae-8ad5-956f93fa395c	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.659744
d2469fdf-38eb-4d96-853c-6d5c06e33bb4	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.660005
4308f380-55a5-4fd5-a903-2f31bacd8dd5	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.660279
c64bb544-b568-4ab0-8147-941288bb833b	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.66055
9a31a0a6-357a-4dc9-adfd-56953d208c92	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.660824
8b7daac0-1bad-44da-ba72-38a86e85550c	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.661083
4cb33ad5-d6a7-4854-8452-e3b9088da917	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.662232
844f7747-92fa-4f6b-83a7-c2e1f9b49b0f	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.662517
cf307356-7407-4d10-be07-3edca8b78bfb	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.662851
a3f353c6-8b08-4de0-8596-cf413e07f2c3	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.663112
40e08d67-4eb2-4eb4-84ad-bbec7be232c9	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.663369
b6e53fa4-7068-4e37-9276-7ad28392d4b9	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.663604
8ba16413-8a42-48d2-afef-5707dbf71b13	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.663852
228dd8b6-8ecc-4112-b9f5-9e29bacc1b27	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.664099
e51ac13a-7d78-4339-bf4b-5707d1124784	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.6644
f0e71c5d-6d3e-45f1-80ea-51b01f27802c	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.66463
0c9695f4-3ab3-4e55-b4dc-c25bb664f631	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.664858
236f5ca9-149d-476f-b8f3-c3258f41eafe	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.665097
176f258d-b9b8-44ee-a55e-1a9d0eb9b8f4	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.665352
dee1ee97-acca-4956-9e78-17b6ff0fd26f	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.66566
28c6757c-dfdb-4510-93f4-9d60842cf3fe	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.665953
e78d0b9a-d039-4b7c-be83-61c95803e517	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.666228
6c81ce70-5945-498e-a724-cfbfac250866	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.666497
faff1b0d-22e4-4d18-87e8-874b3ba8f54e	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.666749
f3d35424-a9da-42cd-9f35-2e0f14b96a84	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.667001
2d0693e7-6f6e-44f5-805d-83e4d1941235	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.66725
574dc03e-5aa5-4cc1-aeca-895effa640df	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.667521
a31f7f3d-f023-4273-aa34-ff536136a0f6	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.66777
f563b04c-4b89-45ab-a4db-7c2b2b769c7e	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.668017
becf8a32-c8f1-4132-bca9-dcf526d9bf70	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.66827
14c5f101-f422-44a7-a197-f7d869e13b23	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.668546
a5d1543f-b999-43ba-9a8a-ab93692f8ee7	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.668844
0a777ea4-7737-442f-bad2-c3153f5b3a84	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.669095
0ac2963c-d58f-4b69-8bb6-68acf6299c87	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.669363
0b575c75-a782-4afc-9ba3-5606f79057ed	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.669679
5aa02b12-17fe-4363-97f6-d97498f46ce3	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.669959
57377579-0553-40ec-bae8-f060eaa00573	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.670224
3af75234-26ad-49e1-8c3d-a7837078fcda	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.670508
bb2a642d-4242-4851-8bf4-6f148763c9f0	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.670793
64a06171-5188-4f38-ac27-c71f01a6f37d	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.671079
00290d2a-dfdd-4fd6-8333-4c9bc81a256a	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.671393
0654c0eb-7db6-4dee-bd60-c610a84d1c95	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.671671
8a059181-5ff5-4739-8c0e-3067cdc3c1ae	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.672146
0da6efbd-4191-40ec-b6be-4257071dcf10	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.672491
448e78bf-26ba-4b58-8641-5a632fede356	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.67277
c6818df4-9a39-4c4f-9066-3aea24a8541f	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.673037
56e870d1-bf64-4b9f-91a2-fcbbcbf2e12b	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.673331
d6535328-3a54-4202-88ac-5bcab85907c0	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.673612
e403e94b-2792-4f17-b284-1ecad83732d2	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.673876
c2c0e6ae-64af-454d-937c-c8a23f527c61	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.674162
db922af0-e6e8-4748-b122-52334a26871d	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.674434
54645422-da0f-4b93-b00e-f14c79c0e7d6	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.674742
49ec9754-0f69-4533-a284-3acf44686aab	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.674997
0b7e6b73-e9d4-4af8-a959-b3f736f1a46e	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.675264
e610b144-5633-40d3-b62e-be405f0b233b	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.675533
4027920b-4ccc-4480-b442-5256ebf08b9a	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.675807
988882f2-05dc-4b92-b9d9-35dd6a5986aa	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.676076
22fbeffd-b21b-4053-a680-ad6503325cb1	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.676364
c87f0c9a-5af3-456c-8ab7-dd92024bd8da	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.676619
157a8541-ffa2-49f6-8b34-8c97038169ac	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.676884
1c0421bd-5929-49d3-a268-f90f63648e22	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.677163
610e0549-65bc-4cdc-89b8-403dc3f03eed	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.677454
93f829f3-7930-426a-addc-3011b11ee809	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.677704
e8d33cb9-a70b-4dd8-943a-b097bb273d91	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.677957
2e45f783-dc9e-4bc9-9cd3-f759e444766f	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.678246
36ec392b-a04e-4e52-98c9-d916f6193786	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.678522
0e6a106c-b5dd-4acf-adc3-f196e987ff9c	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.678787
b7201e6c-2b96-4080-a61f-e2469177101c	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.679042
dfaaf53e-4138-4690-b29b-d1e13a8e1e00	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.679308
d7a35534-399a-4885-af2c-7684fb5edadf	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.679578
9d1f1607-969b-4cf4-99c1-62ce013d3187	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.679833
ebeaeb78-fd92-46da-b224-377d76477f6a	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.680096
3e8a2427-c16d-4c8e-a490-338453965138	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.680391
c9eccb1e-1fcd-48b0-aae8-4c6872c011bf	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.680676
dde59563-5c7a-42cc-988f-3407dc408651	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.680936
c7a610be-eb5d-43cf-bdd8-a624e5c3847c	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.681208
7087c5f2-d31c-47d7-a2a0-e324c254f5e5	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.681495
6f5e08f8-e2be-41dd-91bf-4c347248ffa7	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.681757
853dc62d-4b57-4242-8a2e-d62d88c089ac	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.68206
70a99adb-74a7-46d7-b2e9-2c02e46ad0a8	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.682353
48440e30-9b9c-4080-bb17-bd52b5c7a259	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.682673
cd92b3d5-83dd-4b50-8992-8093d491363f	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.68295
6d762a9b-2501-4114-b501-1f708831095c	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.683225
2c6347af-9114-4994-8cc5-00724152d764	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.683527
113c22b1-3b26-4706-aa21-44b7b4aef651	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.683805
de147911-2853-446f-823f-e0b5efed3d98	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.684115
78426a01-17ce-4449-bb80-909f81a5a92d	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.684472
d438e1e5-9b25-4a0d-a187-e63bdc1a267f	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.684733
579bfd2c-c524-4350-8064-e5cf48a5ab67	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.684989
5fbe2ea4-f6c7-48e3-8033-2a1b00b30b8f	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.685269
86bdb5f5-079e-448d-8879-9a15585ff5de	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.685532
901fcddb-3584-406e-b3ff-8cdec70931a9	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.685854
b9b65170-a841-475f-adf2-fb2314823490	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.686151
e04f1871-1857-47a7-8db8-a93f4ec6f137	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.68644
a7f4faee-fd13-420a-aead-e17b965bcc4e	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.686711
330e6179-5d66-45ec-a436-360f52e365e0	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.687001
38dcad5a-733c-4985-9de2-cf8f208b91dd	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.687283
409557dd-0eb2-4fd1-a6d2-2b8eb1b5d2c1	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.687772
a6b3da8a-705f-4af1-bb65-48f17170b104	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.688043
214a0f58-4ab5-4e50-8c17-b471277144cb	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.688328
57649165-035b-415b-bc1e-1f50740a9bbe	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.688584
167abcf0-3d50-4401-95bf-2ad2ed34ce07	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.688846
87e3462c-fbe8-4584-a750-4ed9c9810494	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.689102
91abed5e-d452-4ec2-a1e5-38bcb8758e74	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.689382
79a2d9c4-b47b-44e8-a90e-bd2ee03cf51a	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.689642
dcf56454-4ef4-43d7-994e-09c3087d8f1e	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.689896
c5cabea5-1c3d-4330-a237-041128c41337	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.690169
32e4fde6-1c88-4b40-8458-761481dad6e4	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.690454
b9aefc3d-eb7d-4477-9662-241cb9ff3f1e	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.690719
4cf6048c-fecd-475a-a3f5-8d5f8ab43cac	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.690992
998a276d-5c95-47fa-8392-fcc2380ede4b	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.69126
198aa22b-d91d-465f-8bc8-3ff3ebadf0ba	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.691515
b72f4da6-cc3a-4b45-ae1a-1f7456fa3bd6	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.691776
7b5da394-beba-45f8-ba7d-af845e205607	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.692048
f1d59d7c-6aa6-4fd4-a51d-68438a56258a	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.692406
b093f71c-b761-4ab2-9bf1-ee1a7ff9cf72	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.692668
84cfafb3-48f5-4041-bcf2-9c64178c8ac1	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.692922
fbbe2ba0-ceb6-4f55-86c6-06a11ca18a65	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.69319
d01ec4d9-f5ff-44a6-9d07-8c7ee4e69d1f	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.693442
295c241b-5b27-4de6-b5e5-5a9b087c6e99	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.693691
80fecbf0-d53b-43d4-b311-c0038f7839ac	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.693965
4f86bbff-2271-495d-a034-65d9e50546b3	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.694236
b6b63c72-b01d-4617-a702-d741f5655889	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.694511
f53310af-80a7-432d-aae3-dc6c0b4f47a7	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.694783
a852cd9d-1061-42d8-a470-63d0523f9e6c	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.695035
2f84afaf-a837-4090-8f78-d67c128c1fe9	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.695322
1ce73599-4399-4a8d-9e2f-fc765c3c145e	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.695576
88ca2987-a9c3-4d04-ae68-150880329fe3	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.695835
69bf0573-7be8-47a7-b4a9-0d4170371560	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.69608
23402e50-2d00-4ace-ae1a-d6fb877d3e2c	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.696393
3f0e76a4-e593-4d5c-a70f-2076aa9a146e	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.696656
1c007652-0588-4dc3-8eb4-864d711f1b4f	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.696918
12f43569-9b04-45a5-98da-210de46504f5	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.697176
c444a2e7-9c83-4966-acd6-284a399eae53	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.697442
805a98ab-21cb-489e-94da-686069fb186b	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.697687
cfb78697-329b-41fe-a061-c8b2a02a4f43	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.697941
0c616d03-107b-4f0c-bfca-2c8abca6eb85	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.69827
062db1b5-6546-4327-9287-98a7d12b68df	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.698545
0994e3e1-08c5-4ece-9feb-fcfb2787b3e0	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.698797
6d21261e-c5ef-4998-af0c-4163f20891df	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.699081
f698cc19-6583-43b8-a1ba-27d020577544	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.699382
0bacdd1f-382d-486a-ae11-e073d697b136	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.699649
6a498174-f95d-4574-8ad9-44df78c9dad8	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.69992
ab711dda-9052-4f24-af44-54a2aa1ff549	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.700195
3f508a11-5816-4e55-b847-ace2883363a6	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.700477
87a45b6b-edb5-4699-8c61-ff65d78b464e	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.700727
87f4283f-aed6-48dc-9400-bbff37cae857	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.700974
1baa6a2a-2ef6-45ec-9e88-b4c490c0eaed	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.701283
885a2404-8b94-4416-a95f-6fdf462d3454	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.701563
0b26391c-ad5e-49cc-ab05-5cbb9ee04857	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.701825
cf1bd5a4-72e1-4dfc-b594-c7eeda302733	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.702127
ecd61f2f-a213-441b-9db7-b3a4198bb9b1	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.702444
1ab77fba-26c8-40ae-a2d0-4766950f1914	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.702733
69415b25-aae6-47e9-9ace-f9b75146bb45	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.703031
f9b6839d-b199-4a4e-9fa0-c7bb576dcfd2	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.703326
d5768b3d-a0ba-4f94-963a-5a9bcff9bb1c	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.703602
8033ec3f-c93c-424a-8fb0-d5a05c6c12f5	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.703879
da0e8c32-bd62-428d-9fcb-7597649cc898	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.704156
dd3e4865-b91c-4bc0-81aa-cc959c62544d	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.704481
b9dfc353-de76-4d3e-8924-00e5dbdc3f46	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.704804
a15c6442-407b-4086-8992-f3c9d13be66d	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.705094
ca831b87-ac20-4136-9ee0-c61246f9951b	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.705373
18785cf9-91fb-422b-aa13-2abbbc8bf512	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.705637
1081606d-4878-476a-aeee-706e070750b8	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.7059
87e61c0a-f885-46fb-9a9a-04591f95a2be	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.706183
07feadc5-c7d3-4800-a0c5-016911431ec7	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.706453
2b543db9-1765-4fca-95e2-567f82c73b43	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.706707
77dd8981-d5fc-4790-b235-07d5b69ef1fb	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.706997
3f0b7d4c-4597-4bac-9fd0-f28174de884f	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.707401
40f8e6f7-ba57-46fd-b16b-729a447c9f26	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.707678
df062959-3071-460c-8217-a779cd074720	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.707963
e2ad5e11-6c11-4911-8fe8-00f919620f27	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.708264
10879ab7-08ba-4358-8d56-e0a4a32cdc65	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.708529
66fcb580-f922-4b8f-8d48-8d7c7a33bf79	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.708804
033ea9ad-3286-4217-bd7a-112ece4b90da	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.709053
5757eb6a-c44f-4012-a262-fea85ff16f0d	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.709311
cd8aadc8-79e1-4fcc-ad44-b696deb09f4b	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.709603
20a4bfd4-4ce6-4da8-bfb2-27e3c213c4d5	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.709865
72bc7489-5af9-4f72-8ea9-633f9468fdff	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.710135
c19ee9dc-6827-4a6d-bdfc-831cc301c6ce	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.710382
f893c1ae-0450-4a9f-a52a-9badabe653c5	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.710637
0cdcb5ff-18c2-4f9d-9aa3-5ea30498f206	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.710957
cc9ff1c2-ab0e-4fab-9c7c-382b66527ad8	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.711234
6038acd4-0e6b-4ff0-9e5d-67d36e74d737	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.711528
780d89e0-8034-4cf4-9fda-736d6fa78522	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.711841
99a31cb8-c29a-414f-a0d3-3e08fc924711	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.712141
bc0488ba-b6a7-496e-8c04-1adeb12d9a3e	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.712467
4f69dec2-b7ea-4920-9689-23c7264c3608	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.712743
fb77a67a-efc7-4ab9-b996-f3bc971d79e9	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.712993
235620da-9061-4087-abd6-f23b57ae360d	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.713233
312b5f31-229b-4642-a30f-c528b4a989a4	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.713488
5907b6fb-0578-4b49-b9fb-eb8b959f95be	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.71374
06c0ab75-2ece-492a-87e4-5ddcd3dd1da7	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.713975
3ac0efbc-65c1-4cb4-9637-6d67c6995fe6	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.714244
6e4876bc-31f3-46a5-b363-433ce8bff66c	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.714512
e50dfe4c-0386-42e1-9b77-467d44441aa7	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.714762
c9ec3bc0-7c5d-4fa8-a57d-7a6d1f22d3b3	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.715011
016bb7fd-e6c2-4f91-98d9-4d6c70457b63	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.715258
a1fa0e83-4225-406e-b737-5215fde487c9	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.715501
08e8cc04-c5bf-47bc-b408-1b87447007ee	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.715791
05d75914-85ff-428a-959a-266b074efec8	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.716102
b76c9978-be21-4563-bb27-c5ded2095adc	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.716398
ba7f3ba2-8bbb-4c9f-8fa6-d49edb1fc47e	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.716667
cff36459-a585-4855-a561-6d4d9cbf5499	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.716954
f0f4abf8-edad-4537-8d35-1291ab6b1491	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.717221
c2c7f2e4-b6d3-4578-bca0-5f4f53061b3a	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.717479
3d5b92fd-ec10-4590-bff2-6d8c46b654b5	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.717748
c39a0534-53b6-4ba6-8e13-e650a8efa963	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.718034
de698853-433c-4d79-ab90-0ce84020488f	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.718342
72d723fa-457f-4743-8784-40dd50478847	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.718635
55bbdb95-80a4-42b8-9dd5-0a3c49d3830b	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.71894
3e6fe061-da36-4aba-8feb-da8ae25465b3	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.719209
e3a498dc-2ede-4944-89f9-8022a97a9d25	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.719501
26add9a5-8c2e-41d5-8f3c-9579548affa9	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.719796
f13b8f3f-6290-4333-bdde-42011ae2cdb2	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.720066
07584041-ca55-47a2-977e-6cc68a53c4f7	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.720413
705aa514-dcdd-434f-bd19-8c1bc3cc63ec	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.720668
51da2ad8-d53c-4f98-a46a-22da35e5c8bc	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.720935
c882b10a-c1c3-4bcd-9a57-e91090c2f425	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.721419
97cf2351-4cdf-4cce-b70f-9e91766bc134	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.721892
7f6bef22-c5e6-4927-99bd-10a575936823	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.72223
aa6ebcc2-595d-4b8b-b646-6bf71e51e236	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.722537
f50b3fe0-ba61-4b32-82e7-55fbc3e31e18	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.722845
3fee495c-4286-422f-91fc-f0524e4988cc	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.723143
9dc8172a-79af-40e6-89d5-8c8d0a5443a9	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.723473
21b7bce3-7493-4f3c-ad8f-d86761f83a08	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.723744
f251fa05-2bfb-47f5-8c8f-1f0ea1fd8360	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.724015
b99f0f88-7c7d-46f9-a410-ed0a0cf7b798	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.724324
121afb24-377d-47e4-8063-f57276b4b3fd	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.72458
c33ad104-6d30-437f-b135-ecf6cff432e0	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.724857
3248a889-75f4-4b78-9076-ddf71b08bc0f	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.725142
1e0412a0-ce90-4903-816a-a49a16dba070	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.725461
84e976e1-fe04-4fe1-b416-18716e62c3fb	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.725738
4d272e7f-195b-4290-95ad-e5c2f4b9d704	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.726002
d9f70167-ff96-4291-ad3b-84a51a9a9ece	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.72631
3877aa21-0666-4586-9830-8b13b12de301	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.726581
00ef1b85-1a1c-46e4-b9c5-6ab67bf73c9d	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.726846
a90f3014-5a79-4efe-ad60-8b38a228820d	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.727115
d72e582d-42dd-4f1d-96eb-bdfe326d842c	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.727386
ae820b69-241e-45fc-94c3-8306159e508e	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.727662
ffdc1bbc-e5a1-44a8-b4e7-7f10df929362	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.72792
15650ace-66ee-47fc-bb6d-39fc096dd3e1	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.728189
015a6579-be91-4208-9c2a-ff008a25a64a	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.728461
d6be9bd4-505d-4174-9fe5-6b7a6682ed0f	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.728752
289fa11d-5b80-42c7-9e2b-25b4ff39173c	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.72902
1baa702c-1b40-4412-9946-15891785c5a7	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.729382
70b77110-5571-49c6-ab57-6feea812cf3d	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.729705
d1174c26-1d14-404e-9f94-97182aee9871	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.730001
8493eb25-b6b1-48ab-95f9-5dcaac1ae4d9	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.730365
c4f29b3c-dcce-44bf-a3e4-b47e8bc396d8	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.730682
bbdd08c7-8126-4b7a-ae7a-bfc91a9962a4	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.730977
a1aac011-0f9b-4efa-b4f2-bf0aff3d0244	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.731301
ef407d5d-de09-4e7d-bb58-b756832573c7	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.731578
51c43f7f-59e2-4c6b-b98d-1bbc0138777d	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.731886
d61905d3-e16d-4ed7-9622-617e6c30f9a5	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.732153
cfb28dc6-bb87-4136-890f-ecb6cb1c99c7	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.732424
f65bacf9-b502-49d8-b972-445463dfdda4	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.732715
3d4ee0e0-632d-4afc-b163-01cfe498630b	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.733219
3ad83b2d-4896-41af-9c3b-54437233b107	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.733619
606bb0fe-440e-4ce0-9f1f-2b6399a307e7	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.733932
76de5393-595c-422b-968d-096e8f968173	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.734301
2af9bf6d-0984-43a0-8264-de5cf72b4e01	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.734581
699a1be1-a5b4-499b-849d-03ed10958e4c	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.734831
12ab9653-acdf-45aa-b5d5-99d59169b039	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.735072
ec389ad7-b7c2-4432-80da-15fa682af370	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.735354
ccdd6bb1-3d18-4071-9716-1a4ffca92959	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.735644
92cdfc4e-31a1-4644-a90b-d801dafd4a62	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.735886
5f50759e-d8cb-4d58-be56-4672c2134c34	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.73611
b15c43e1-b3e4-40f6-9d41-9de622a7ff18	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.736335
bdf8f801-c13b-4b58-b66d-8832981588f7	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.736593
dfd01fc5-c5d9-4af1-9f67-8b311857ec8f	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.736866
e1232f4a-9ca9-4c27-9dd7-03a75cac443a	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.737096
a0258b9c-e895-4245-82d1-0c364fe0f380	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.737447
9753a3d8-c563-4982-92b1-892a313568f5	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.737835
500902bf-ddfb-4dde-951a-1e0c615e7120	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.738101
24f52bec-c70d-49fd-9ce5-fe20ccfcad96	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.738356
fdb50831-0c04-43fc-9606-206ec7fc00c9	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.738586
78dfc633-b982-4abe-bf4d-8f866f2959bd	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.73881
036ca368-4389-4894-a44c-8ea2ff029b9b	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.739178
b2b47caf-0970-4d7e-b0a4-e8bb7a2c4e3f	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.739508
3840c445-a29d-4f1d-ba59-03354deb9dc8	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.739773
0737c181-2491-483b-b880-124026376996	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.740017
8f146313-5d36-4aa0-8e04-b7f0a38532f3	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.740278
d0b2ae7d-0304-4d0f-8a39-333028f93bff	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.740579
e85a19de-c621-4822-8b6b-d3fc183e8f88	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.740874
01407e37-ccde-4c2a-8f56-c91418e42262	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.741166
d6104536-f958-4bfa-b915-b3d2bc7ef287	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.741426
6c2a801a-b32f-40b3-96d5-8b5c7382e007	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.741685
3c9cdd52-84b9-4230-8382-365212f87d92	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.741938
73c8cc29-fbc2-4105-9f03-811ed8069650	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.742257
a0405c9c-0792-4967-8fed-67b92076c14d	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.742593
d8f79bbd-2428-44da-b4a3-997e8e969bb4	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.742937
409487cf-4533-4341-89cb-461ea46783b3	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.743204
85b72819-444c-4ca7-8e79-4a6029b0f1c8	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.743524
29c0387e-b83c-482c-b489-4ad0a1bd484e	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.743796
d80e2a26-da66-40be-8820-629dadbec2c1	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.744049
46d1259e-b747-4c54-9924-2caa484881d7	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.744318
d509484f-b696-44cc-8e6d-b632ab8d73da	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.744595
e8600baf-80ee-476d-8b6a-b0d01966c4bf	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.744899
23e451da-3769-4390-a211-c30cdc971a18	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.745168
abf821d2-50e3-4456-86a5-025f439ffddc	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.745545
5b44cc8f-64fb-4dd3-a143-31502dea3963	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.745816
cf5352a2-f1f0-49ec-8a77-12f8a79056f9	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.746079
21d96cc5-8da0-477b-ad0a-4f4feb5a9c76	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.746354
9a29e6a2-e1cc-4b04-bbef-742df30b49f9	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.746619
48c7c29a-b924-4d5f-85cc-bbd5b51634a7	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.746872
c121315a-0894-459e-8687-434dbc71f758	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.747135
d1b7cfdd-d033-419c-b24b-31a2bbd1da9b	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.747406
4bb9af1d-9e28-4fa9-bc13-9ed5f9aeb548	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.747664
e6b28c0d-51c2-4329-8355-45b01ba2154b	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.747897
b1668572-65ff-413f-99d6-5527a2c3966d	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.74816
26aee9ae-e326-4630-84da-f5f2bc8ffd19	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.748417
5c29485e-194d-4124-a65b-5017dc535811	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.748691
429916a9-aeeb-456f-a99a-39ca76879a3e	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.748922
ab1a597c-c16c-45ef-83d8-62b1553bdc7a	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.749155
025b88a9-bd15-460b-834d-73f6c8286233	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.749397
bc7de1e2-9e8d-4ec5-bcc2-337e9c7c7f15	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.749627
a55116a0-8875-4e6c-967d-3f3e80e51e3f	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.749842
bbd02069-5a6b-4b25-ac44-ce922d0e76fc	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.750064
08eb8cbd-efdb-491c-a425-6030466bf4af	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.750351
48265de0-8db7-482a-8cc4-92a095e1334a	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.750573
3f07d21b-b4e5-48c3-a86b-d779a1ea9c27	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.750787
5e776944-fec3-423c-a5f5-56c8d1d2ccdf	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.751008
ebe0a632-4545-4597-b2ac-f8234151fbee	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.751253
f4a24998-be21-47f8-9054-ddc47ba2fc81	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.751472
4ac0ba42-8ff4-4e53-8aa7-bea1472a2e99	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.751672
f8e944f9-f268-4e0b-a9d3-b4c5badfccd4	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.751881
59681462-728b-4457-8ba3-20f12cb42f89	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.752151
56582a13-511d-486b-addb-4cbb92257027	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.752454
a613b305-7248-4de2-800f-c6267e993283	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.752703
a051e2af-784a-4542-a179-70552564b67b	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.752932
bee30459-c45d-4162-9303-eeaffe57b58e	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.753182
8a517f7d-1553-4e49-ae1e-4a4727ca7a3c	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.753429
e87b2e2c-7a05-4cbd-b8af-81c5d64f8771	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.753677
bb3df70c-9700-4f59-b30b-eea548477313	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.753929
1bb2cb0c-741b-4392-a3ce-3a86d37d1952	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.754228
d6ca907a-82bd-4cfa-ae21-08e42b1cfe2e	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.755784
61a1c3c3-2f1c-45d9-9f57-b8bd0c01cdc0	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.756081
da2637d0-ffa8-451a-9690-725654cc0576	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.756368
5dba4719-b4dc-4437-ab82-aa493bf353fe	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.75662
a06f4a8e-fe20-486b-b3f8-9ed7543f81f8	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.756859
e6d12ad0-f938-4dda-9791-216bb68c045c	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.757086
7793038f-23c2-42f6-8778-a2d929a9214d	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.757374
d700790b-84de-4f43-beda-d1f8e156868c	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.757623
093ffb84-542e-4b4b-b51d-41a4b33ef10e	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.757863
ec385499-9e1d-43b1-8d14-c54a9d595340	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.758125
e3389d60-309d-4a1b-a275-959abf3a098f	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.758402
b5e6b561-d2a1-4287-a7be-88aeecebcb93	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.758629
afbb3ab3-830d-4963-94c6-b1bf9ca3042f	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.758863
a9df5ed9-c00e-46fc-88a0-98690bbc95a2	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.759151
802d4dd4-8e1f-4071-8557-02aa62f93589	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.75942
785128c5-6638-430d-a3de-9d744d8334d1	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.759687
74f1cd3e-6fd5-4e08-b3e6-4b9f06994ab5	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.759958
d827e537-5d53-48fb-a0d2-1e26ffc93db4	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.760196
37182e71-a16a-402b-b3a3-fb821c78e282	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.760427
098148a2-6252-4671-9c5e-0d97945970b5	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.760709
f4abd7a2-da11-427c-ae68-1bd275c97ec0	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.760959
17ab95ce-0400-491e-a259-0a64609e7b08	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.761232
33312d76-3614-4829-add2-b21c5a690190	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.761487
3cad2870-9d60-48de-9a0e-235c0f5c5894	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.761728
13d831db-2302-4ebb-b3f9-3ddb20026fee	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.761988
d65d1863-4348-4b3b-a0f9-de97c91bc582	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.762277
22884489-20e7-4d2a-8b7a-2880705fab52	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.762574
5de9cc14-2340-4be9-81af-d2b73553c663	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.762832
f35b1644-0ca5-4361-9116-a7d8978143f0	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.763058
0ae72812-7bc5-4db2-ac5d-b4c44b7644a5	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.763296
98f6accb-d887-4a45-8348-1034d9b67882	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.763514
80c84ee6-3bfc-4c4e-b9f7-411e8d6c94a8	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.763718
9ff20306-604c-4cc7-93be-677cb5a42315	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.763932
31777443-6c65-4b56-896a-189c9a16ef5a	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.764159
37432acb-6801-4913-b4e5-12e08b9855e8	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.764384
e3bc80e3-c15d-4e37-a503-e1467f9f074d	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.764607
ec1b08bd-fe09-449b-9c89-ee20897a36c3	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.764831
d2596ec6-1c85-4860-bee0-d8ca67b03b36	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.765036
8bc6185e-411e-4033-8bbd-66a8c0fdda5c	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.765278
2ecd74f3-6be2-43ad-8d0b-3f91e7abbfc7	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.765502
9ab1e4c9-11d7-447c-9258-66e03ccfd31e	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.765785
d963cdd5-77be-4ecf-97ec-2568e0888b73	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.766025
5a6e75cd-52dd-4642-a2c0-42c3047b929c	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.766301
85a47c34-45b0-4dc1-b5b5-0fd0c0ab9815	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.766565
5e191df5-aee5-44b5-aa41-0e9e56d31c5d	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.76679
4c37eada-29f8-4589-8029-0a8de82013a1	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.766998
74e679db-0d24-4816-b61f-75447b7b1c40	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.76723
c56a3f62-9427-45e5-8055-7a428e80f9fd	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.767445
2fa614d3-ecdf-4d8f-9459-55d8f159f61e	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.767669
cda69fe7-7d1b-4009-9159-6bb9fe71cfb3	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.767883
0c6db3ec-3af2-49b8-a73e-51737c514a23	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.768102
d54f301c-7dce-430c-a52e-a4674b1052bc	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.768379
eaa69577-ad30-43e1-8b17-8fe7091c2f4e	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.768598
6bfb343e-8ca8-4c9e-bd65-8c412b39268d	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.768816
1948e0a7-ce37-4c35-b9f3-658cb69c0539	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.769044
fd499558-187d-42c1-90f1-17720a9b14bc	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.76939
83eac8b4-3bc2-4c5e-89d4-2bfb25e13af7	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.769634
44bb7983-f80b-4457-a13e-22ec20a7f20f	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.769843
ddf08213-55dd-4026-8279-0c2076cd3103	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.770061
a39d7d3b-170e-45f7-9485-d42a2b0b8b4e	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.770301
12a32a12-dc7e-449f-a81f-7a968b560158	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.770571
3f341a54-9d0d-4e8e-b51f-f84fd3aa37b7	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.77081
40d14c61-efbe-4e6f-8619-93c3b48435d5	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.771024
5069030f-29a4-4992-9c3c-833be8ba0dd8	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.771244
93cea92d-481e-426f-9f6d-3150f3e6c613	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.771464
9313c4e0-033b-4375-ba5a-35ad4f90b6a5	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.77168
0745d443-84aa-4e18-b603-69a934f83fbc	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.77189
7296b821-8b50-4a6f-a1ec-e142db7e59df	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.77209
a03f1a49-2349-4ee8-9a29-41f410f7412a	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.772322
3f41d0c5-f4de-4f6d-94ad-c8bf407303d0	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.772553
c1b49622-6a67-4308-bcac-82eb4854ddfe	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.772766
e10eb328-4bb0-4c59-bb43-59be7ab76034	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.772969
261b21fc-e06d-4b4d-98fb-f87844a0b6b6	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.773196
a47721b5-a099-45f8-aab8-ace778be919e	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.77341
310379a6-3238-437c-a5bc-8ec27c36c9a9	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.77361
5d107360-fa37-4e56-9c79-f5c68f95cebf	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.773813
d0a41ec4-cfc6-43a5-8ad1-9c1860deda45	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.774013
b5ac84bc-a402-4faf-b3fd-9024423ece69	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.774238
e996ee56-c08a-434c-b8b6-4f66114231b2	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.774458
5d7beadb-4bb8-48a9-8b9c-500889531ad2	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.774727
c436baac-ccbb-4a85-8d2d-fc2cee9dc09c	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.774984
d5fd99e9-7d62-4410-82da-eb8a67f0242b	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.775245
57561b20-a435-48e9-8b1a-f1edbfa2913a	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.775498
13b0cf59-e8f9-4b75-8d43-3f09c208aebc	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.775713
78a0372c-b67b-4a79-ba5a-16791f73fa6e	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.775923
054e24a4-f1b0-4bb3-868a-9e16936f3a38	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.776135
aa682b79-746f-45ef-be48-eb15693a846c	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.77636
e7638bc2-b4e1-41de-b991-f6aed1c72dd0	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.776563
0335638b-15cf-47ef-b5a9-46cbecaea756	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.776785
f50dcb15-102d-4fcf-b672-774ef365c4f2	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.777046
513a6d4d-b584-42ba-807e-577825d86ba9	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.77736
6f29af49-1878-429c-81c6-2c2bcda5489d	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.777574
f8609d61-118a-49c2-8528-b8d0372e8266	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.777774
52268ba8-7aba-4fde-a774-6474ccdcb1ab	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.777979
5125c0f1-2cb0-4659-8c96-146cfefd3ca0	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.778232
fd5e395d-ce28-4db7-a14a-62e2f67c8971	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.778482
c9c96300-88bb-4e9b-9e1b-6a1e2d24b3cc	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.778693
41f406de-0af9-478f-b9b6-1025628b352b	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.778914
fcb60799-38a2-468a-af2a-40fa1ffa2518	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.779177
a7278c9a-f04f-45f7-8805-d53e6538c93d	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.779419
6f2e6362-1eb4-495f-86d7-859fda5c2af6	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.77963
32e72d09-a8ff-4327-8add-0824320f7a66	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.77985
8095d405-0c8e-4d33-a7b9-ae220be0bf4a	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.780066
69467b43-7779-40cb-97aa-fe2bfd444241	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.780315
92142225-5383-4bb9-a2ed-719ab4b7701c	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.780532
5668871d-d0ac-43e0-bd60-e13bf9784655	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.780865
8a532afe-d5ff-4bac-8766-7a434ada5e81	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.78116
d03d7b2f-d62d-42df-a330-604775e2e85b	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.781557
433edc48-b5a6-4ea5-ac6f-c16d395035b2	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.781859
f227d1c5-7cdc-48f2-98ed-c524cf803ac1	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.782136
7ca38201-d0a9-45f4-8c98-c52151690e57	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.782381
84dfb70d-ea90-4647-9fda-48d93a843b35	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.782613
08bdd267-3d74-4915-b438-30b6e4d21bd2	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.782854
4f7c999d-19cf-45ad-ad5c-4bc89a1ff6d7	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.78309
620dcf52-ce70-40a3-b8ba-72e9e0b6980d	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.783335
a80efbb3-693e-4db7-9c5d-bc85b628ce05	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.783573
75338a28-bb14-4903-9d35-86369fe51297	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.783792
69f42538-6fe6-4645-a688-0049c56c93f3	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.784006
e105c009-cbb7-4d67-a3c4-36ee64069433	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.784222
8dfdc3ee-f557-4aef-b4fd-883c30357752	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.784491
5b3552d9-c19d-4440-95bc-5b21c0a466bd	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.784737
32ba913b-14f7-476f-a3f4-afa32b5b8c3c	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.784964
f783c298-190e-4607-a7a9-ccbcc0d44b56	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.785223
62afd3f6-a791-41ac-b9cb-c27a5f94275f	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.785484
8693ef6f-521f-45ba-aa70-977ecf84452d	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.785711
acd907b1-4150-4e08-a27e-0009428e2d5a	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.785933
fd026876-cc5f-4ab4-a581-16d08ab6da71	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.786191
7b628724-f267-4feb-9488-01d88a9bf4f1	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.786451
13dd5ff0-c30e-47b6-97bf-e611e28d5b79	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.786675
f69b58ec-3bd1-479b-af72-7e84a71b834b	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.786901
8a0cc479-4784-466a-815f-5e75085a2c44	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.787137
1b17bd41-2064-4766-89bb-5b45e688ba0b	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.787389
8e40e008-2448-44eb-8ae0-5afceb21bbbd	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.787636
08acdb36-de01-4018-8342-c6a40da8f9c6	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.787862
3879329d-20b0-41ad-9be1-81f5fc973632	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.788091
b616dd72-b7b6-4580-86e5-992efcd28d64	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.788327
bc736439-6054-4249-9af8-8d6524f1de49	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.788553
d88914fd-de1b-4a94-bd04-3c2505878045	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.78877
6fcf37e4-b2d4-43c5-ab1f-cae2d0f32bd8	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.789
d0b1aded-bdfa-4457-b1eb-a8c0fd79d791	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.789245
58bc11b3-a405-48c8-94ba-ee49d0a1408f	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.789468
957c5d47-80ca-4cdf-85ac-1aabb872be1d	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.789716
3788c54a-3757-48dd-87ea-6a0f74e399af	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.789947
ffc5ac70-343b-4dc8-9eac-c7cba14bd910	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.790177
4b7a638e-754e-4905-9502-d90abad41b17	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.790406
b8ca630f-8df9-4490-b311-d5f717eff6bf	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.790641
65d4b097-bd22-48ed-812d-a55eb6d2a664	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.790884
ae8bcc29-8c4f-4a49-abcd-28aa9a909d95	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.79114
921e4980-c54d-4849-be5d-28ecdaf775f7	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.791408
225ab319-b222-44b1-9520-13af761324e1	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.791701
aa955b63-4dea-493f-a560-cb511d0d5093	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.79201
b477c91b-ecf1-4b0c-8b8d-a143ec7a5d74	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.792247
d2ab79a7-fd19-4c41-878a-a3bc255669ec	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.792484
d49b32ef-10b8-4241-9254-5fa61b52b898	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.792744
ca51e85b-dd75-415a-bfee-63caaff2d98b	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.792971
a7b615f7-9161-4379-a631-55290da6b5bb	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.793226
555e586e-ab1b-4e97-aa42-16f8d0794b5a	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.793517
d48cb69b-9181-4db3-a4a7-3b4c0c8fe25c	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.793761
00badc55-a363-46fe-999c-1037718dd433	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.793991
1468dc11-010b-4b67-bb17-885aaa580f81	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.79424
02f6fead-8648-4954-ba9f-b2b8c7b71a59	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.794464
32bc1855-85fc-44ea-9a7b-8799417ba0a1	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.794689
8c19323e-3ba0-4091-9c26-e42fa2d4fb54	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.794921
5607d1dc-d8fc-4f4c-aacd-61b4baa1c657	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.795168
f5b85cf0-bf1e-45e8-a93c-44d61e4e64a4	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.795415
039dc506-1b59-4a83-9573-0a719b8dd2d5	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.79567
1af176fc-cf62-4283-8bcc-fb3a4c61c261	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.795915
fb156cc1-bd7d-4d60-b0cd-dce80e4c4337	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.796153
4575eb7d-fd24-487e-9718-a7047a59b4ee	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.796385
d4c712a6-337a-4f7e-891d-9337ac986b52	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.796615
0bf7fcae-e4d7-404b-9b7d-1d611be898d7	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.796848
a8162aec-7c3d-4a21-be00-f663b6ba99c5	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.797084
eaddb7a9-cf8f-42c3-b0bf-d342f8a2c9a8	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.797327
836b29a0-3d57-4587-8139-c520176533f1	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.797548
396b8717-03a5-4053-a485-150201699f5e	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.79777
fff343b3-96b6-462c-995e-12cd4e7274b2	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.798003
2740ff48-18d8-4bf8-95c0-52100ad89286	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.798397
551749f2-0f79-4745-9a8c-5ff187bde155	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.798681
20ef8f53-fff3-4fc9-baf7-c4d8482c4e59	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.798955
c95de6ed-b4ce-4c76-bcb8-e5aa2332fe8f	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.799253
9343aae1-74cd-4b61-b031-03a689c43db5	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.79951
151c07a0-1f65-4b7b-bdae-4d811f6bca29	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.799765
c6a923e7-506d-4c6c-9327-ee4d87dda4f6	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.800033
73ca86b8-ee33-405a-9dd8-0afa5d7246d7	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.800302
4fc0eb05-5920-4510-aa1e-41cb0f191739	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.80058
99cbf801-b5c3-4430-9ef8-f4c615453032	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.80082
27b89f15-e9e6-4412-84af-9a7eee97a95e	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.801048
f4ce40f5-a58f-4a90-9cfe-0efb181b80ab	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.801314
143f8eba-f709-43e5-85d5-f96c7481f8f8	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.801562
ef3d4bff-d1d3-4b86-9313-e04507a51f37	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.801794
9b40d841-091f-4b54-bf90-86ae2f993fcd	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.802009
3078e1f5-233f-4c27-9cb2-9b2cd9aef860	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.80228
f1b07cf0-e909-4ecf-b690-7032b51b5323	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.802525
eb75ac42-2f7d-4abf-b871-afa71d7e5f9f	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.802759
3302c9b6-969d-44fe-a119-3aab54349393	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.802989
89408269-2363-46ad-9958-f2f4203f3e35	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.803243
a592dbd5-b313-4957-b786-36e9d033c791	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.803503
3bb046c8-ab82-4119-b8e8-0792452a6add	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.803747
7b433e6f-686d-4509-b64d-1db52d14f118	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.803983
1f00b153-92f0-4ed6-8473-5f13bf897313	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.80421
2ca25051-e65c-4d71-abdc-a6e9419bca60	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.804446
07741574-c806-4814-8016-53ed5a414a01	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.804667
b7800a90-4d7e-46b1-b52e-1480ec0307e1	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.804905
a0deb629-811a-4caf-a4e8-2e8e898e6dfe	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.805165
50a5342f-46ba-4d55-afd3-2519aefad729	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.8054
9471c5e4-d448-44ff-b5b4-cf64756be7a0	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.805646
d409a75b-244c-4801-9f74-f6b75b498596	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.805927
374a3b83-8f64-4f4e-85ca-98df28a1efc7	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.806171
e8e63a7d-40db-4c63-9ac0-a43c9eef56af	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.806413
3bd51ddb-c1af-4343-acdc-5188b53d79a7	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.80665
3563b8e3-b4ba-4028-aaef-3718f64ec960	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.806891
f7f7f5ae-7651-4a50-ba12-ffc0e00ac07c	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.807149
6ba28670-3905-4b64-bcfa-2a5508e782d0	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.80739
68b6a358-836e-4b37-8c10-12490f173982	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.807652
0d849483-44d1-4736-a64b-9ad859b6c53f	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.807918
e18aa55e-6f85-46a2-ab94-81457869dab0	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.808146
dd2c9965-46c5-4cc6-ad3d-f129027d7063	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.808418
503cdd1e-2dde-4494-b079-7f8a56d46d10	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.808665
1659ac9b-239b-474d-8d8e-c04cca90c49f	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.808909
9ec9651d-6ec1-4454-89bb-c7d21c5ae42a	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.809198
65ca3cfb-4b4c-4799-8e35-092de1cc116e	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.809474
20a7194f-b3d2-44fa-b27a-25a3f9371ad4	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.809726
d9280908-5d53-47cd-b870-c6d4febc1e87	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.809962
f40900e7-d76c-46b2-82d3-cac54b438324	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.810198
de51f55d-89e4-4df3-94a3-04130bc8fce8	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.810424
d5b35a72-cfd1-470b-8522-b0e958a08f7e	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.810667
e4f3760d-f7af-4210-9481-b26603ee283e	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.810916
80251f47-55cd-42ce-8947-3a5dfe9e2bc1	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.811223
fe94c212-819a-4cd3-9e13-13ab1a73ca59	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.81147
49b97a30-f9f2-47b9-9bbb-38e792a34265	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.811713
d9cc533d-9de6-463b-87da-aef5866148f9	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.811946
57a422e3-32a9-47fb-91a3-7af0589d711a	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.812191
10351f3d-1c10-434d-873f-f1a215773893	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.812461
ef4e8f14-b0ef-44b4-a59d-608ead234d6b	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.812706
95532750-78a4-4eef-af8c-7b620b5a4f7c	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.812944
3bab369c-efd9-4320-b0b7-b1120b4a33ce	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.813177
897637cf-0fec-43f0-a62d-aaf40e8430cc	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.81342
0d5fb4f1-35df-4892-b4d0-abadcbf06f20	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.813661
5c1e3411-5834-42df-a36f-c7ed4c024ac1	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.813894
27d3257f-5949-4f53-a5be-373a9408bbb2	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.81413
7e1b60e9-cf45-4741-ad32-775d7094d411	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.814376
8c2d7de6-6cc7-49ae-9eb9-7f6b1a7a610f	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.814614
d40df8a9-2316-4138-a2f8-6f54bf3e7b4a	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.814833
34b78af3-809e-4eb0-b4b9-b94e584037de	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.815064
b3ca8084-db53-4719-afc5-e8ff7dae41e2	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.815305
5274e65a-ae41-4546-b3cf-515c16061daf	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.815545
e52c521c-c396-4f25-84f7-d16e0290dc35	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.815771
29446cb3-26bd-4c15-8c68-08666b1d8cc6	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.816003
d4265d28-9039-4f58-823b-041023d4e3b2	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.816255
6af2d465-49f4-41b2-9bca-cf9865471e98	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.816496
e2b9261d-6eac-4e71-8312-c3405ff89063	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.816725
627af1da-db82-452d-9c13-dce67e31e70f	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.81695
dd62c585-f324-40f8-a013-3a67f001bf26	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.817173
1848fddd-3f07-4469-b476-60fec307b1fe	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.817421
cf2b760d-ff30-4594-9c16-38f4cd0747b6	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.817662
f28fd53f-d772-4c39-a63a-33f7da3b9257	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.817886
b2c3c0c4-6a9c-48c2-b509-468609686756	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.81811
3198cd7a-287c-45b0-984a-4f52820dcbcc	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.818353
5efeec97-e65e-4376-be25-baa55387efc8	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.81857
8355d33e-3c72-48ac-b28b-dffd720429b1	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.81879
a678cfa1-80cf-4f03-a01e-be0fdf01c676	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.819027
5cf23225-f001-4e79-a558-66c702e5fb22	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.81926
e1303406-3eab-4792-8cdc-5a5751a96a5c	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.819484
5790624b-79ca-4875-a799-6b335cdd3652	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.819722
88cf9ec6-4321-47d7-8219-90a3b94c30a4	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.819948
54dd40b1-b8bb-4673-9d2b-b163a660e157	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.8202
76091aa3-1d99-43da-86b2-57d7b0c559d2	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.820438
647bbad8-e1a1-4141-a6a9-4d25e11171a4	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.820666
4ab27e82-21db-471d-8758-f067f7d4794c	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.820893
fd7142f1-4733-45d8-933f-e13208fd15e4	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.82114
04e31873-c0df-4a97-8220-05bbb2d7d43b	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.821409
a6a812eb-802f-4128-b33c-cf410604038b	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.821631
a332e053-3199-41bb-af4b-6d0968292e1d	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.821844
039d1492-cf54-4459-a6e0-35fbb745ff6e	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.822064
8b924541-6704-4cd2-9a20-1d796e29aca8	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.822337
7a348600-ca70-43bf-9f31-9a029c8f2d28	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.822579
3d3b0469-fa8f-4005-bea3-089904480007	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.822814
936f7601-7045-4b6a-986d-d4bede8750d3	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.823052
399d249d-cf7c-4db4-ae98-14cffb1aca59	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.823313
f0c82376-edaa-4556-9556-9c1d2b11128d	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.82355
4559a3cb-3f2f-475f-b5f3-ba056cd862d4	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.823786
e74ce0ab-0d3b-47a4-a883-b1e88ad7f02f	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.824011
f30df6b7-9903-43b5-a628-fcb1b0dd8ab7	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.824249
799c559c-8388-4807-9f83-f78425bedd2a	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.824475
5d7e7140-d47c-4b2b-8572-b97f4456d498	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.824698
a875a7be-b006-4459-b1dd-6b75164fe25a	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.824938
bb4e4b0e-a19a-4327-baa2-bf840cae98dd	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.825172
e5a186d8-37bd-4513-9b08-195941552462	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.825431
9cf5c588-b333-4b34-b77d-b2fd24d43cd1	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.825687
59247323-07f5-4494-906c-ec81d96d4af2	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.825914
c9bd4da5-4acc-4788-adab-f06971986361	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.826157
c91d684e-117f-4f6d-a846-a59449c2c6c7	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.826394
910d11c8-69c0-4c61-b6aa-7b8af7452fa4	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.826631
a8f334f4-083d-483f-a79b-bb4ceaf2ab2f	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.826863
190776f9-dc2e-4d86-bd61-34942dc46ba8	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.827087
3d625586-f5a5-47f7-8d35-21b5a3d97bbb	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.827333
353d2f5c-b995-48bd-a953-e5955592fce4	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.82756
bed7ac9d-0adc-4b97-897b-f2ae94c805fc	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.827791
283268b2-39cc-4204-8eea-f639f3557fd9	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.828009
af1ded60-1b33-41af-aa3f-43def0c3e262	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.828232
3ccd8d49-a390-4633-8733-f667397de862	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.828461
3522599d-8ccd-4cef-9242-7aa699e58790	ff29da8b-fdd4-479e-9dbe-926c20a15814	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.828691
97d81d03-b051-4357-9938-a1d217d8ad5d	ff29da8b-fdd4-479e-9dbe-926c20a15814	163eaa31-6f22-4fcb-923f-366c33aba3ae	2025-08-25 14:56:37.828911
8d0279c7-5b4f-4e5c-819f-ceecf5053011	ff29da8b-fdd4-479e-9dbe-926c20a15814	1cdddc57-ebbd-4a73-8441-e4e31adc88a9	2025-08-25 14:56:37.829151
efd51b4f-96ff-4fd2-a0ef-03db93aa798c	ff29da8b-fdd4-479e-9dbe-926c20a15814	016936c4-1259-49a6-83fb-e6a00ec371b5	2025-08-25 14:56:37.829412
8891281a-2758-4db6-9a95-560b67fa3939	ff29da8b-fdd4-479e-9dbe-926c20a15814	127f9164-8694-42e7-9c05-49d938a26136	2025-08-25 14:56:37.829635
3dcffbc2-391a-4b9a-aa00-82dfd023d1c0	ff29da8b-fdd4-479e-9dbe-926c20a15814	146c406f-7923-4adc-b88a-1d6ab8f38a78	2025-08-25 14:56:37.829857
6a8cb9dc-cba1-435d-999c-157c4c8527c8	ff29da8b-fdd4-479e-9dbe-926c20a15814	205f38c0-53d0-4707-a0e4-4b40d5f4de4f	2025-08-25 14:56:37.830083
da2dae9c-9a89-465c-ab0c-f111afb840f7	ff29da8b-fdd4-479e-9dbe-926c20a15814	049a375c-51c6-4acb-8b1b-b8a1b3a469f7	2025-08-25 14:56:37.830321
1c451056-1da6-4f4d-9f60-09b01b473cb0	ff29da8b-fdd4-479e-9dbe-926c20a15814	0903bb18-b157-4cb7-8851-197196b0d258	2025-08-25 14:56:37.830542
c9df0a3c-536d-4806-87de-9d09be007a95	ff29da8b-fdd4-479e-9dbe-926c20a15814	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.830767
db275b22-d134-4090-9f1d-f4ff691ef591	ff29da8b-fdd4-479e-9dbe-926c20a15814	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.830987
04ab21f1-3a03-4bf2-8cd6-8617b1736b6a	ff29da8b-fdd4-479e-9dbe-926c20a15814	0832df0d-471c-43bc-bbec-f9db442e8669	2025-08-25 14:56:37.831205
389beccf-2f84-4da3-9be9-2f2cc99949de	ff29da8b-fdd4-479e-9dbe-926c20a15814	0092c8e1-4295-4d9c-b07d-4608225d1aaf	2025-08-25 14:56:37.83142
6cbe1487-adc4-460b-a129-cf312ebbd571	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.831654
329da7ad-fc3d-49e6-b7cb-78973ddec9c0	ff29da8b-fdd4-479e-9dbe-926c20a15814	110f450d-3989-416d-89d0-974f01c88e4f	2025-08-25 14:56:37.831912
281cf3f6-30fd-4828-8956-d56726f5e150	ff29da8b-fdd4-479e-9dbe-926c20a15814	014d7cfe-6724-487f-ae0b-5e31b4aa67fd	2025-08-25 14:56:37.832159
d772e3f1-7663-4ed6-a14c-5aeb37acdcb7	ff29da8b-fdd4-479e-9dbe-926c20a15814	0ceb957e-34ef-4727-b719-cf5e1866fff7	2025-08-25 14:56:37.832408
642eac72-0c75-47e9-b8f2-7577cfcf4bb1	ff29da8b-fdd4-479e-9dbe-926c20a15814	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.832639
ec096b32-02f1-4aa1-8b1c-85d651a2c67c	ff29da8b-fdd4-479e-9dbe-926c20a15814	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.832857
428f4edc-0de4-4d0a-babc-6a8aea496572	ff29da8b-fdd4-479e-9dbe-926c20a15814	08da5ad0-5dd8-4798-bb83-6e07b1e9039e	2025-08-25 14:56:37.833075
fd4f8abe-af34-4962-b694-2246ee5f7a0e	ff29da8b-fdd4-479e-9dbe-926c20a15814	1302ba45-5c4c-4378-85d5-411606032e19	2025-08-25 14:56:37.833301
3993d5c8-44a4-41d4-9fa0-b26fec9eec20	ff29da8b-fdd4-479e-9dbe-926c20a15814	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.833516
a2736729-0406-4c8b-907e-c29f5328f38c	ff29da8b-fdd4-479e-9dbe-926c20a15814	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.833735
2d2c5a03-47fa-4712-8b1d-096ecbf48184	ff29da8b-fdd4-479e-9dbe-926c20a15814	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.833953
5f67f55d-2aba-46e7-a9e9-600930e1ba67	ff29da8b-fdd4-479e-9dbe-926c20a15814	054cae28-56f7-4e36-bd21-f2fc9faeb641	2025-08-25 14:56:37.834187
3e94861e-a798-4120-9f16-391e431f2b17	ff29da8b-fdd4-479e-9dbe-926c20a15814	1237e3fc-df10-42b2-b420-afa9960718b1	2025-08-25 14:56:37.834428
290a38bd-4030-4b8c-a439-febf36615e4f	ff29da8b-fdd4-479e-9dbe-926c20a15814	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.834654
e3715874-764d-4e84-b551-a61a4b04135f	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.834885
e5d44de4-2b28-497b-9dfc-3a755c7a0b5d	ff29da8b-fdd4-479e-9dbe-926c20a15814	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.835118
ba317c50-948a-4cc6-882c-4ca8d5a61afb	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a87450-35bb-437b-871c-c1ff3c2fa045	2025-08-25 14:56:37.835347
dd617b92-caca-40ea-a7dd-8251fd723e72	ff29da8b-fdd4-479e-9dbe-926c20a15814	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.835563
562c65df-591d-4435-b884-8029532c5a99	ff29da8b-fdd4-479e-9dbe-926c20a15814	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.835778
76bc178f-5377-4566-b5ae-066fc9ab0c8a	ff29da8b-fdd4-479e-9dbe-926c20a15814	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.835994
b2b1d589-3c29-4ae7-b3a4-f1b57368e5fb	ff29da8b-fdd4-479e-9dbe-926c20a15814	08367bc8-16c9-4d59-890e-c62e240d05f0	2025-08-25 14:56:37.836228
8128a62a-4551-4ade-b745-623a1e2bcd27	ff29da8b-fdd4-479e-9dbe-926c20a15814	093115b8-ceba-40d8-9e74-5b20471d3efd	2025-08-25 14:56:37.836471
1b2259cf-8755-424b-93b6-b492af7d797f	ff29da8b-fdd4-479e-9dbe-926c20a15814	021a9c40-f6c1-48fa-8b2b-3ca9e176eae7	2025-08-25 14:56:37.836714
56024182-7d43-4c5c-9a26-732b8e4fedd8	ff29da8b-fdd4-479e-9dbe-926c20a15814	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.836951
1f6e387b-5e2c-4d7d-833d-3918b880e981	ff29da8b-fdd4-479e-9dbe-926c20a15814	0a27bdb6-2468-45f8-8d73-de4ae16f7323	2025-08-25 14:56:37.837205
0dd8826b-1423-4e60-bdef-278efd296e1b	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c35f906-93ab-4d2f-9016-89b5bfa01bf2	2025-08-25 14:56:37.83745
5ddf1d7b-4406-4dcc-b41a-8d0199e7932e	ff29da8b-fdd4-479e-9dbe-926c20a15814	0133d7cf-c035-484a-bc49-6d65fcb89200	2025-08-25 14:56:37.837664
0361c1f1-72eb-4f5e-84d5-d0de3bdf4716	ff29da8b-fdd4-479e-9dbe-926c20a15814	40f55215-e0c9-4518-82fb-5e9604ccb4a9	2025-08-25 14:56:37.837893
4afff4f2-9a71-443a-9016-dd3138904763	ff29da8b-fdd4-479e-9dbe-926c20a15814	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.838138
39a3c5d1-a71a-4647-b696-e861752bb228	ff29da8b-fdd4-479e-9dbe-926c20a15814	2cbf8685-c7ff-4386-91e3-9870096ee9eb	2025-08-25 14:56:37.838373
825f6e49-772f-4114-8a33-4b7ef9f6912b	ff29da8b-fdd4-479e-9dbe-926c20a15814	07a33458-341a-4714-8585-4f9baddbc278	2025-08-25 14:56:37.838609
e484c247-f7bd-43e1-94e2-7a103f3cc200	ff29da8b-fdd4-479e-9dbe-926c20a15814	14977a9d-924a-48ff-bccb-3a5f6478ddac	2025-08-25 14:56:37.838837
1a7584ac-c9af-4955-ac7c-a5466c8d0e4b	ff29da8b-fdd4-479e-9dbe-926c20a15814	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.83907
139e2b06-009c-433b-91ab-238430b7dbd2	ff29da8b-fdd4-479e-9dbe-926c20a15814	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.839306
7c040c7e-810b-428a-9a80-183c105a07cb	ff29da8b-fdd4-479e-9dbe-926c20a15814	196d74c2-e183-4de6-8c00-ded9152c0ef9	2025-08-25 14:56:37.839527
0b3cc823-8f42-4e9f-bbdd-57a64f16e6e6	ff29da8b-fdd4-479e-9dbe-926c20a15814	073cabe2-eab5-46f2-9ccf-e6d9f7cdee7c	2025-08-25 14:56:37.839763
2e6aeaa2-d8c8-42d2-9eb9-103dad8408ae	ff29da8b-fdd4-479e-9dbe-926c20a15814	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.839994
919fe181-87c9-4135-9817-8a3ac053057d	ff29da8b-fdd4-479e-9dbe-926c20a15814	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.840222
df22d394-ce2e-489b-818d-f3a44017495a	ff29da8b-fdd4-479e-9dbe-926c20a15814	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.840456
e0e57509-b210-489b-9c79-0cd3dcc19f56	ff29da8b-fdd4-479e-9dbe-926c20a15814	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.84068
4a08fc27-aded-49a0-a510-5be2bbcd4f05	ff29da8b-fdd4-479e-9dbe-926c20a15814	00a9085b-7176-4306-8a77-650826f28c84	2025-08-25 14:56:37.840906
8f762883-07bb-4113-ae89-6e2649f8500d	ff29da8b-fdd4-479e-9dbe-926c20a15814	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.841132
80119f88-80b0-48f7-9c5f-7601822e71bf	ff29da8b-fdd4-479e-9dbe-926c20a15814	0b737bae-4174-495e-9feb-95ab3cff3ef0	2025-08-25 14:56:37.841378
75b56d4e-7411-4a15-9c9e-75c568400557	ff29da8b-fdd4-479e-9dbe-926c20a15814	10da1d2f-86a8-4595-b530-1a591102c4a8	2025-08-25 14:56:37.841604
6c8dbed9-8f3f-4cb0-ab87-3c80f4aea270	64874f71-3fbd-488f-9a02-10e92f58a959	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.842298
53053907-2372-446a-b044-2f8024e0adec	64874f71-3fbd-488f-9a02-10e92f58a959	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.842541
d42fcd11-c59c-4d72-b596-2ffc7ff7e032	64874f71-3fbd-488f-9a02-10e92f58a959	0bd0a1ce-945a-40bc-b11b-3107d4a11b5e	2025-08-25 14:56:37.84279
81ce0ec5-5c41-4dea-b3f9-69db59c34e68	64874f71-3fbd-488f-9a02-10e92f58a959	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.843029
e756dcbb-3674-447e-8041-2a9dbf11443d	64874f71-3fbd-488f-9a02-10e92f58a959	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.843259
984734c0-df66-4586-baa1-89b0cae52bbd	64874f71-3fbd-488f-9a02-10e92f58a959	3081ddf2-0b06-4c88-83ed-0797cceae48a	2025-08-25 14:56:37.843498
a9d4d680-bfad-4f98-919d-c935746217ab	64874f71-3fbd-488f-9a02-10e92f58a959	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.843732
6aea08bf-cd6f-46d1-9693-df29fca5c496	64874f71-3fbd-488f-9a02-10e92f58a959	02bffd49-c135-4d8c-af77-05b5181a0e90	2025-08-25 14:56:37.843968
9dff5c51-eef7-4dab-b8be-b7603fc71da5	64874f71-3fbd-488f-9a02-10e92f58a959	1f15bec9-cd43-4103-bd5a-47fcb98f2df7	2025-08-25 14:56:37.844202
2139f0aa-8415-46dc-a699-8add6054bd35	64874f71-3fbd-488f-9a02-10e92f58a959	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.844443
9d66c287-bac9-4c3f-a867-c1b00803d7d4	64874f71-3fbd-488f-9a02-10e92f58a959	1e537ed9-855a-4715-9198-8103d4c0a7c7	2025-08-25 14:56:37.844675
33ff126b-e9c5-4d22-b5d1-c77cd7bad12f	64874f71-3fbd-488f-9a02-10e92f58a959	003c1f1a-daff-4cec-b4c5-f85eac94dc55	2025-08-25 14:56:37.84491
ec772749-fe58-45b4-b9f6-a4bc17d4d045	64874f71-3fbd-488f-9a02-10e92f58a959	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.845149
233474ae-032c-41c2-9ec6-1e2b4f2bdf98	64874f71-3fbd-488f-9a02-10e92f58a959	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.845412
be2dc138-31b4-4351-9e19-8cb0b3f58852	64874f71-3fbd-488f-9a02-10e92f58a959	0123642e-820f-444e-aef7-8ed79c587fb8	2025-08-25 14:56:37.84564
a6f2da29-9aa1-40df-bb42-804d538171e4	64874f71-3fbd-488f-9a02-10e92f58a959	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.845877
70f3c1ff-ec58-43ba-89e2-e268327bed6b	64874f71-3fbd-488f-9a02-10e92f58a959	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.846109
359aefe5-6a08-445a-b7f3-03e5ac1f7957	64874f71-3fbd-488f-9a02-10e92f58a959	0c1b6e2e-b3ba-4982-acdd-411e496aede2	2025-08-25 14:56:37.84635
9e4a2139-e1ee-4026-8f08-ff82e41d0bfb	64874f71-3fbd-488f-9a02-10e92f58a959	052f466b-b37e-472f-941f-9f80f2a610d3	2025-08-25 14:56:37.846583
af718c87-4b61-4051-bc29-f1468a510a8a	64874f71-3fbd-488f-9a02-10e92f58a959	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.846819
5a594d65-d8b6-41d5-9756-3150194ff15f	64874f71-3fbd-488f-9a02-10e92f58a959	0237267d-c079-4aed-b6aa-3f5ad0f5c872	2025-08-25 14:56:37.847036
8d8d5269-578c-462c-8ba6-c4341e6265a4	64874f71-3fbd-488f-9a02-10e92f58a959	1e8d3192-ebe1-42d7-baca-09ade44e4e5f	2025-08-25 14:56:37.847266
a5cf8913-521e-40b0-972e-8d1f4a9d338e	64874f71-3fbd-488f-9a02-10e92f58a959	07761b5d-06f0-46ca-af2d-44cabb1bb860	2025-08-25 14:56:37.847491
158c2233-c153-419f-87d8-b6c1df8b2f11	ff952df1-fcdb-42a5-99cb-85b1af379b63	1105a2b9-b16e-4032-9a1e-cfaff26084e0	2025-08-25 14:56:37.848063
8f0c2305-4a63-4462-9a91-035fa8c9fc30	ff952df1-fcdb-42a5-99cb-85b1af379b63	17fee4e4-0d1a-4fc9-952b-d2ab71acc9fe	2025-08-25 14:56:37.848315
a100db4b-59ad-41c8-a6ba-5240e75243ab	ff952df1-fcdb-42a5-99cb-85b1af379b63	0b18592a-4647-49ca-a04a-59102a764a11	2025-08-25 14:56:37.848545
2c04ae47-f38b-4ad1-81bc-8b0493393688	ff952df1-fcdb-42a5-99cb-85b1af379b63	0417bb7a-d226-4f74-8dd4-ff77a0134e6f	2025-08-25 14:56:37.848774
3e1009d6-d540-454c-b777-3863b480b61c	ff952df1-fcdb-42a5-99cb-85b1af379b63	0590f05c-c457-420f-b182-9a399a3a8244	2025-08-25 14:56:37.848997
1e6083d9-a0bc-4ca5-9266-ee4688c5f988	ff952df1-fcdb-42a5-99cb-85b1af379b63	365266da-4c88-4e72-9edb-503016d27e6a	2025-08-25 14:56:37.849251
5bde054a-96c8-4333-80fa-263d20916913	ff952df1-fcdb-42a5-99cb-85b1af379b63	2385db70-6554-42e0-8700-19cbfb834e63	2025-08-25 14:56:37.849504
4a70f305-cc85-4aa2-8168-dd08b7638087	ff952df1-fcdb-42a5-99cb-85b1af379b63	21d04133-0cc1-4936-b52f-ea85073f9182	2025-08-25 14:56:37.849731
6f07f0c4-e3d1-4c47-bb7d-a7b99f22fd4b	ff952df1-fcdb-42a5-99cb-85b1af379b63	11a72c49-345c-4766-ab40-729eacd11c2f	2025-08-25 14:56:37.849948
bacf9157-b0e5-40a1-b0dd-f5337fc26387	ff952df1-fcdb-42a5-99cb-85b1af379b63	063da0b1-cbb4-4c97-a0f6-1e0feef62541	2025-08-25 14:56:37.850184
259b9a77-8018-4b4d-af07-5ed16fb0c407	ff952df1-fcdb-42a5-99cb-85b1af379b63	03aa45b1-d1c2-445d-b103-5ca9d2002930	2025-08-25 14:56:37.850415
2719ce89-d309-4b1e-bb41-64760b8a199a	ff952df1-fcdb-42a5-99cb-85b1af379b63	1d63f248-6d9d-4b18-9e9f-b43d1218dd0c	2025-08-25 14:56:37.85065
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, description, organization_id, is_system, is_active, created_at, updated_at, created_by) FROM stdin;
ff29da8b-fdd4-479e-9dbe-926c20a15814	Administrator	Full access to all platform features and settings	4625e2d1-0da5-40b9-a3e5-b7e46b6fc4c2	t	t	2025-08-25 14:56:37.644651	2025-08-25 14:56:37.644651	\N
64874f71-3fbd-488f-9a02-10e92f58a959	Developer	Access to configurations, deployments, and basic server management	4625e2d1-0da5-40b9-a3e5-b7e46b6fc4c2	t	t	2025-08-25 14:56:37.841923	2025-08-25 14:56:37.841923	\N
ff952df1-fcdb-42a5-99cb-85b1af379b63	Viewer	Read-only access to most resources	4625e2d1-0da5-40b9-a3e5-b7e46b6fc4c2	t	t	2025-08-25 14:56:37.847764	2025-08-25 14:56:37.847764	\N
\.


--
-- Data for Name: server_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.server_groups (id, name, description, default_pem_key_id, organization_id, created_at, updated_at, type) FROM stdin;
\.


--
-- Data for Name: servers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.servers (id, name, hostname, ip_address, port, username, operating_system, os_version, status, last_seen, group_id, pem_key_id, organization_id, metadata, created_at, updated_at, type, encrypted_password) FROM stdin;
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_settings (id, key, value, description, category, is_readonly, created_by, updated_by, created_at, updated_at) FROM stdin;
fa7d82b2-52c2-478b-a888-e33dbeda3f15	user_registration_enabled	true	Allow new users to register and create organizations	security	f	\N	\N	2025-08-25 14:52:49.164177	2025-08-25 14:52:49.164177
afd00369-6611-49fe-8ce8-9ae53a252423	platform_name	"Pulse"	Name of the platform	general	t	\N	\N	2025-08-25 14:52:49.164177	2025-08-25 14:52:49.164177
290b1751-881b-4e5f-b241-74ae4372c33a	support_contact	"support@pulse.dev"	Support contact email for users	general	f	\N	\N	2025-08-25 14:52:49.164177	2025-08-25 14:52:49.164177
da83162e-6954-4f24-a1bb-16d803a03ce5	max_organizations_per_user	5	Maximum number of organizations a user can create	limits	f	\N	\N	2025-08-25 14:52:49.164177	2025-08-25 14:52:49.164177
6ba9ff28-4871-4449-8295-b54566b5595d	maintenance_mode	false	Enable maintenance mode to prevent new registrations and logins	system	f	\N	\N	2025-08-25 14:52:49.164177	2025-08-25 14:52:49.164177
\.


--
-- Data for Name: user_organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_organizations (id, user_id, organization_id, role, is_active, joined_at, updated_at) FROM stdin;
28c73bcd-ecf6-48bf-a804-65f378d5534b	0e9742f5-3508-46d1-a054-565459e61caf	4625e2d1-0da5-40b9-a3e5-b7e46b6fc4c2	owner	t	2025-08-25 14:56:37.642145	2025-08-25 14:56:37.642145
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (id, user_id, role_id, assigned_by, assigned_at, is_active) FROM stdin;
d34b1650-5a3f-41d8-9fc6-85f93ff73aa2	0e9742f5-3508-46d1-a054-565459e61caf	ff29da8b-fdd4-479e-9dbe-926c20a15814	\N	2025-08-25 14:56:37.850897	t
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, name, password_hash, role, is_active, created_at, updated_at, organization_id, is_super_admin, has_completed_onboarding, auth_method, sso_provider_id, external_user_id, last_sso_login_at) FROM stdin;
0e9742f5-3508-46d1-a054-565459e61caf	admin@pulse.dev	Pulse Admin	$2a$10$eYYXzkR40IIA5.0dUhStV.rvj8BmE1099V7bPbrhDfgt5hBw69TIS	super_admin	t	2025-08-25 14:56:37.641499	2025-08-25 14:56:37.641499	4625e2d1-0da5-40b9-a3e5-b7e46b6fc4c2	t	f	password	\N	\N	\N
\.


--
-- Name: asset_assignments asset_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_pkey PRIMARY KEY (id);


--
-- Name: asset_categories asset_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (id);


--
-- Name: asset_custom_field_values asset_custom_field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_custom_field_values
    ADD CONSTRAINT asset_custom_field_values_pkey PRIMARY KEY (id);


--
-- Name: asset_custom_fields asset_custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_custom_fields
    ADD CONSTRAINT asset_custom_fields_pkey PRIMARY KEY (id);


--
-- Name: asset_history asset_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_pkey PRIMARY KEY (id);


--
-- Name: asset_locations asset_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_locations
    ADD CONSTRAINT asset_locations_pkey PRIMARY KEY (id);


--
-- Name: asset_maintenance asset_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_pkey PRIMARY KEY (id);


--
-- Name: assets assets_asset_tag_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_asset_tag_unique UNIQUE (asset_tag);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: aws_instances aws_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aws_instances
    ADD CONSTRAINT aws_instances_pkey PRIMARY KEY (id);


--
-- Name: aws_integrations aws_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aws_integrations
    ADD CONSTRAINT aws_integrations_pkey PRIMARY KEY (id);


--
-- Name: configuration_github_mappings configuration_github_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuration_github_mappings
    ADD CONSTRAINT configuration_github_mappings_pkey PRIMARY KEY (id);


--
-- Name: configuration_states configuration_states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuration_states
    ADD CONSTRAINT configuration_states_pkey PRIMARY KEY (id);


--
-- Name: configurations configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configurations
    ADD CONSTRAINT configurations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: deployments deployments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_pkey PRIMARY KEY (id);


--
-- Name: github_integrations github_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.github_integrations
    ADD CONSTRAINT github_integrations_pkey PRIMARY KEY (id);


--
-- Name: github_pull_requests github_pull_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.github_pull_requests
    ADD CONSTRAINT github_pull_requests_pkey PRIMARY KEY (id);


--
-- Name: mdm_commands mdm_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_commands
    ADD CONSTRAINT mdm_commands_pkey PRIMARY KEY (id);


--
-- Name: mdm_devices mdm_devices_device_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_devices
    ADD CONSTRAINT mdm_devices_device_id_unique UNIQUE (device_id);


--
-- Name: mdm_devices mdm_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_devices
    ADD CONSTRAINT mdm_devices_pkey PRIMARY KEY (id);


--
-- Name: mdm_profiles mdm_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_profiles
    ADD CONSTRAINT mdm_profiles_pkey PRIMARY KEY (id);


--
-- Name: mdm_sessions mdm_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_sessions
    ADD CONSTRAINT mdm_sessions_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: organization_settings organization_settings_organization_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_organization_id_unique UNIQUE (organization_id);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: pem_keys pem_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pem_keys
    ADD CONSTRAINT pem_keys_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: server_groups server_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_groups
    ADD CONSTRAINT server_groups_pkey PRIMARY KEY (id);


--
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_unique UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: user_organizations user_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_active_asset_assignment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_active_asset_assignment ON public.asset_assignments USING btree (asset_id) WHERE (is_active = true);


--
-- Name: idx_asset_assignments_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_assignments_asset_id ON public.asset_assignments USING btree (asset_id);


--
-- Name: idx_asset_assignments_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_assignments_is_active ON public.asset_assignments USING btree (is_active);


--
-- Name: idx_asset_assignments_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_assignments_organization_id ON public.asset_assignments USING btree (organization_id);


--
-- Name: idx_asset_assignments_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_assignments_user_id ON public.asset_assignments USING btree (user_id);


--
-- Name: idx_asset_history_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_history_asset_id ON public.asset_history USING btree (asset_id);


--
-- Name: idx_asset_history_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_history_organization_id ON public.asset_history USING btree (organization_id);


--
-- Name: idx_assets_asset_tag; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_asset_tag ON public.assets USING btree (asset_tag);


--
-- Name: idx_assets_asset_tag_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_assets_asset_tag_organization ON public.assets USING btree (asset_tag, organization_id);


--
-- Name: idx_assets_asset_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_asset_type ON public.assets USING btree (asset_type);


--
-- Name: idx_assets_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_organization_id ON public.assets USING btree (organization_id);


--
-- Name: idx_assets_serial_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_serial_number ON public.assets USING btree (serial_number);


--
-- Name: idx_assets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_status ON public.assets USING btree (status);


--
-- Name: asset_assignments asset_assignments_asset_id_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_asset_id_assets_id_fk FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_assignments asset_assignments_assigned_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_assigned_by_users_id_fk FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: asset_assignments asset_assignments_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_assignments asset_assignments_returned_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_returned_by_users_id_fk FOREIGN KEY (returned_by) REFERENCES public.users(id);


--
-- Name: asset_assignments asset_assignments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: asset_categories asset_categories_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: asset_categories asset_categories_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_categories asset_categories_parent_category_id_asset_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_parent_category_id_asset_categories_id_fk FOREIGN KEY (parent_category_id) REFERENCES public.asset_categories(id);


--
-- Name: asset_custom_field_values asset_custom_field_values_asset_id_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_custom_field_values
    ADD CONSTRAINT asset_custom_field_values_asset_id_assets_id_fk FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_custom_field_values asset_custom_field_values_custom_field_id_asset_custom_fields_i; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_custom_field_values
    ADD CONSTRAINT asset_custom_field_values_custom_field_id_asset_custom_fields_i FOREIGN KEY (custom_field_id) REFERENCES public.asset_custom_fields(id) ON DELETE CASCADE;


--
-- Name: asset_custom_fields asset_custom_fields_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_custom_fields
    ADD CONSTRAINT asset_custom_fields_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: asset_custom_fields asset_custom_fields_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_custom_fields
    ADD CONSTRAINT asset_custom_fields_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_history asset_history_asset_id_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_asset_id_assets_id_fk FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_history asset_history_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_history asset_history_performed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_performed_by_users_id_fk FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: asset_locations asset_locations_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_locations
    ADD CONSTRAINT asset_locations_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: asset_locations asset_locations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_locations
    ADD CONSTRAINT asset_locations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_locations asset_locations_parent_location_id_asset_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_locations
    ADD CONSTRAINT asset_locations_parent_location_id_asset_locations_id_fk FOREIGN KEY (parent_location_id) REFERENCES public.asset_locations(id);


--
-- Name: asset_maintenance asset_maintenance_asset_id_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_asset_id_assets_id_fk FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_maintenance asset_maintenance_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: asset_maintenance asset_maintenance_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: asset_maintenance asset_maintenance_performed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_performed_by_users_id_fk FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: assets assets_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: assets assets_mdm_device_id_mdm_devices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_mdm_device_id_mdm_devices_id_fk FOREIGN KEY (mdm_device_id) REFERENCES public.mdm_devices(id);


--
-- Name: assets assets_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: audit_logs audit_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: aws_instances aws_instances_integration_id_aws_integrations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aws_instances
    ADD CONSTRAINT aws_instances_integration_id_aws_integrations_id_fk FOREIGN KEY (integration_id) REFERENCES public.aws_integrations(id) ON DELETE CASCADE;


--
-- Name: aws_integrations aws_integrations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aws_integrations
    ADD CONSTRAINT aws_integrations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: configuration_github_mappings configuration_github_mappings_configuration_id_configurations_i; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuration_github_mappings
    ADD CONSTRAINT configuration_github_mappings_configuration_id_configurations_i FOREIGN KEY (configuration_id) REFERENCES public.configurations(id) ON DELETE CASCADE;


--
-- Name: configuration_github_mappings configuration_github_mappings_github_integration_id_github_inte; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuration_github_mappings
    ADD CONSTRAINT configuration_github_mappings_github_integration_id_github_inte FOREIGN KEY (github_integration_id) REFERENCES public.github_integrations(id) ON DELETE CASCADE;


--
-- Name: configuration_states configuration_states_configuration_id_configurations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuration_states
    ADD CONSTRAINT configuration_states_configuration_id_configurations_id_fk FOREIGN KEY (configuration_id) REFERENCES public.configurations(id);


--
-- Name: configuration_states configuration_states_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuration_states
    ADD CONSTRAINT configuration_states_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: configuration_states configuration_states_server_id_servers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configuration_states
    ADD CONSTRAINT configuration_states_server_id_servers_id_fk FOREIGN KEY (server_id) REFERENCES public.servers(id);


--
-- Name: configurations configurations_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configurations
    ADD CONSTRAINT configurations_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: configurations configurations_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configurations
    ADD CONSTRAINT configurations_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: configurations configurations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.configurations
    ADD CONSTRAINT configurations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: conversations conversations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: conversations conversations_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: deployments deployments_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: deployments deployments_configuration_id_configurations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_configuration_id_configurations_id_fk FOREIGN KEY (configuration_id) REFERENCES public.configurations(id);


--
-- Name: deployments deployments_executed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_executed_by_users_id_fk FOREIGN KEY (executed_by) REFERENCES public.users(id);


--
-- Name: deployments deployments_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: github_integrations github_integrations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.github_integrations
    ADD CONSTRAINT github_integrations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: github_pull_requests github_pull_requests_configuration_id_configurations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.github_pull_requests
    ADD CONSTRAINT github_pull_requests_configuration_id_configurations_id_fk FOREIGN KEY (configuration_id) REFERENCES public.configurations(id) ON DELETE CASCADE;


--
-- Name: github_pull_requests github_pull_requests_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.github_pull_requests
    ADD CONSTRAINT github_pull_requests_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: github_pull_requests github_pull_requests_github_integration_id_github_integrations_; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.github_pull_requests
    ADD CONSTRAINT github_pull_requests_github_integration_id_github_integrations_ FOREIGN KEY (github_integration_id) REFERENCES public.github_integrations(id) ON DELETE CASCADE;


--
-- Name: mdm_commands mdm_commands_device_id_mdm_devices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_commands
    ADD CONSTRAINT mdm_commands_device_id_mdm_devices_id_fk FOREIGN KEY (device_id) REFERENCES public.mdm_devices(id) ON DELETE CASCADE;


--
-- Name: mdm_commands mdm_commands_initiated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_commands
    ADD CONSTRAINT mdm_commands_initiated_by_users_id_fk FOREIGN KEY (initiated_by) REFERENCES public.users(id);


--
-- Name: mdm_commands mdm_commands_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_commands
    ADD CONSTRAINT mdm_commands_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: mdm_devices mdm_devices_enrolled_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_devices
    ADD CONSTRAINT mdm_devices_enrolled_by_users_id_fk FOREIGN KEY (enrolled_by) REFERENCES public.users(id);


--
-- Name: mdm_devices mdm_devices_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_devices
    ADD CONSTRAINT mdm_devices_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: mdm_devices mdm_devices_profile_id_mdm_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_devices
    ADD CONSTRAINT mdm_devices_profile_id_mdm_profiles_id_fk FOREIGN KEY (profile_id) REFERENCES public.mdm_profiles(id) ON DELETE CASCADE;


--
-- Name: mdm_profiles mdm_profiles_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_profiles
    ADD CONSTRAINT mdm_profiles_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: mdm_profiles mdm_profiles_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_profiles
    ADD CONSTRAINT mdm_profiles_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: mdm_sessions mdm_sessions_device_id_mdm_devices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_sessions
    ADD CONSTRAINT mdm_sessions_device_id_mdm_devices_id_fk FOREIGN KEY (device_id) REFERENCES public.mdm_devices(id) ON DELETE CASCADE;


--
-- Name: mdm_sessions mdm_sessions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_sessions
    ADD CONSTRAINT mdm_sessions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: mdm_sessions mdm_sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mdm_sessions
    ADD CONSTRAINT mdm_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: messages messages_configuration_id_configurations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_configuration_id_configurations_id_fk FOREIGN KEY (configuration_id) REFERENCES public.configurations(id);


--
-- Name: messages messages_conversation_id_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: organization_settings organization_settings_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: pem_keys pem_keys_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pem_keys
    ADD CONSTRAINT pem_keys_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: role_permissions role_permissions_permission_id_permissions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_permissions_id_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: role_permissions role_permissions_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: roles roles_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: roles roles_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: server_groups server_groups_default_pem_key_id_pem_keys_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_groups
    ADD CONSTRAINT server_groups_default_pem_key_id_pem_keys_id_fk FOREIGN KEY (default_pem_key_id) REFERENCES public.pem_keys(id);


--
-- Name: server_groups server_groups_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_groups
    ADD CONSTRAINT server_groups_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: servers servers_group_id_server_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_group_id_server_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.server_groups(id);


--
-- Name: servers servers_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: servers servers_pem_key_id_pem_keys_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pem_key_id_pem_keys_id_fk FOREIGN KEY (pem_key_id) REFERENCES public.pem_keys(id);


--
-- Name: system_settings system_settings_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: system_settings system_settings_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: user_organizations user_organizations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: user_organizations user_organizations_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_assigned_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_users_id_fk FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: user_roles user_roles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- PostgreSQL database dump complete
--

\unrestrict byerzMZuRPv24aiTmgh5Tk6LSVSybgJOk7CxC8M4zFSiTNqQEZyUvZOUscPqekQ

