package outputs

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"hive-agent/internal/config"
	"hive-agent/internal/logger"
)

// HTTPOutput sends data to HTTP endpoints
type HTTPOutput struct {
	name       string
	config     config.OutputConfig
	logger     *logger.Logger
	httpClient *http.Client
	
	healthy   bool
	lastError string
}

// NewHTTPOutput creates a new HTTP output
func NewHTTPOutput(cfg config.OutputConfig, log *logger.Logger) (*HTTPOutput, error) {
	// Create HTTP client with timeout and TLS configuration
	transport := &http.Transport{
		MaxIdleConns:        10,
		IdleConnTimeout:     30 * time.Second,
		DisableCompression:  false,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	// Configure TLS if needed
	if cfg.TLS.Enabled {
		transport.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: cfg.TLS.InsecureSkipVerify,
		}
	}

	httpClient := &http.Client{
		Transport: transport,
		Timeout:   cfg.Timeout,
	}

	if cfg.Timeout == 0 {
		httpClient.Timeout = 30 * time.Second
	}

	return &HTTPOutput{
		name:       cfg.Name,
		config:     cfg,
		logger:     log.WithField("output", cfg.Name),
		httpClient: httpClient,
		healthy:    true,
	}, nil
}

// Name returns the output name
func (ho *HTTPOutput) Name() string {
	return ho.name
}

// Start starts the HTTP output
func (ho *HTTPOutput) Start(ctx context.Context) error {
	ho.logger.Info("Starting HTTP output", "url", ho.config.URL)
	return nil
}

// Stop stops the HTTP output
func (ho *HTTPOutput) Stop(ctx context.Context) error {
	ho.logger.Info("Stopping HTTP output")
	return nil
}

// Send sends data to the HTTP endpoint
func (ho *HTTPOutput) Send(ctx context.Context, data []interface{}) error {
	if !ho.config.Enabled {
		return nil
	}

	// For OpenObserve compatibility, send raw data array
	var payload interface{}
	if ho.config.URL != "" && (strings.Contains(ho.config.URL, "openobserve") || strings.Contains(ho.config.URL, "_json")) {
		// OpenObserve expects raw array of log objects
		payload = data
	} else {
		// Default wrapper format for other endpoints
		payload = map[string]interface{}{
			"items":     data,
			"timestamp": time.Now(),
			"batch_id":  fmt.Sprintf("batch-%d", time.Now().UnixNano()),
			"source":    "hive-agent",
		}
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		ho.setError(fmt.Sprintf("Failed to marshal data: %v", err))
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, "POST", ho.config.URL, bytes.NewReader(jsonData))
	if err != nil {
		ho.setError(fmt.Sprintf("Failed to create request: %v", err))
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Pulse-Hive-Agent/1.0.0")

	// Add configured headers
	for key, value := range ho.config.Headers {
		req.Header.Set(key, value)
	}

	// Set authentication
	ho.setAuthHeaders(req)

	// Send request with retry
	err = ho.sendWithRetry(ctx, req)
	if err != nil {
		ho.setError(err.Error())
		return err
	}

	ho.clearError()
	ho.logger.Debug("Successfully sent batch", "items", len(data), "size", len(jsonData))
	return nil
}

// sendWithRetry sends the request with retry logic
func (ho *HTTPOutput) sendWithRetry(ctx context.Context, req *http.Request) error {
	var lastErr error
	maxRetries := ho.config.Retry.MaxRetries
	if maxRetries == 0 {
		maxRetries = 3
	}

	backoff := ho.config.Retry.InitialBackoff
	if backoff == 0 {
		backoff = 5 * time.Second
	}

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Wait before retry
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}

			// Exponential backoff
			backoff = time.Duration(float64(backoff) * ho.config.Retry.BackoffMultiple)
			if ho.config.Retry.MaxBackoff > 0 && backoff > ho.config.Retry.MaxBackoff {
				backoff = ho.config.Retry.MaxBackoff
			}

			ho.logger.Debug("Retrying request", "attempt", attempt, "backoff", backoff)
		}

		resp, err := ho.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("HTTP request failed: %w", err)
			ho.logger.Warn("HTTP request failed", "attempt", attempt, "error", err)
			continue
		}

		resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return nil // Success
		}

		lastErr = fmt.Errorf("HTTP request failed with status %d", resp.StatusCode)
		
		// Don't retry on client errors (4xx)
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			ho.logger.Error("HTTP client error, not retrying", "status", resp.StatusCode)
			break
		}

		ho.logger.Warn("HTTP request failed with server error", "attempt", attempt, "status", resp.StatusCode)
	}

	return lastErr
}

// setAuthHeaders sets authentication headers
func (ho *HTTPOutput) setAuthHeaders(req *http.Request) {
	switch ho.config.Auth.Type {
	case "bearer":
		if ho.config.Auth.Token != "" {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", ho.config.Auth.Token))
		}
	case "basic":
		if ho.config.Auth.Username != "" && ho.config.Auth.Password != "" {
			req.SetBasicAuth(ho.config.Auth.Username, ho.config.Auth.Password)
		}
	case "api_key":
		if ho.config.Auth.APIKey != "" {
			headerName := ho.config.Auth.Header
			if headerName == "" {
				headerName = "X-API-Key"
			}
			req.Header.Set(headerName, ho.config.Auth.APIKey)
		}
	}
}

// Health returns the output health status
func (ho *HTTPOutput) Health() HealthStatus {
	status := HealthStatus{
		Healthy:   ho.healthy,
		Message:   "HTTP output operational",
		Timestamp: time.Now().Format(time.RFC3339),
		Details: map[string]string{
			"url":     ho.config.URL,
			"enabled": fmt.Sprintf("%t", ho.config.Enabled),
		},
	}

	if ho.lastError != "" {
		status.Message = ho.lastError
		status.Healthy = false
	}

	return status
}

// setError sets the last error and marks output as unhealthy
func (ho *HTTPOutput) setError(err string) {
	ho.lastError = err
	ho.healthy = false
}

// clearError clears the last error and marks output as healthy
func (ho *HTTPOutput) clearError() {
	ho.lastError = ""
	ho.healthy = true
}