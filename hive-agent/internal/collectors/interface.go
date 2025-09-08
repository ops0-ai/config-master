package collectors

import (
	"context"
)

// Collector is the interface that all data collectors must implement
type Collector interface {
	// Name returns the collector name
	Name() string
	
	// Start starts the collector
	Start(ctx context.Context, dataChan chan<- interface{}) error
	
	// Stop stops the collector gracefully
	Stop(ctx context.Context) error
	
	// Health returns the collector health status
	Health() HealthStatus
}

// HealthStatus represents the health status of a collector
type HealthStatus struct {
	Healthy   bool              `json:"healthy"`
	Message   string            `json:"message,omitempty"`
	Details   map[string]string `json:"details,omitempty"`
	Timestamp string            `json:"timestamp"`
}

// DataType represents the type of data collected
type DataType string

const (
	DataTypeLog    DataType = "log"
	DataTypeMetric DataType = "metric"
	DataTypeTrace  DataType = "trace"
	DataTypeEvent  DataType = "event"
)

// CollectedData represents data collected by collectors
type CollectedData struct {
	Type      DataType               `json:"type"`
	Source    string                 `json:"source"`
	Data      map[string]interface{} `json:"data"`
	Tags      map[string]string      `json:"tags,omitempty"`
	Timestamp string                 `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// LogData represents log data
type LogData struct {
	Message   string                 `json:"message"`
	Level     string                 `json:"level,omitempty"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
	Timestamp string                 `json:"timestamp"`
	Source    string                 `json:"source"`
	Tags      map[string]string      `json:"tags,omitempty"`
}

// MetricData represents metric data
type MetricData struct {
	Name      string            `json:"name"`
	Type      string            `json:"type"` // counter, gauge, histogram
	Value     interface{}       `json:"value"`
	Labels    map[string]string `json:"labels,omitempty"`
	Timestamp string            `json:"timestamp"`
	Unit      string            `json:"unit,omitempty"`
}

// TraceData represents trace data
type TraceData struct {
	TraceID    string                 `json:"trace_id"`
	SpanID     string                 `json:"span_id"`
	ParentID   string                 `json:"parent_id,omitempty"`
	Operation  string                 `json:"operation"`
	StartTime  string                 `json:"start_time"`
	EndTime    string                 `json:"end_time"`
	Duration   int64                  `json:"duration"` // nanoseconds
	Tags       map[string]string      `json:"tags,omitempty"`
	Logs       []map[string]interface{} `json:"logs,omitempty"`
}

// EventData represents event data
type EventData struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Category    string                 `json:"category,omitempty"`
	Severity    string                 `json:"severity,omitempty"`
	Title       string                 `json:"title"`
	Description string                 `json:"description,omitempty"`
	Data        map[string]interface{} `json:"data,omitempty"`
	Tags        map[string]string      `json:"tags,omitempty"`
	Timestamp   string                 `json:"timestamp"`
}

// IssueData represents detected issues/problems
type IssueData struct {
	ID           string                 `json:"id"`
	Severity     string                 `json:"severity"` // critical, error, warning, info
	Category     string                 `json:"category"`
	Title        string                 `json:"title"`
	Description  string                 `json:"description"`
	Pattern      string                 `json:"pattern,omitempty"`
	Context      map[string]interface{} `json:"context,omitempty"`
	SuggestedFix string                 `json:"suggested_fix,omitempty"`
	AutoFixable  bool                   `json:"auto_fixable"`
	Source       string                 `json:"source"`
	Timestamp    string                 `json:"timestamp"`
}