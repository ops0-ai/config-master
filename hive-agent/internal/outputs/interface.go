package outputs

import (
	"context"
	"time"

	"hive-agent/internal/config"
	"hive-agent/internal/logger"
)

// Output is the interface that all data outputs must implement
type Output interface {
	// Name returns the output name
	Name() string
	
	// Start starts the output
	Start(ctx context.Context) error
	
	// Stop stops the output gracefully
	Stop(ctx context.Context) error
	
	// Send sends data to the output
	Send(ctx context.Context, data []interface{}) error
	
	// Health returns the output health status
	Health() HealthStatus
}

// HealthStatus represents the health status of an output
type HealthStatus struct {
	Healthy   bool              `json:"healthy"`
	Message   string            `json:"message,omitempty"`
	Details   map[string]string `json:"details,omitempty"`
	Timestamp string            `json:"timestamp"`
}

// New creates a new output based on configuration
func New(cfg config.OutputConfig, log *logger.Logger) (Output, error) {
	switch cfg.Type {
	case "http":
		return NewHTTPOutput(cfg, log)
	case "elasticsearch":
		return NewElasticsearchOutput(cfg, log)
	case "prometheus":
		return NewPrometheusOutput(cfg, log)
	default:
		return NewHTTPOutput(cfg, log) // Default to HTTP
	}
}

// BatchData represents a batch of data to be sent
type BatchData struct {
	Items     []interface{} `json:"items"`
	Timestamp time.Time     `json:"timestamp"`
	BatchID   string        `json:"batch_id"`
	Source    string        `json:"source"`
}