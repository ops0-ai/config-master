package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// Config represents the complete agent configuration
type Config struct {
	Server      ServerConfig      `yaml:"server"`
	Agent       AgentConfig       `yaml:"agent"`
	Logging     LoggingConfig     `yaml:"logging"`
	Collectors  CollectorsConfig  `yaml:"collectors"`
	Outputs     []OutputConfig    `yaml:"outputs"`
	TLS         TLSConfig         `yaml:"tls,omitempty"`
	Healthcheck HealthcheckConfig `yaml:"healthcheck"`
}

// ServerConfig contains Pulse platform connection settings
type ServerConfig struct {
	URL               string        `yaml:"url"`
	APIKey            string        `yaml:"api_key"`
	HeartbeatInterval time.Duration `yaml:"heartbeat_interval"`
	ReconnectInterval time.Duration `yaml:"reconnect_interval"`
	MaxReconnects     int           `yaml:"max_reconnects"`
	Timeout           time.Duration `yaml:"timeout"`
}

// AgentConfig contains agent-specific settings
type AgentConfig struct {
	Name                string            `yaml:"name"`
	Hostname            string            `yaml:"hostname,omitempty"`
	Tags                map[string]string `yaml:"tags,omitempty"`
	DataDir             string            `yaml:"data_dir"`
	BufferSize          int               `yaml:"buffer_size"`
	BatchSize           int               `yaml:"batch_size"`
	FlushInterval       time.Duration     `yaml:"flush_interval"`
	CompressData        bool              `yaml:"compress_data"`
	EnableProfiling     bool              `yaml:"enable_profiling"`
	ProfilingPort       int               `yaml:"profiling_port"`
	MetricsPort         int               `yaml:"metrics_port"`
	EnableSelfMonitoring bool             `yaml:"enable_self_monitoring"`
}

// LoggingConfig contains logging configuration
type LoggingConfig struct {
	Level      string `yaml:"level"`
	Format     string `yaml:"format"` // json, text
	Output     string `yaml:"output"` // stdout, file
	File       string `yaml:"file,omitempty"`
	MaxSize    int    `yaml:"max_size,omitempty"`    // MB
	MaxBackups int    `yaml:"max_backups,omitempty"`
	MaxAge     int    `yaml:"max_age,omitempty"` // days
	Compress   bool   `yaml:"compress,omitempty"`
}

// CollectorsConfig contains all collector configurations
type CollectorsConfig struct {
	Logs    LogCollectorConfig    `yaml:"logs"`
	Metrics MetricsCollectorConfig `yaml:"metrics"`
	Traces  TracesCollectorConfig `yaml:"traces"`
	Events  EventsCollectorConfig `yaml:"events"`
}

// LogCollectorConfig configures log collection
type LogCollectorConfig struct {
	Enabled     bool                    `yaml:"enabled"`
	Paths       []LogPathConfig         `yaml:"paths"`
	Patterns    []LogPatternConfig      `yaml:"patterns,omitempty"`
	Parsers     map[string]ParserConfig `yaml:"parsers,omitempty"`
	Multiline   MultilineConfig         `yaml:"multiline,omitempty"`
	Excludes    []string                `yaml:"excludes,omitempty"`
	RotateWait  time.Duration           `yaml:"rotate_wait"`
	ScanFreq    time.Duration           `yaml:"scan_frequency"`
	MaxFileSize int64                   `yaml:"max_file_size"` // bytes
}

// LogPathConfig defines a log file path configuration
type LogPathConfig struct {
	Path       string            `yaml:"path"`
	Parser     string            `yaml:"parser,omitempty"`
	Tags       map[string]string `yaml:"tags,omitempty"`
	Fields     map[string]string `yaml:"fields,omitempty"`
	Multiline  string            `yaml:"multiline,omitempty"`
	Recursive  bool              `yaml:"recursive,omitempty"`
	MaxDepth   int               `yaml:"max_depth,omitempty"`
}

// LogPatternConfig defines error/issue detection patterns
type LogPatternConfig struct {
	Name        string `yaml:"name"`
	Pattern     string `yaml:"pattern"`
	Severity    string `yaml:"severity"` // critical, error, warning, info
	Category    string `yaml:"category,omitempty"`
	Description string `yaml:"description,omitempty"`
	AutoFix     string `yaml:"auto_fix,omitempty"`
}

// ParserConfig defines log parsing configuration
type ParserConfig struct {
	Type    string                 `yaml:"type"` // regex, json, grok, timestamp
	Pattern string                 `yaml:"pattern,omitempty"`
	Fields  map[string]interface{} `yaml:"fields,omitempty"`
}

// MultilineConfig defines multiline log handling
type MultilineConfig struct {
	Pattern   string `yaml:"pattern"`
	Negate    bool   `yaml:"negate"`
	Match     string `yaml:"match"` // after, before
	MaxLines  int    `yaml:"max_lines,omitempty"`
	Timeout   time.Duration `yaml:"timeout,omitempty"`
}

// MetricsCollectorConfig configures metrics collection
type MetricsCollectorConfig struct {
	Enabled       bool                  `yaml:"enabled"`
	Interval      time.Duration         `yaml:"interval"`
	SystemMetrics SystemMetricsConfig   `yaml:"system"`
	CustomMetrics []CustomMetricConfig  `yaml:"custom,omitempty"`
	Processors    []ProcessorConfig     `yaml:"processors,omitempty"`
}

// SystemMetricsConfig defines system metrics to collect
type SystemMetricsConfig struct {
	CPU       bool `yaml:"cpu"`
	Memory    bool `yaml:"memory"`
	Disk      bool `yaml:"disk"`
	Network   bool `yaml:"network"`
	Process   bool `yaml:"process"`
	Docker    bool `yaml:"docker,omitempty"`
	Services  bool `yaml:"services,omitempty"`
}

// CustomMetricConfig defines custom metrics
type CustomMetricConfig struct {
	Name     string                 `yaml:"name"`
	Type     string                 `yaml:"type"` // counter, gauge, histogram
	Help     string                 `yaml:"help,omitempty"`
	Labels   []string               `yaml:"labels,omitempty"`
	Command  string                 `yaml:"command,omitempty"`
	Script   string                 `yaml:"script,omitempty"`
	Interval time.Duration          `yaml:"interval,omitempty"`
	Parser   map[string]interface{} `yaml:"parser,omitempty"`
}

// TracesCollectorConfig configures distributed tracing
type TracesCollectorConfig struct {
	Enabled    bool                      `yaml:"enabled"`
	Receivers  []TraceReceiverConfig     `yaml:"receivers,omitempty"`
	Processors []ProcessorConfig         `yaml:"processors,omitempty"`
	Sampling   TraceSamplingConfig       `yaml:"sampling,omitempty"`
}

// TraceReceiverConfig defines trace receivers
type TraceReceiverConfig struct {
	Name     string                 `yaml:"name"`
	Type     string                 `yaml:"type"` // otlp, jaeger, zipkin
	Endpoint string                 `yaml:"endpoint,omitempty"`
	Config   map[string]interface{} `yaml:"config,omitempty"`
}

// TraceSamplingConfig defines trace sampling
type TraceSamplingConfig struct {
	Rate       float64 `yaml:"rate"`
	MaxTraces  int     `yaml:"max_traces,omitempty"`
}

// EventsCollectorConfig configures system events
type EventsCollectorConfig struct {
	Enabled      bool                  `yaml:"enabled"`
	SystemEvents SystemEventsConfig    `yaml:"system"`
	CustomEvents []CustomEventConfig   `yaml:"custom,omitempty"`
}

// SystemEventsConfig defines system events to monitor
type SystemEventsConfig struct {
	FileSystem bool `yaml:"filesystem"`
	Process    bool `yaml:"process"`
	Network    bool `yaml:"network"`
	Services   bool `yaml:"services"`
}

// CustomEventConfig defines custom event monitoring
type CustomEventConfig struct {
	Name        string                 `yaml:"name"`
	Type        string                 `yaml:"type"` // file_watch, command, webhook
	Source      string                 `yaml:"source"`
	Pattern     string                 `yaml:"pattern,omitempty"`
	Config      map[string]interface{} `yaml:"config,omitempty"`
}

// ProcessorConfig defines data processors
type ProcessorConfig struct {
	Name   string                 `yaml:"name"`
	Type   string                 `yaml:"type"` // filter, transform, aggregate, enrich
	Config map[string]interface{} `yaml:"config"`
}

// OutputConfig defines where to send data
type OutputConfig struct {
	Name      string                 `yaml:"name"`
	Type      string                 `yaml:"type"` // http, pulsar, kafka, elasticsearch, prometheus
	Enabled   bool                   `yaml:"enabled"`
	URL       string                 `yaml:"url,omitempty"`
	Auth      AuthConfig             `yaml:"auth,omitempty"`
	Headers   map[string]string      `yaml:"headers,omitempty"`
	BatchSize int                    `yaml:"batch_size,omitempty"`
	Timeout   time.Duration          `yaml:"timeout,omitempty"`
	Retry     RetryConfig            `yaml:"retry,omitempty"`
	TLS       TLSConfig              `yaml:"tls,omitempty"`
	Config    map[string]interface{} `yaml:"config,omitempty"`
	DataTypes []string               `yaml:"data_types,omitempty"` // logs, metrics, traces, events
	Filters   []FilterConfig         `yaml:"filters,omitempty"`
}

// AuthConfig defines authentication
type AuthConfig struct {
	Type     string `yaml:"type"` // none, basic, bearer, api_key, oauth2
	Username string `yaml:"username,omitempty"`
	Password string `yaml:"password,omitempty"`
	Token    string `yaml:"token,omitempty"`
	APIKey   string `yaml:"api_key,omitempty"`
	Header   string `yaml:"header,omitempty"`
}

// RetryConfig defines retry behavior
type RetryConfig struct {
	MaxRetries      int           `yaml:"max_retries"`
	InitialBackoff  time.Duration `yaml:"initial_backoff"`
	MaxBackoff      time.Duration `yaml:"max_backoff"`
	BackoffMultiple float64       `yaml:"backoff_multiple"`
}

// TLSConfig defines TLS settings
type TLSConfig struct {
	Enabled            bool   `yaml:"enabled"`
	CertFile           string `yaml:"cert_file,omitempty"`
	KeyFile            string `yaml:"key_file,omitempty"`
	CAFile             string `yaml:"ca_file,omitempty"`
	InsecureSkipVerify bool   `yaml:"insecure_skip_verify,omitempty"`
}

// FilterConfig defines data filtering
type FilterConfig struct {
	Type      string                 `yaml:"type"` // include, exclude, regex, field_match
	Condition string                 `yaml:"condition,omitempty"`
	Field     string                 `yaml:"field,omitempty"`
	Value     interface{}            `yaml:"value,omitempty"`
	Config    map[string]interface{} `yaml:"config,omitempty"`
}

// HealthcheckConfig defines health check settings
type HealthcheckConfig struct {
	Enabled  bool          `yaml:"enabled"`
	Port     int           `yaml:"port"`
	Path     string        `yaml:"path"`
	Interval time.Duration `yaml:"interval"`
}

// Load loads configuration from file
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file %s: %w", path, err)
	}

	// Expand environment variables
	data = []byte(os.ExpandEnv(string(data)))

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file %s: %w", path, err)
	}

	// Set defaults
	if err := config.setDefaults(); err != nil {
		return nil, fmt.Errorf("failed to set defaults: %w", err)
	}

	// Validate configuration
	if err := config.validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return &config, nil
}

// setDefaults sets default values for configuration
func (c *Config) setDefaults() error {
	// Server defaults
	if c.Server.HeartbeatInterval == 0 {
		c.Server.HeartbeatInterval = 30 * time.Second
	}
	if c.Server.ReconnectInterval == 0 {
		c.Server.ReconnectInterval = 10 * time.Second
	}
	if c.Server.MaxReconnects == 0 {
		c.Server.MaxReconnects = 3
	}
	if c.Server.Timeout == 0 {
		c.Server.Timeout = 30 * time.Second
	}

	// Agent defaults
	if c.Agent.Name == "" {
		hostname, _ := os.Hostname()
		c.Agent.Name = hostname
	}
	if c.Agent.Hostname == "" {
		c.Agent.Hostname, _ = os.Hostname()
	}
	if c.Agent.DataDir == "" {
		c.Agent.DataDir = "/var/lib/pulse-hive"
	}
	if c.Agent.BufferSize == 0 {
		c.Agent.BufferSize = 10000
	}
	if c.Agent.BatchSize == 0 {
		c.Agent.BatchSize = 1000
	}
	if c.Agent.FlushInterval == 0 {
		c.Agent.FlushInterval = 10 * time.Second
	}
	if c.Agent.ProfilingPort == 0 {
		c.Agent.ProfilingPort = 6060
	}
	if c.Agent.MetricsPort == 0 {
		c.Agent.MetricsPort = 8080
	}

	// Logging defaults
	if c.Logging.Level == "" {
		c.Logging.Level = "info"
	}
	if c.Logging.Format == "" {
		c.Logging.Format = "json"
	}
	if c.Logging.Output == "" {
		c.Logging.Output = "stdout"
	}

	// Collector defaults
	if c.Collectors.Logs.ScanFreq == 0 {
		c.Collectors.Logs.ScanFreq = 10 * time.Second
	}
	if c.Collectors.Logs.RotateWait == 0 {
		c.Collectors.Logs.RotateWait = 5 * time.Second
	}
	if c.Collectors.Metrics.Interval == 0 {
		c.Collectors.Metrics.Interval = 60 * time.Second
	}

	// Healthcheck defaults
	if c.Healthcheck.Enabled && c.Healthcheck.Port == 0 {
		c.Healthcheck.Port = 8081
	}
	if c.Healthcheck.Path == "" {
		c.Healthcheck.Path = "/health"
	}
	if c.Healthcheck.Interval == 0 {
		c.Healthcheck.Interval = 30 * time.Second
	}

	return nil
}

// validate validates the configuration
func (c *Config) validate() error {
	if c.Server.URL == "" {
		return fmt.Errorf("server.url is required")
	}
	if c.Server.APIKey == "" {
		return fmt.Errorf("server.api_key is required")
	}
	if c.Agent.Name == "" {
		return fmt.Errorf("agent.name is required")
	}

	// Validate log levels
	validLogLevels := map[string]bool{
		"debug": true, "info": true, "warn": true, "error": true, "fatal": true,
	}
	if !validLogLevels[c.Logging.Level] {
		return fmt.Errorf("invalid logging level: %s", c.Logging.Level)
	}

	return nil
}