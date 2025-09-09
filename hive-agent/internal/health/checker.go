package health

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"hive-agent/internal/config"
	"hive-agent/internal/logger"
)

// Checker provides health check endpoints
type Checker struct {
	config config.HealthcheckConfig
	logger *logger.Logger
	server *http.Server
}

// HealthStatus represents overall health status
type HealthStatus struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Uptime    string    `json:"uptime"`
	Version   string    `json:"version"`
}

// New creates a new health checker
func New(cfg config.HealthcheckConfig, log *logger.Logger) *Checker {
	return &Checker{
		config: cfg,
		logger: log,
	}
}

// Start starts the health check server
func (hc *Checker) Start(ctx context.Context) error {
	if !hc.config.Enabled {
		return nil
	}

	mux := http.NewServeMux()
	mux.HandleFunc(hc.config.Path, hc.healthHandler)

	hc.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", hc.config.Port),
		Handler: mux,
	}

	hc.logger.Info("Starting health check server",
		"port", hc.config.Port,
		"path", hc.config.Path,
	)

	go func() {
		if err := hc.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			hc.logger.Error("Health check server error", "error", err)
		}
	}()

	return nil
}

// Stop stops the health check server
func (hc *Checker) Stop(ctx context.Context) {
	if hc.server != nil {
		hc.server.Shutdown(ctx)
	}
}

// healthHandler handles health check requests
func (hc *Checker) healthHandler(w http.ResponseWriter, r *http.Request) {
	status := HealthStatus{
		Status:    "healthy",
		Timestamp: time.Now(),
		Uptime:    "unknown", // Would calculate actual uptime
		Version:   "1.0.0",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}