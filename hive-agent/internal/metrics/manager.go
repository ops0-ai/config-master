package metrics

import (
	"context"
	"sync"

	"hive-agent/internal/config"
	"hive-agent/internal/logger"
)

// Manager manages agent metrics
type Manager struct {
	config config.AgentConfig
	logger *logger.Logger
	
	mu      sync.RWMutex
	metrics map[string]interface{}
}

// New creates a new metrics manager
func New(cfg config.AgentConfig, log *logger.Logger) *Manager {
	return &Manager{
		config:  cfg,
		logger:  log,
		metrics: make(map[string]interface{}),
	}
}

// Start starts the metrics manager
func (m *Manager) Start(ctx context.Context) error {
	m.logger.Info("Starting metrics manager")
	return nil
}

// Stop stops the metrics manager
func (m *Manager) Stop(ctx context.Context) {
	m.logger.Info("Stopping metrics manager")
}

// GetMetrics returns current metrics
func (m *Manager) GetMetrics() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	result := make(map[string]interface{})
	for k, v := range m.metrics {
		result[k] = v
	}
	return result
}

// SetMetric sets a metric value
func (m *Manager) SetMetric(name string, value interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.metrics[name] = value
}