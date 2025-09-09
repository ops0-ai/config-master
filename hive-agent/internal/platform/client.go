package platform

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"hive-agent/internal/config"
	"hive-agent/internal/logger"
)

// Client handles communication with the Pulse platform
type Client struct {
	config     config.ServerConfig
	logger     *logger.Logger
	httpClient *http.Client
	wsConn     *websocket.Conn
	wsConnMu   sync.RWMutex
	
	// Connection state
	connected    bool
	reconnecting bool
	reconnectMu  sync.RWMutex
	
	// Command handling
	commandChan chan Command
}

// AgentRegistration contains agent registration information
type AgentRegistration struct {
	Name         string                 `json:"name"`
	Hostname     string                 `json:"hostname"`
	IPAddress    string                 `json:"ip_address,omitempty"`
	OSType       string                 `json:"os_type"`
	OSVersion    string                 `json:"os_version,omitempty"`
	Arch         string                 `json:"arch"`
	Version      string                 `json:"version"`
	Capabilities []string               `json:"capabilities"`
	SystemInfo   map[string]interface{} `json:"system_info"`
	Metadata     map[string]string      `json:"metadata,omitempty"`
}

// Heartbeat contains heartbeat information
type Heartbeat struct {
	Status     string                 `json:"status"`
	SystemInfo map[string]interface{} `json:"system_info"`
	Metrics    map[string]interface{} `json:"metrics,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
}

// TelemetryData contains telemetry information
type TelemetryData struct {
	Type      string                 `json:"type"` // log, metric, trace, event
	Source    string                 `json:"source"`
	Data      map[string]interface{} `json:"data"`
	Timestamp time.Time              `json:"timestamp"`
}

// Command represents a command from the platform
type Command struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Command     string                 `json:"command"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
	Timeout     time.Duration          `json:"timeout,omitempty"`
	SessionID   string                 `json:"session_id,omitempty"`
}

// CommandResponse represents a command response
type CommandResponse struct {
	ID            string    `json:"id"`
	Success       bool      `json:"success"`
	Response      string    `json:"response,omitempty"`
	Error         string    `json:"error,omitempty"`
	ExitCode      int       `json:"exit_code,omitempty"`
	ExecutionTime int64     `json:"execution_time_ms"`
	Timestamp     time.Time `json:"timestamp"`
}

// ConfigurationUpdate represents a configuration update from the platform
type ConfigurationUpdate struct {
	Version     string                 `json:"version"`
	Collectors  map[string]interface{} `json:"collectors,omitempty"`
	Outputs     []config.OutputConfig  `json:"outputs,omitempty"`
	Settings    map[string]interface{} `json:"settings,omitempty"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// New creates a new platform client
func New(cfg config.ServerConfig, log *logger.Logger) (*Client, error) {
	// Create HTTP client
	transport := &http.Transport{
		MaxIdleConns:        10,
		IdleConnTimeout:     30 * time.Second,
		DisableCompression:  false,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	// Configure TLS if needed
	if cfg.URL[:5] == "https" {
		transport.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: false, // Should be configurable
		}
	}

	httpClient := &http.Client{
		Transport: transport,
		Timeout:   cfg.Timeout,
	}

	return &Client{
		config:     cfg,
		logger:     log,
		httpClient: httpClient,
		connected:  false,
		commandChan: make(chan Command, 100),
	}, nil
}

// Register registers the agent with the platform
func (c *Client) Register(ctx context.Context, registration AgentRegistration) error {
	endpoint := fmt.Sprintf("%s/api/hive/register", c.config.URL)
	
	// Create registration payload with API key included
	payload := map[string]interface{}{
		"api_key":      c.config.APIKey,
		"name":         registration.Name,
		"hostname":     registration.Hostname,
		"ip_address":   registration.IPAddress,
		"os_type":      registration.OSType,
		"os_version":   registration.OSVersion,
		"arch":         registration.Arch,
		"version":      registration.Version,
		"capabilities": registration.Capabilities,
		"system_info":  registration.SystemInfo,
		"metadata":     registration.Metadata,
	}
	
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal registration data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send registration request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("registration failed with status %d: %s", resp.StatusCode, string(body))
	}

	c.connected = true
	c.logger.Info("Successfully registered with platform")
	return nil
}

// Heartbeat sends a heartbeat to the platform
func (c *Client) Heartbeat(ctx context.Context, heartbeat Heartbeat) error {
	endpoint := fmt.Sprintf("%s/api/hive/heartbeat", c.config.URL)
	
	// Create heartbeat payload with API key included
	payload := map[string]interface{}{
		"api_key":     c.config.APIKey,
		"status":      heartbeat.Status,
		"system_info": heartbeat.SystemInfo,
		"metrics":     heartbeat.Metrics,
		"timestamp":   heartbeat.Timestamp,
	}
	
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal heartbeat data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send heartbeat: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// SendTelemetry sends telemetry data to the platform
func (c *Client) SendTelemetry(ctx context.Context, data []TelemetryData) error {
	endpoint := fmt.Sprintf("%s/api/hive/telemetry", c.config.URL)
	
	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal telemetry data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send telemetry: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telemetry upload failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetPendingCommands polls for pending commands from the platform
func (c *Client) GetPendingCommands(ctx context.Context) ([]Command, error) {
	endpoint := fmt.Sprintf("%s/api/hive/commands/pending", c.config.URL)
	
	req, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.setAuthHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending commands: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusNotFound {
		// No pending commands
		return []Command{}, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get pending commands, status %d: %s", resp.StatusCode, string(body))
	}

	var commands []Command
	if err := json.NewDecoder(resp.Body).Decode(&commands); err != nil {
		return nil, fmt.Errorf("failed to decode commands: %w", err)
	}

	return commands, nil
}

// SendCommandResponse sends a command response to the platform
func (c *Client) SendCommandResponse(ctx context.Context, response CommandResponse) error {
	endpoint := fmt.Sprintf("%s/api/hive/commands/%s/response", c.config.URL, response.ID)
	
	data, err := json.Marshal(response)
	if err != nil {
		return fmt.Errorf("failed to marshal command response: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send command response: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("command response failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// ConnectWebSocket establishes a WebSocket connection for real-time communication
func (c *Client) ConnectWebSocket(ctx context.Context) error {
	c.wsConnMu.Lock()
	defer c.wsConnMu.Unlock()

	if c.wsConn != nil {
		c.wsConn.Close()
	}

	// Convert HTTP URL to WebSocket URL
	wsURL := c.config.URL
	if wsURL[:4] == "http" {
		wsURL = "ws" + wsURL[4:]
	}
	wsURL += "/api/hive/ws"

	// Parse URL and add query parameters
	u, err := url.Parse(wsURL)
	if err != nil {
		return fmt.Errorf("invalid WebSocket URL: %w", err)
	}

	// Add API key as query parameter for WebSocket authentication
	q := u.Query()
	q.Set("api_key", c.config.APIKey)
	u.RawQuery = q.Encode()

	// Set up WebSocket dialer
	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = c.config.Timeout

	// Connect
	conn, _, err := dialer.DialContext(ctx, u.String(), nil)
	if err != nil {
		return fmt.Errorf("failed to connect to WebSocket: %w", err)
	}

	c.wsConn = conn
	c.logger.Info("WebSocket connection established")
	
	// Start command listener in background
	go c.startCommandListener(ctx)
	
	return nil
}

// ListenForCommands listens for commands from the platform via WebSocket
func (c *Client) ListenForCommands(ctx context.Context, commandChan chan<- Command) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			c.wsConnMu.RLock()
			conn := c.wsConn
			c.wsConnMu.RUnlock()

			if conn == nil {
				// Try to reconnect
				if err := c.ConnectWebSocket(ctx); err != nil {
					c.logger.Error("Failed to reconnect WebSocket", "error", err)
					time.Sleep(c.config.ReconnectInterval)
					continue
				}
				continue
			}

			// Set read deadline
			conn.SetReadDeadline(time.Now().Add(c.config.Timeout))

			var command Command
			if err := conn.ReadJSON(&command); err != nil {
				c.logger.Error("Failed to read WebSocket message", "error", err)
				c.closeWebSocket()
				continue
			}

			select {
			case commandChan <- command:
			case <-ctx.Done():
				return nil
			}
		}
	}
}

// closeWebSocket safely closes the WebSocket connection
func (c *Client) closeWebSocket() {
	c.wsConnMu.Lock()
	defer c.wsConnMu.Unlock()

	if c.wsConn != nil {
		c.wsConn.Close()
		c.wsConn = nil
	}
}

// IsConnected returns whether the client is connected to the platform
func (c *Client) IsConnected() bool {
	return c.connected
}

// setAuthHeaders sets authentication headers for HTTP requests
func (c *Client) setAuthHeaders(req *http.Request) {
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.config.APIKey))
	req.Header.Set("User-Agent", "Pulse-Hive-Agent/1.0.0")
}

// GetCommandChannel returns the command channel for receiving commands
func (c *Client) GetCommandChannel() <-chan Command {
	return c.commandChan
}

// SendCommandResponseWS sends a command response back to the platform via WebSocket
func (c *Client) SendCommandResponseWS(response CommandResponse) error {
	c.wsConnMu.RLock()
	conn := c.wsConn
	c.wsConnMu.RUnlock()

	if conn == nil {
		return fmt.Errorf("WebSocket connection not available")
	}

	// Set write deadline
	conn.SetWriteDeadline(time.Now().Add(c.config.Timeout))

	if err := conn.WriteJSON(map[string]interface{}{
		"type":     "command_response",
		"response": response,
	}); err != nil {
		c.logger.Error("Failed to send command response", "error", err)
		return err
	}

	c.logger.Debug("Command response sent", "id", response.ID, "success", response.Success)
	return nil
}

// UpdateListenForCommands modifies the existing method to use the internal channel
func (c *Client) startCommandListener(ctx context.Context) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				c.wsConnMu.RLock()
				conn := c.wsConn
				c.wsConnMu.RUnlock()

				if conn == nil {
					// Try to reconnect
					if err := c.ConnectWebSocket(ctx); err != nil {
						c.logger.Error("Failed to reconnect WebSocket", "error", err)
						time.Sleep(c.config.ReconnectInterval)
						continue
					}
					continue
				}

				// Set read deadline
				conn.SetReadDeadline(time.Now().Add(c.config.Timeout))

				var message map[string]interface{}
				if err := conn.ReadJSON(&message); err != nil {
					c.logger.Error("Failed to read WebSocket message", "error", err)
					c.closeWebSocket()
					continue
				}

				// Handle different message types
				msgType, ok := message["type"].(string)
				if !ok {
					c.logger.Warn("Received message without type")
					continue
				}

				switch msgType {
				case "command":
					// Parse command
					var command Command
					if cmdData, ok := message["command"]; ok {
						if cmdBytes, err := json.Marshal(cmdData); err == nil {
							if err := json.Unmarshal(cmdBytes, &command); err == nil {
								select {
								case c.commandChan <- command:
								case <-ctx.Done():
									return
								}
							}
						}
					}
				case "config_update":
					// Handle config updates
					c.logger.Info("Configuration update received")
					// This would be processed by the agent's config service
				default:
					c.logger.Debug("Received unknown message type", "type", msgType)
				}
			}
		}
	}()
}

// Close closes all connections
func (c *Client) Close() error {
	c.closeWebSocket()
	c.connected = false
	close(c.commandChan)
	return nil
}