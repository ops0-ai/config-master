--
-- PostgreSQL database dump
--

\restrict d8tXS0djxAAT6DoKGWWcUfocfxaIxALsNMSmYlmUssYtQfu6QOJd63fmFlrzsA5

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
    has_completed_onboarding boolean DEFAULT false NOT NULL
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
baff6fd8-979c-41b1-a939-0c5d2bfedb76	3821ecea-b79b-49ea-aa86-a891059c0f4b	9cd34f9f-ccfd-4f73-8554-26036cce6498	viewed	admin	\N	"{\\"method\\":\\"GET\\",\\"path\\":\\"/api/admin/organizations\\",\\"statusCode\\":200,\\"duration\\":4,\\"query\\":{}}"	::ffff:172.66.128.70	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-24 14:04:47.22982
80ac7cef-60ef-4719-93fa-9316409500f0	3821ecea-b79b-49ea-aa86-a891059c0f4b	9cd34f9f-ccfd-4f73-8554-26036cce6498	viewed	users	\N	"{\\"method\\":\\"GET\\",\\"path\\":\\"/api/users\\",\\"statusCode\\":200,\\"duration\\":10,\\"query\\":{}}"	::ffff:172.66.128.70	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-08-24 14:04:53.63053
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
c96bb934-99a1-4807-9a7a-087f90c24bfe	Default MacOS Profile	Default MDM profile for MacOS devices - automatically created	9cd34f9f-ccfd-4f73-8554-26036cce6498	macos	t	t	f	t	t	t	3600	"[]"	726a50bf4a4a382e5428c1d033ef805d76547231afcafd36d2965d924eeab70e	\N	t	3821ecea-b79b-49ea-aa86-a891059c0f4b	2025-08-24 14:03:36.215225	2025-08-24 14:03:36.215225
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
9cd34f9f-ccfd-4f73-8554-26036cce6498	Pulse Admin Organization	Default admin organization for Pulse MDM	3821ecea-b79b-49ea-aa86-a891059c0f4b	2025-08-24 14:03:36.180984	2025-08-24 14:03:36.180984	t	t	{}	{"mdm": true, "chat": true, "assets": true, "pemKeys": true, "servers": true, "training": true, "auditLogs": true, "deployments": true, "serverGroups": true, "configurations": true, "awsIntegrations": true, "githubIntegrations": true}
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
a2a39a5a-4077-4249-bbd9-55fb99329689	dashboard	read	View dashboard and analytics	t
84024848-9817-4854-b6b5-7b9d60c54a25	settings	read	View organization settings	t
846c13c9-a035-4624-8b06-60bb824ae34d	settings	write	Modify organization settings	t
c4609122-2b6d-4fb4-8a56-26857f0369df	users	read	View users and roles	t
8829e8b7-0f9b-42eb-9eb8-1372becf5d89	users	write	Create and modify users	t
5363f517-8a55-475e-a52c-f2990b5b3809	users	delete	Delete users	t
964de5f8-0aec-476d-ba26-22ed1b257b59	roles	read	View roles and permissions	t
28ea6d0b-be7d-4563-92a5-9967c8421a27	roles	write	Create and modify roles	t
95ec825c-4cbe-4140-bda7-405c6590c8b0	roles	delete	Delete roles	t
8bd5d2a7-6b00-4dce-b264-6bb12c73eb26	servers	read	View servers	t
358b46f6-e53f-4682-8b3a-91b4d94773fe	servers	write	Create and modify servers	t
f7c34868-da3f-4641-a685-0abd37c9423b	servers	execute	Test server connections	t
9bd743d7-9c33-4c1d-aa93-50f5a8dab485	servers	delete	Delete servers	t
a36e4a73-4f5e-48ab-8ee1-f94b25e566a5	server-groups	read	View server groups	t
fb670b15-981f-44ab-9522-0b4f152680dc	server-groups	write	Create and modify server groups	t
28d21965-86a2-4bfc-a664-742076c1669d	server-groups	execute	Manage server group operations	t
9b454926-73b5-45ca-9090-d78c8598991f	server-groups	delete	Delete server groups	t
c366622a-9504-49ae-b90c-69658604aa14	pem-keys	read	View PEM keys	t
c260fe02-7a5f-40be-a324-02204e0acd25	pem-keys	write	Upload and modify PEM keys	t
937cb860-f279-474b-91ef-87560fcaa42f	pem-keys	execute	Test PEM key connections	t
ad839f72-1e49-47bd-8859-a29bd8884583	pem-keys	delete	Delete PEM keys	t
0e13ea98-9e44-4a96-b12a-2c822263344e	configurations	read	View configurations	t
0019b3b9-d94e-4ed6-aadc-f4e5a862f034	configurations	write	Create and modify configurations	t
62a4556d-3e9c-4b90-9305-60f560abc758	configurations	execute	Validate and test configurations	t
8789e4dc-eecd-42b9-af12-134d0ca51f4b	configurations	approve	Approve or reject configurations for deployment	t
c321ce71-e38d-40f0-82bb-5ea45412b7fa	configurations	delete	Delete configurations	t
4d65bdb5-f0e6-4e7a-82ef-d2abb9c1249b	deployments	read	View deployments	t
73e58cdf-3005-4a17-bd10-3de0f0820488	deployments	write	Create and modify deployments	t
e51de21f-ac3d-4a7c-b205-a16c3896a948	deployments	execute	Execute and redeploy configurations	t
d7c45b3e-53d7-4797-9e05-3dff33fdb0ef	deployments	delete	Delete deployments	t
f3dca9b9-d0b0-4dfd-81e5-894d1076e358	training	read	Access infrastructure training modules	t
61d5943c-5b71-4ad1-a569-7609b5edc3e4	chat	read	View configuration chat	t
70b142c3-7210-45a6-8d1b-04edb28e75b7	chat	write	Use AI configuration assistant	t
68bc4019-a0c1-4328-b070-b86c36b4a7b6	chat	delete	Delete chat conversations	t
9274cf7d-8594-4fc4-b046-eb88d76a8ac1	audit-logs	view	View audit logs	t
67df8492-cf0a-45c4-a7ca-b7f70277bafb	audit-logs	export	Export audit logs	t
37808d34-b873-4c5d-be9e-6933b6706283	aws-integrations	read	View AWS integrations	t
6efcb8fc-9ca9-442a-ba46-937005341cd2	aws-integrations	write	Create and modify AWS integrations	t
1fc1c16b-4267-4f44-9598-e9d5cd4ccb1a	aws-integrations	delete	Delete AWS integrations	t
0b0986b4-6f82-4046-81ca-02eff6a38d63	aws-integrations	sync	Sync AWS instances	t
bfc08b76-b372-44d6-8b7c-f41fb12d3dfa	aws-integrations	import	Import AWS instances as servers	t
95da3acb-b3f9-4980-a639-ab2667a8781f	mdm	read	View MDM profiles and devices	t
88ade9fe-8c2e-4b81-9835-cbf53339779c	mdm	write	Create and modify MDM profiles	t
c23581dc-f1b8-4e81-9596-e15e0b56fa03	mdm	execute	Send commands to MDM devices	t
51787553-d196-4570-aeef-fc3b0f45c6ba	mdm	delete	Delete MDM profiles	t
053d5ad6-b1ae-42ec-aa3d-c301cd2750d1	github-integrations	read	View GitHub integrations	t
395f7dfc-9bdc-44a6-ade7-9ff53d6f9465	github-integrations	write	Create and modify GitHub integrations	t
428eacdd-e11b-4f7d-b031-50c8b9f9ae08	github-integrations	delete	Delete GitHub integrations	t
0f2d79c2-fcf0-4a8a-800c-59ecccbfcad6	github-integrations	validate	Validate GitHub tokens	t
fe4a0e28-54c4-4c4b-91d8-4e543bbc58b2	github-integrations	sync	Sync configurations to GitHub	t
ab71d9e0-939b-4686-8f2a-75f8c0681941	asset	read	View assets	t
fdc0b0fc-f9db-4c44-8196-96818562d61d	asset	create	Create new assets	t
907aa93a-1cb0-41e9-a807-b2f6e9b7a90a	asset	update	Update existing assets	t
053f56d0-850a-4164-9091-ef3b74181b05	asset	delete	Delete assets	t
9e0ee3ff-4abc-477c-bfce-bf077e176193	asset	assign	Assign assets to users/locations	t
132f5472-d0c7-4d02-8858-4f6050d2c8af	asset	import	Import assets from external sources	t
bbdea080-320b-4f39-9e96-3c609d140c75	asset	export	Export assets to external systems	t
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (id, role_id, permission_id, created_at) FROM stdin;
74bba5b4-a72e-4e4a-96f2-3fd86a7a76df	62603c3e-5f8b-4351-a02f-61c8d544037f	a2a39a5a-4077-4249-bbd9-55fb99329689	2025-08-24 14:03:36.185312
209f1997-4320-45ce-8f87-d9f1b0e3f935	62603c3e-5f8b-4351-a02f-61c8d544037f	84024848-9817-4854-b6b5-7b9d60c54a25	2025-08-24 14:03:36.185853
0abfffd6-79c3-448e-858f-47a075a4cdff	62603c3e-5f8b-4351-a02f-61c8d544037f	846c13c9-a035-4624-8b06-60bb824ae34d	2025-08-24 14:03:36.186212
5e71ce31-4d08-4972-a5de-c369723de80b	62603c3e-5f8b-4351-a02f-61c8d544037f	c4609122-2b6d-4fb4-8a56-26857f0369df	2025-08-24 14:03:36.186555
cb9f5418-5a10-4d87-983e-aa354c2524a7	62603c3e-5f8b-4351-a02f-61c8d544037f	8829e8b7-0f9b-42eb-9eb8-1372becf5d89	2025-08-24 14:03:36.186887
7141030c-616f-42df-b338-1d78d48bce49	62603c3e-5f8b-4351-a02f-61c8d544037f	5363f517-8a55-475e-a52c-f2990b5b3809	2025-08-24 14:03:36.187189
4d38a93a-579c-4230-a9ce-ab6e2549d9a4	62603c3e-5f8b-4351-a02f-61c8d544037f	964de5f8-0aec-476d-ba26-22ed1b257b59	2025-08-24 14:03:36.187481
bb8b08ad-e58c-4ab6-8313-5c27374bf785	62603c3e-5f8b-4351-a02f-61c8d544037f	28ea6d0b-be7d-4563-92a5-9967c8421a27	2025-08-24 14:03:36.187756
a9b90afe-c482-4c3d-a70f-7e624cc88939	62603c3e-5f8b-4351-a02f-61c8d544037f	95ec825c-4cbe-4140-bda7-405c6590c8b0	2025-08-24 14:03:36.188041
4705e72f-2904-4c25-ab29-688ec0630c8c	62603c3e-5f8b-4351-a02f-61c8d544037f	8bd5d2a7-6b00-4dce-b264-6bb12c73eb26	2025-08-24 14:03:36.188312
5b9f3e7f-77e4-4aed-a48b-65b4d0e81491	62603c3e-5f8b-4351-a02f-61c8d544037f	358b46f6-e53f-4682-8b3a-91b4d94773fe	2025-08-24 14:03:36.188611
ae477dae-c63a-4940-9a1b-7212c2754833	62603c3e-5f8b-4351-a02f-61c8d544037f	f7c34868-da3f-4641-a685-0abd37c9423b	2025-08-24 14:03:36.188878
9d649c56-d694-4920-bf0f-687ca1f4b68a	62603c3e-5f8b-4351-a02f-61c8d544037f	9bd743d7-9c33-4c1d-aa93-50f5a8dab485	2025-08-24 14:03:36.189155
98f1f590-715a-432d-8331-171055a6a06d	62603c3e-5f8b-4351-a02f-61c8d544037f	a36e4a73-4f5e-48ab-8ee1-f94b25e566a5	2025-08-24 14:03:36.189432
71c7fc52-c03b-43a9-b201-57f02abe40d4	62603c3e-5f8b-4351-a02f-61c8d544037f	fb670b15-981f-44ab-9522-0b4f152680dc	2025-08-24 14:03:36.189711
27d25b50-bf89-44c3-924b-c51975a89bdf	62603c3e-5f8b-4351-a02f-61c8d544037f	28d21965-86a2-4bfc-a664-742076c1669d	2025-08-24 14:03:36.190018
70862721-24ce-46a5-8a1b-046047940d97	62603c3e-5f8b-4351-a02f-61c8d544037f	9b454926-73b5-45ca-9090-d78c8598991f	2025-08-24 14:03:36.190323
12c622de-9fac-4033-ac94-c78382db3e65	62603c3e-5f8b-4351-a02f-61c8d544037f	c366622a-9504-49ae-b90c-69658604aa14	2025-08-24 14:03:36.190588
887d958e-d3ce-4f08-bce9-4693a55161a3	62603c3e-5f8b-4351-a02f-61c8d544037f	c260fe02-7a5f-40be-a324-02204e0acd25	2025-08-24 14:03:36.190854
16412567-6f1c-4d32-b41f-553f05a38dd7	62603c3e-5f8b-4351-a02f-61c8d544037f	937cb860-f279-474b-91ef-87560fcaa42f	2025-08-24 14:03:36.19113
f4ffbd5c-86b2-452f-ad97-5d26ec773c16	62603c3e-5f8b-4351-a02f-61c8d544037f	ad839f72-1e49-47bd-8859-a29bd8884583	2025-08-24 14:03:36.19139
d524adb7-393a-45d5-a5ef-8f18c38335c4	62603c3e-5f8b-4351-a02f-61c8d544037f	0e13ea98-9e44-4a96-b12a-2c822263344e	2025-08-24 14:03:36.191638
0ddd482a-0129-433c-9a14-fb763970510b	62603c3e-5f8b-4351-a02f-61c8d544037f	0019b3b9-d94e-4ed6-aadc-f4e5a862f034	2025-08-24 14:03:36.191898
958cda36-022d-4eab-bebd-8aceb165d374	62603c3e-5f8b-4351-a02f-61c8d544037f	62a4556d-3e9c-4b90-9305-60f560abc758	2025-08-24 14:03:36.192172
e65df6cd-5447-4e5b-8ea1-bdc23464646f	62603c3e-5f8b-4351-a02f-61c8d544037f	8789e4dc-eecd-42b9-af12-134d0ca51f4b	2025-08-24 14:03:36.19243
c3f238aa-515b-4ace-9834-d7cfca0a7cfa	62603c3e-5f8b-4351-a02f-61c8d544037f	c321ce71-e38d-40f0-82bb-5ea45412b7fa	2025-08-24 14:03:36.192685
a8de3953-9ce5-4160-815c-bdadc0b4aeaf	62603c3e-5f8b-4351-a02f-61c8d544037f	4d65bdb5-f0e6-4e7a-82ef-d2abb9c1249b	2025-08-24 14:03:36.192941
88217037-4f1d-4414-afea-b14ded85290a	62603c3e-5f8b-4351-a02f-61c8d544037f	73e58cdf-3005-4a17-bd10-3de0f0820488	2025-08-24 14:03:36.193265
042e13de-f381-4773-8d75-f50e9c1760c0	62603c3e-5f8b-4351-a02f-61c8d544037f	e51de21f-ac3d-4a7c-b205-a16c3896a948	2025-08-24 14:03:36.193525
d9a62323-1ac4-4df2-9245-019bed6f7098	62603c3e-5f8b-4351-a02f-61c8d544037f	d7c45b3e-53d7-4797-9e05-3dff33fdb0ef	2025-08-24 14:03:36.193772
828e2625-27a8-4df4-88bd-151f50cae09d	62603c3e-5f8b-4351-a02f-61c8d544037f	f3dca9b9-d0b0-4dfd-81e5-894d1076e358	2025-08-24 14:03:36.19406
882de075-2041-4a2d-ba22-e0518ff5603f	62603c3e-5f8b-4351-a02f-61c8d544037f	61d5943c-5b71-4ad1-a569-7609b5edc3e4	2025-08-24 14:03:36.194427
78fdf599-6b80-4c81-9287-fb96ec7f75c6	62603c3e-5f8b-4351-a02f-61c8d544037f	70b142c3-7210-45a6-8d1b-04edb28e75b7	2025-08-24 14:03:36.194716
90ff8145-136e-471d-a632-a75be40c824c	62603c3e-5f8b-4351-a02f-61c8d544037f	68bc4019-a0c1-4328-b070-b86c36b4a7b6	2025-08-24 14:03:36.195004
a0865fd8-490a-489c-a68b-541254cd66b2	62603c3e-5f8b-4351-a02f-61c8d544037f	9274cf7d-8594-4fc4-b046-eb88d76a8ac1	2025-08-24 14:03:36.195292
62167300-4e69-4cc1-bdd5-1486d3325a5f	62603c3e-5f8b-4351-a02f-61c8d544037f	67df8492-cf0a-45c4-a7ca-b7f70277bafb	2025-08-24 14:03:36.195552
2b1a1739-7aef-4d9b-b661-c0e264889f3c	62603c3e-5f8b-4351-a02f-61c8d544037f	37808d34-b873-4c5d-be9e-6933b6706283	2025-08-24 14:03:36.195802
aec7d919-633b-42df-b623-958a3bdf38f3	62603c3e-5f8b-4351-a02f-61c8d544037f	6efcb8fc-9ca9-442a-ba46-937005341cd2	2025-08-24 14:03:36.196067
997e2490-61db-4fe3-a494-4822bf3ccb6f	62603c3e-5f8b-4351-a02f-61c8d544037f	1fc1c16b-4267-4f44-9598-e9d5cd4ccb1a	2025-08-24 14:03:36.196341
d2a36ca5-a29f-4f9d-8fc8-856ec02dd22a	62603c3e-5f8b-4351-a02f-61c8d544037f	0b0986b4-6f82-4046-81ca-02eff6a38d63	2025-08-24 14:03:36.196598
a0d7273b-7c07-44d2-a00a-dc08f04a9655	62603c3e-5f8b-4351-a02f-61c8d544037f	bfc08b76-b372-44d6-8b7c-f41fb12d3dfa	2025-08-24 14:03:36.19685
6ca91ce5-312f-4ce3-8afb-5836d09ad13e	62603c3e-5f8b-4351-a02f-61c8d544037f	95da3acb-b3f9-4980-a639-ab2667a8781f	2025-08-24 14:03:36.197133
fd529d8a-57b3-4e2e-b96e-48d352e41d51	62603c3e-5f8b-4351-a02f-61c8d544037f	88ade9fe-8c2e-4b81-9835-cbf53339779c	2025-08-24 14:03:36.197466
e295ab9e-66d5-4058-80ae-0694718f7df9	62603c3e-5f8b-4351-a02f-61c8d544037f	c23581dc-f1b8-4e81-9596-e15e0b56fa03	2025-08-24 14:03:36.197802
d02366db-a6f9-459b-92f1-cebb4d6aed9e	62603c3e-5f8b-4351-a02f-61c8d544037f	51787553-d196-4570-aeef-fc3b0f45c6ba	2025-08-24 14:03:36.198087
9ec3d875-4c32-40b2-8c4b-ba6eeafa9caa	62603c3e-5f8b-4351-a02f-61c8d544037f	053d5ad6-b1ae-42ec-aa3d-c301cd2750d1	2025-08-24 14:03:36.198337
c7523f03-908c-492f-915c-9b8f574e2ee9	62603c3e-5f8b-4351-a02f-61c8d544037f	395f7dfc-9bdc-44a6-ade7-9ff53d6f9465	2025-08-24 14:03:36.198597
f33a7395-dfed-415b-964d-8a9979a4c4c8	62603c3e-5f8b-4351-a02f-61c8d544037f	428eacdd-e11b-4f7d-b031-50c8b9f9ae08	2025-08-24 14:03:36.198862
69313f0a-8e4a-4c6c-8e94-6c9855ce521d	62603c3e-5f8b-4351-a02f-61c8d544037f	0f2d79c2-fcf0-4a8a-800c-59ecccbfcad6	2025-08-24 14:03:36.19913
af5f6c94-f150-4f3b-865e-320e815db3ed	62603c3e-5f8b-4351-a02f-61c8d544037f	fe4a0e28-54c4-4c4b-91d8-4e543bbc58b2	2025-08-24 14:03:36.199391
624c7d8f-d805-4681-b304-3dd1a26b27d2	62603c3e-5f8b-4351-a02f-61c8d544037f	ab71d9e0-939b-4686-8f2a-75f8c0681941	2025-08-24 14:03:36.199708
8b618e78-9c9f-4b8c-9186-43ca964694b4	62603c3e-5f8b-4351-a02f-61c8d544037f	fdc0b0fc-f9db-4c44-8196-96818562d61d	2025-08-24 14:03:36.199966
bfb67e7e-6e7e-46cf-ad4a-f6eccab7cd16	62603c3e-5f8b-4351-a02f-61c8d544037f	907aa93a-1cb0-41e9-a807-b2f6e9b7a90a	2025-08-24 14:03:36.200292
fca7b796-1399-4ff3-9d09-9641f4e7edce	62603c3e-5f8b-4351-a02f-61c8d544037f	053f56d0-850a-4164-9091-ef3b74181b05	2025-08-24 14:03:36.200535
cb687118-023f-4a45-b997-2540949636d1	62603c3e-5f8b-4351-a02f-61c8d544037f	9e0ee3ff-4abc-477c-bfce-bf077e176193	2025-08-24 14:03:36.200795
842ca4fb-24a6-4254-affe-7f28bea54c00	62603c3e-5f8b-4351-a02f-61c8d544037f	132f5472-d0c7-4d02-8858-4f6050d2c8af	2025-08-24 14:03:36.201062
2a9e55bd-bb75-494d-9bf8-0153e81e6a09	62603c3e-5f8b-4351-a02f-61c8d544037f	bbdea080-320b-4f39-9e96-3c609d140c75	2025-08-24 14:03:36.201396
57f71195-8614-425e-8b82-0d054aef95e9	26a143d5-d550-4e17-bea9-8042a0563408	a2a39a5a-4077-4249-bbd9-55fb99329689	2025-08-24 14:03:36.202066
59c96985-83da-4045-a359-8a35fd8b79d3	26a143d5-d550-4e17-bea9-8042a0563408	8bd5d2a7-6b00-4dce-b264-6bb12c73eb26	2025-08-24 14:03:36.202321
a30ccdcf-1fc6-4220-963f-c312010f39b9	26a143d5-d550-4e17-bea9-8042a0563408	358b46f6-e53f-4682-8b3a-91b4d94773fe	2025-08-24 14:03:36.20256
b1f8b02c-ccf7-45f3-9a1b-c953d0892d3b	26a143d5-d550-4e17-bea9-8042a0563408	a36e4a73-4f5e-48ab-8ee1-f94b25e566a5	2025-08-24 14:03:36.20281
6fa838ea-4ab6-40a6-ae45-d18d3e829f5f	26a143d5-d550-4e17-bea9-8042a0563408	c366622a-9504-49ae-b90c-69658604aa14	2025-08-24 14:03:36.203088
174846c5-4cf7-43b2-966a-c196690b5d13	26a143d5-d550-4e17-bea9-8042a0563408	c260fe02-7a5f-40be-a324-02204e0acd25	2025-08-24 14:03:36.203373
4f8f1a42-7045-4e88-acf8-15b6c4c78d6d	26a143d5-d550-4e17-bea9-8042a0563408	0e13ea98-9e44-4a96-b12a-2c822263344e	2025-08-24 14:03:36.203664
d4f44d70-c4ab-474d-87d2-39e7a8f435b5	26a143d5-d550-4e17-bea9-8042a0563408	0019b3b9-d94e-4ed6-aadc-f4e5a862f034	2025-08-24 14:03:36.203984
f69122e7-05cc-4fbe-84be-b2bd58826644	26a143d5-d550-4e17-bea9-8042a0563408	62a4556d-3e9c-4b90-9305-60f560abc758	2025-08-24 14:03:36.204277
24a9d836-267d-42a6-b057-8f4cde182b1e	26a143d5-d550-4e17-bea9-8042a0563408	4d65bdb5-f0e6-4e7a-82ef-d2abb9c1249b	2025-08-24 14:03:36.204569
eec9dd99-6007-4b0e-a526-dd030a7fe893	26a143d5-d550-4e17-bea9-8042a0563408	73e58cdf-3005-4a17-bd10-3de0f0820488	2025-08-24 14:03:36.204857
f639fef4-e084-49bd-935d-56fdc01a5978	26a143d5-d550-4e17-bea9-8042a0563408	e51de21f-ac3d-4a7c-b205-a16c3896a948	2025-08-24 14:03:36.205144
69c09a6f-cd05-45dc-bbab-d38ae9392c69	26a143d5-d550-4e17-bea9-8042a0563408	f3dca9b9-d0b0-4dfd-81e5-894d1076e358	2025-08-24 14:03:36.205412
c5906528-690e-4082-aa6a-b8ea364d06ed	26a143d5-d550-4e17-bea9-8042a0563408	61d5943c-5b71-4ad1-a569-7609b5edc3e4	2025-08-24 14:03:36.205687
7c823e5d-259c-4c04-94e3-ce14b2d7bcd9	26a143d5-d550-4e17-bea9-8042a0563408	70b142c3-7210-45a6-8d1b-04edb28e75b7	2025-08-24 14:03:36.20601
9d121dc3-b118-4207-9084-0b2eb16cf5fd	26a143d5-d550-4e17-bea9-8042a0563408	37808d34-b873-4c5d-be9e-6933b6706283	2025-08-24 14:03:36.206327
86105a18-35e5-433b-828e-ae5a15b3e568	26a143d5-d550-4e17-bea9-8042a0563408	053d5ad6-b1ae-42ec-aa3d-c301cd2750d1	2025-08-24 14:03:36.20661
9bf8b0f6-14de-494e-8e45-a0208f5791ef	26a143d5-d550-4e17-bea9-8042a0563408	395f7dfc-9bdc-44a6-ade7-9ff53d6f9465	2025-08-24 14:03:36.206883
38923fdd-6dd4-480d-83c3-a68ec5161748	26a143d5-d550-4e17-bea9-8042a0563408	fe4a0e28-54c4-4c4b-91d8-4e543bbc58b2	2025-08-24 14:03:36.207163
c07e219e-5b16-4bd9-8912-743cc0b07a46	26a143d5-d550-4e17-bea9-8042a0563408	ab71d9e0-939b-4686-8f2a-75f8c0681941	2025-08-24 14:03:36.207427
895ef3a1-0f4c-48dd-961d-224420f9faf6	26a143d5-d550-4e17-bea9-8042a0563408	fdc0b0fc-f9db-4c44-8196-96818562d61d	2025-08-24 14:03:36.207688
6f3bcef1-db4a-4150-88c3-5c19fabbe383	26a143d5-d550-4e17-bea9-8042a0563408	907aa93a-1cb0-41e9-a807-b2f6e9b7a90a	2025-08-24 14:03:36.207944
420736b1-0006-4a19-a09b-7747be93521f	26a143d5-d550-4e17-bea9-8042a0563408	9e0ee3ff-4abc-477c-bfce-bf077e176193	2025-08-24 14:03:36.20824
bddd5671-8316-4e4c-ac02-6262c27dd47d	57cdb6d7-4552-4417-a848-b0603a44a362	a2a39a5a-4077-4249-bbd9-55fb99329689	2025-08-24 14:03:36.208884
9f232a94-abcb-4499-89df-4191aa6f2146	57cdb6d7-4552-4417-a848-b0603a44a362	8bd5d2a7-6b00-4dce-b264-6bb12c73eb26	2025-08-24 14:03:36.209263
5766d4d6-e27e-40a4-87a9-29f37ecf1df7	57cdb6d7-4552-4417-a848-b0603a44a362	a36e4a73-4f5e-48ab-8ee1-f94b25e566a5	2025-08-24 14:03:36.209543
bf95dad6-9ba3-4455-8be9-9862b768ae07	57cdb6d7-4552-4417-a848-b0603a44a362	c366622a-9504-49ae-b90c-69658604aa14	2025-08-24 14:03:36.209805
29bc9839-ad89-4a73-821a-4406cf4c75b0	57cdb6d7-4552-4417-a848-b0603a44a362	0e13ea98-9e44-4a96-b12a-2c822263344e	2025-08-24 14:03:36.210108
5c42ff3c-827c-49f0-9a9f-f113b85f979f	57cdb6d7-4552-4417-a848-b0603a44a362	4d65bdb5-f0e6-4e7a-82ef-d2abb9c1249b	2025-08-24 14:03:36.21124
33682875-bac4-45e8-bdc4-a30f5d006838	57cdb6d7-4552-4417-a848-b0603a44a362	f3dca9b9-d0b0-4dfd-81e5-894d1076e358	2025-08-24 14:03:36.211782
f5eb4269-9a21-4298-a655-c64668109963	57cdb6d7-4552-4417-a848-b0603a44a362	61d5943c-5b71-4ad1-a569-7609b5edc3e4	2025-08-24 14:03:36.212069
2650dda1-1ea4-402c-bc22-c007dce6f318	57cdb6d7-4552-4417-a848-b0603a44a362	37808d34-b873-4c5d-be9e-6933b6706283	2025-08-24 14:03:36.212346
c2654881-9759-4cef-afb6-14e1ff585d66	57cdb6d7-4552-4417-a848-b0603a44a362	053d5ad6-b1ae-42ec-aa3d-c301cd2750d1	2025-08-24 14:03:36.212656
2d61387a-9a6d-4412-9b86-f725511166d0	57cdb6d7-4552-4417-a848-b0603a44a362	95da3acb-b3f9-4980-a639-ab2667a8781f	2025-08-24 14:03:36.212943
023ed795-a2c3-44b3-9b26-5db1f99f682b	57cdb6d7-4552-4417-a848-b0603a44a362	ab71d9e0-939b-4686-8f2a-75f8c0681941	2025-08-24 14:03:36.213338
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, description, organization_id, is_system, is_active, created_at, updated_at, created_by) FROM stdin;
62603c3e-5f8b-4351-a02f-61c8d544037f	Administrator	Full access to all platform features and settings	9cd34f9f-ccfd-4f73-8554-26036cce6498	t	t	2025-08-24 14:03:36.184366	2025-08-24 14:03:36.184366	\N
26a143d5-d550-4e17-bea9-8042a0563408	Developer	Access to configurations, deployments, and basic server management	9cd34f9f-ccfd-4f73-8554-26036cce6498	t	t	2025-08-24 14:03:36.201722	2025-08-24 14:03:36.201722	\N
57cdb6d7-4552-4417-a848-b0603a44a362	Viewer	Read-only access to most resources	9cd34f9f-ccfd-4f73-8554-26036cce6498	t	t	2025-08-24 14:03:36.208544	2025-08-24 14:03:36.208544	\N
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
b05cde7e-a125-4e9f-8c51-c61cdf9d9a74	user_registration_enabled	true	Allow new users to register and create organizations	security	f	\N	\N	2025-08-24 14:03:36.048883	2025-08-24 14:03:36.048883
68199847-e8d2-471b-8aea-2d18a5cd2228	platform_name	"Pulse"	Name of the platform	general	t	\N	\N	2025-08-24 14:03:36.048883	2025-08-24 14:03:36.048883
e299175f-fc2b-4903-85bf-fa6f24058150	support_contact	"support@pulse.dev"	Support contact email for users	general	f	\N	\N	2025-08-24 14:03:36.048883	2025-08-24 14:03:36.048883
a7298f53-43a2-4a5f-91d6-35ffc0ee134a	max_organizations_per_user	5	Maximum number of organizations a user can create	limits	f	\N	\N	2025-08-24 14:03:36.048883	2025-08-24 14:03:36.048883
5c3de6d6-c527-4744-b6b5-5f87e7515065	maintenance_mode	false	Enable maintenance mode to prevent new registrations and logins	system	f	\N	\N	2025-08-24 14:03:36.048883	2025-08-24 14:03:36.048883
\.


--
-- Data for Name: user_organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_organizations (id, user_id, organization_id, role, is_active, joined_at, updated_at) FROM stdin;
1daa228e-0440-4f34-b33d-6628e63eb1e3	3821ecea-b79b-49ea-aa86-a891059c0f4b	9cd34f9f-ccfd-4f73-8554-26036cce6498	owner	t	2025-08-24 14:03:36.183026	2025-08-24 14:03:36.183026
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (id, user_id, role_id, assigned_by, assigned_at, is_active) FROM stdin;
1546997a-fad4-4ff2-9f3d-ef45d239ec5c	3821ecea-b79b-49ea-aa86-a891059c0f4b	62603c3e-5f8b-4351-a02f-61c8d544037f	\N	2025-08-24 14:03:36.21365	t
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, name, password_hash, role, is_active, created_at, updated_at, organization_id, is_super_admin, has_completed_onboarding) FROM stdin;
3821ecea-b79b-49ea-aa86-a891059c0f4b	admin@pulse.dev	Pulse Admin	$2a$10$P2HA.xx0XaUs5juSam2ycu1sJ05yAaXmfUPaME2Cv23PxIdZ/9sTK	super_admin	t	2025-08-24 14:03:36.182334	2025-08-24 14:03:36.182334	9cd34f9f-ccfd-4f73-8554-26036cce6498	t	f
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

\unrestrict d8tXS0djxAAT6DoKGWWcUfocfxaIxALsNMSmYlmUssYtQfu6QOJd63fmFlrzsA5

