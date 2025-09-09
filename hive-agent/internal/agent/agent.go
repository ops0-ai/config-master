package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"time"

	"hive-agent/internal/config"
	"hive-agent/internal/logger"
	"hive-agent/internal/platform"
	"hive-agent/internal/collectors"
	"hive-agent/internal/outputs"
	"hive-agent/internal/pipeline"
	"hive-agent/internal/metrics"
	"hive-agent/internal/health"
)

// Agent represents the main Hive agent
type Agent struct {
	config     *config.Config
	logger     *logger.Logger
	platform   *platform.Client
	collectors []collectors.Collector
	outputs    []outputs.Output
	pipeline   *pipeline.Pipeline
	metrics    *metrics.Manager
	health     *health.Checker
	
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	startTime  time.Time
	
	// Channels for internal communication
	dataChan   chan interface{}
	errorChan  chan error
	
	// Agent state
	mu       sync.RWMutex
	status   string
	lastHeartbeat time.Time
}

// New creates a new Hive agent instance
func New(cfg *config.Config, log *logger.Logger) (*Agent, error) {
	log = log.Component("agent")
	
	// Create data and error channels
	dataChan := make(chan interface{}, cfg.Agent.BufferSize)
	errorChan := make(chan error, 100)

	// Create platform client
	platformClient, err := platform.New(cfg.Server, log.Subsystem("platform"))
	if err != nil {
		return nil, fmt.Errorf("failed to create platform client: %w", err)
	}

	// Create pipeline for data processing
	pipelineCfg := pipeline.Config{
		BufferSize:    cfg.Agent.BufferSize,
		BatchSize:     cfg.Agent.BatchSize,
		FlushInterval: cfg.Agent.FlushInterval,
		CompressData:  cfg.Agent.CompressData,
	}
	pipelineInstance := pipeline.New(pipelineCfg, log.Subsystem("pipeline"))

	// Create metrics manager
	metricsManager := metrics.New(cfg.Agent, log.Subsystem("metrics"))

	// Create health checker
	healthChecker := health.New(cfg.Healthcheck, log.Subsystem("health"))

	agent := &Agent{
		config:     cfg,
		logger:     log,
		platform:   platformClient,
		pipeline:   pipelineInstance,
		metrics:    metricsManager,
		health:     healthChecker,
		collectors: []collectors.Collector{},
		outputs:    []outputs.Output{},
		dataChan:   dataChan,
		errorChan:  errorChan,
		status:     "initializing",
		startTime:  time.Now(),
	}

	// Initialize collectors
	if err := agent.initializeCollectors(); err != nil {
		return nil, fmt.Errorf("failed to initialize collectors: %w", err)
	}

	// Initialize outputs
	if err := agent.initializeOutputs(); err != nil {
		return nil, fmt.Errorf("failed to initialize outputs: %w", err)
	}

	return agent, nil
}

// Start starts the agent and all its components
func (a *Agent) Start(ctx context.Context) error {
	a.ctx, a.cancel = context.WithCancel(ctx)
	a.logger.Info("Starting Pulse Hive Agent",
		"name", a.config.Agent.Name,
		"hostname", a.config.Agent.Hostname,
		"version", getVersion(),
		"go_version", runtime.Version(),
		"os", runtime.GOOS,
		"arch", runtime.GOARCH,
	)

	a.setStatus("starting")

	// Start profiling server if enabled
	if a.config.Agent.EnableProfiling {
		go func() {
			addr := fmt.Sprintf(":%d", a.config.Agent.ProfilingPort)
			a.logger.Info("Starting profiling server", "address", addr)
			if err := http.ListenAndServe(addr, nil); err != nil {
				a.logger.Error("Profiling server error", "error", err)
			}
		}()
	}

	// Start health checker
	if a.config.Healthcheck.Enabled {
		if err := a.health.Start(a.ctx); err != nil {
			return fmt.Errorf("failed to start health checker: %w", err)
		}
	}

	// Start metrics manager
	if a.config.Agent.EnableSelfMonitoring {
		if err := a.metrics.Start(a.ctx); err != nil {
			return fmt.Errorf("failed to start metrics manager: %w", err)
		}
	}

	// Start pipeline
	if err := a.pipeline.Start(a.ctx, a.dataChan); err != nil {
		return fmt.Errorf("failed to start pipeline: %w", err)
	}

	// Start data distribution service
	a.wg.Add(1)
	go a.dataDistributionService()

	// Register with platform
	if err := a.registerWithPlatform(); err != nil {
		a.logger.Warn("Failed to register with platform", "error", err)
	}

	// Start outputs
	for _, output := range a.outputs {
		if err := output.Start(a.ctx); err != nil {
			a.logger.Error("Failed to start output", "output", output.Name(), "error", err)
			continue
		}
		a.logger.Info("Started output", "output", output.Name())
	}

	// Start collectors
	for _, collector := range a.collectors {
		if err := collector.Start(a.ctx, a.dataChan); err != nil {
			a.logger.Error("Failed to start collector", "collector", collector.Name(), "error", err)
			continue
		}
		a.logger.Info("Started collector", "collector", collector.Name())
	}

	// Start background services
	a.wg.Add(4)
	go a.errorHandler()
	go a.heartbeatService()
	go a.configSyncService()
	go a.commandService()

	a.setStatus("running")
	a.logger.Info("Agent started successfully")

	// Wait for context cancellation
	<-a.ctx.Done()
	return nil
}

// Stop gracefully stops the agent
func (a *Agent) Stop(ctx context.Context) error {
	a.logger.Info("Stopping agent...")
	a.setStatus("stopping")

	// Cancel context to signal shutdown
	if a.cancel != nil {
		a.cancel()
	}

	// Stop collectors first
	for _, collector := range a.collectors {
		if err := collector.Stop(ctx); err != nil {
			a.logger.Error("Error stopping collector", "collector", collector.Name(), "error", err)
		} else {
			a.logger.Debug("Stopped collector", "collector", collector.Name())
		}
	}

	// Stop pipeline (process remaining data)
	if a.pipeline != nil {
		if err := a.pipeline.Stop(ctx); err != nil {
			a.logger.Error("Error stopping pipeline", "error", err)
		}
	}

	// Stop outputs last (after processing remaining data)
	for _, output := range a.outputs {
		if err := output.Stop(ctx); err != nil {
			a.logger.Error("Error stopping output", "output", output.Name(), "error", err)
		} else {
			a.logger.Debug("Stopped output", "output", output.Name())
		}
	}

	// Stop other services
	if a.metrics != nil {
		a.metrics.Stop(ctx)
	}
	if a.health != nil {
		a.health.Stop(ctx)
	}

	// Close channels
	close(a.dataChan)
	close(a.errorChan)

	// Wait for background goroutines with timeout
	done := make(chan struct{})
	go func() {
		a.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		a.logger.Info("All background services stopped")
	case <-ctx.Done():
		a.logger.Warn("Shutdown timeout reached, forcing exit")
	}

	a.setStatus("stopped")
	return nil
}

// Status returns the current agent status
func (a *Agent) Status() string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.status
}

// setStatus sets the agent status thread-safely
func (a *Agent) setStatus(status string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.status = status
	a.logger.Debug("Agent status changed", "status", status)
}

// initializeCollectors initializes all configured collectors
func (a *Agent) initializeCollectors() error {
	// Log collector
	if a.config.Collectors.Logs.Enabled {
		logCollector, err := collectors.NewLogCollector(
			a.config.Collectors.Logs,
			a.logger.Subsystem("log-collector"),
		)
		if err != nil {
			return fmt.Errorf("failed to create log collector: %w", err)
		}
		a.collectors = append(a.collectors, logCollector)
	}

	// Metrics collector
	if a.config.Collectors.Metrics.Enabled {
		metricsCollector, err := collectors.NewSystemMetricsCollector(
			a.config.Collectors.Metrics,
			a.logger.Subsystem("metrics-collector"),
		)
		if err != nil {
			return fmt.Errorf("failed to create metrics collector: %w", err)
		}
		a.collectors = append(a.collectors, metricsCollector)
	}

	// Traces collector
	if a.config.Collectors.Traces.Enabled {
		tracesCollector, err := collectors.NewOTLPTracesCollector(
			a.config.Collectors.Traces,
			a.logger.Subsystem("traces-collector"),
		)
		if err != nil {
			return fmt.Errorf("failed to create traces collector: %w", err)
		}
		a.collectors = append(a.collectors, tracesCollector)
	}

	// Events collector
	if a.config.Collectors.Events.Enabled {
		eventsCollector, err := collectors.NewSystemEventsCollector(
			a.config.Collectors.Events,
			a.logger.Subsystem("events-collector"),
		)
		if err != nil {
			return fmt.Errorf("failed to create events collector: %w", err)
		}
		a.collectors = append(a.collectors, eventsCollector)
	}

	return nil
}

// initializeOutputs initializes all configured outputs
func (a *Agent) initializeOutputs() error {
	for i, outputCfg := range a.config.Outputs {
		if !outputCfg.Enabled {
			continue
		}

		output, err := outputs.New(outputCfg, a.logger.Subsystem("output"))
		if err != nil {
			return fmt.Errorf("failed to create output %d (%s): %w", i, outputCfg.Name, err)
		}

		a.outputs = append(a.outputs, output)
	}

	return nil
}

// registerWithPlatform registers the agent with the Pulse platform
func (a *Agent) registerWithPlatform() error {
	hostname, _ := os.Hostname()
	
	registrationData := platform.AgentRegistration{
		Name:         a.config.Agent.Name,
		Hostname:     hostname,
		IPAddress:    getLocalIP(),
		OSType:       runtime.GOOS,
		OSVersion:    getOSVersion(),
		Arch:         runtime.GOARCH,
		Version:      getVersion(),
		Capabilities: a.getCapabilities(),
		SystemInfo:   a.getSystemInfo(),
		Metadata:     a.config.Agent.Tags,
	}

	if err := a.platform.Register(a.ctx, registrationData); err != nil {
		return fmt.Errorf("failed to register with platform: %w", err)
	}

	a.logger.Info("Successfully registered with platform")
	return nil
}

// heartbeatService sends periodic heartbeats to the platform
func (a *Agent) heartbeatService() {
	defer a.wg.Done()

	ticker := time.NewTicker(a.config.Server.HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			if err := a.sendHeartbeat(); err != nil {
				a.logger.Error("Failed to send heartbeat", "error", err)
			}
		}
	}
}

// sendHeartbeat sends a heartbeat to the platform
func (a *Agent) sendHeartbeat() error {
	heartbeat := platform.Heartbeat{
		Status:     a.Status(),
		SystemInfo: a.getSystemInfo(),
		Metrics:    a.getAgentMetrics(),
		Timestamp:  time.Now(),
	}

	if err := a.platform.Heartbeat(a.ctx, heartbeat); err != nil {
		return err
	}

	a.mu.Lock()
	a.lastHeartbeat = time.Now()
	a.mu.Unlock()

	return nil
}

// configSyncService periodically syncs configuration with the platform
func (a *Agent) configSyncService() {
	defer a.wg.Done()

	// Sync every 5 minutes
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			if err := a.syncConfiguration(); err != nil {
				a.logger.Error("Failed to sync configuration", "error", err)
			}
		}
	}
}

// syncConfiguration syncs configuration with the platform
func (a *Agent) syncConfiguration() error {
	// This will be implemented to fetch updated configuration from the platform
	// and hot-reload components as needed
	return nil
}

// commandService polls for commands from the platform (more reliable than WebSocket)
func (a *Agent) commandService() {
	defer a.wg.Done()
	
	// Poll for commands every 10 seconds
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	a.logger.Info("Command service started - polling for commands")
	
	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			// Poll for pending commands
			if err := a.pollForCommands(); err != nil {
				a.logger.Error("Failed to poll for commands", "error", err)
			}
		}
	}
}

// pollForCommands checks for pending commands from the platform
func (a *Agent) pollForCommands() error {
	commands, err := a.platform.GetPendingCommands(a.ctx)
	if err != nil {
		return err
	}

	for _, cmd := range commands {
		a.logger.Info("Received command", "id", cmd.ID, "type", cmd.Type, "command", cmd.Command)
		
		// Execute command in background
		go func(command platform.Command) {
			response := a.executeCommand(command)
			if err := a.platform.SendCommandResponse(a.ctx, response); err != nil {
				a.logger.Error("Failed to send command response", "error", err)
			}
		}(cmd)
	}

	return nil
}

// executeCommand executes a command and returns the response
func (a *Agent) executeCommand(cmd platform.Command) platform.CommandResponse {
	startTime := time.Now()
	response := platform.CommandResponse{
		ID:        cmd.ID,
		Success:   false,
		Timestamp: time.Now(),
	}

	// Handle different command types
	switch cmd.Type {
	case "system", "execute":
		// Execute system command (handle both "system" and "execute" types)
		output, exitCode, err := a.executeSystemCommand(cmd.Command)
		if err != nil {
			response.Error = err.Error()
			response.ExitCode = exitCode
		} else {
			response.Success = true
			response.Response = output
			response.ExitCode = exitCode
		}
		
	case "config_reload":
		// Reload configuration
		if err := a.reloadConfiguration(); err != nil {
			response.Error = err.Error()
		} else {
			response.Success = true
			response.Response = "Configuration reloaded successfully"
		}
		
	case "restart":
		// Execute restart command
		output, exitCode, err := a.executeSystemCommand("sudo systemctl restart hive-agent || sudo launchctl restart com.pulse.hive-agent || sudo service hive-agent restart")
		if err != nil {
			// Try alternative restart methods
			altOutput, altExitCode, altErr := a.executeSystemCommand("sudo pkill -f hive-agent && sleep 2 && sudo systemctl start hive-agent || sudo launchctl start com.pulse.hive-agent || sudo service hive-agent start")
			if altErr != nil {
				response.Error = fmt.Sprintf("Restart failed: %s; Alternative failed: %s", err.Error(), altErr.Error())
				response.ExitCode = exitCode
			} else {
				response.Success = true
				response.Response = fmt.Sprintf("Agent restarted via alternative method: %s", altOutput)
				response.ExitCode = altExitCode
			}
		} else {
			response.Success = true
			response.Response = fmt.Sprintf("Agent restart command executed: %s", output)
			response.ExitCode = exitCode
		}
		
	case "status":
		// Return status information
		response.Success = true
		status := map[string]interface{}{
			"status":      a.Status(),
			"uptime":      time.Since(a.startTime).Seconds(),
			"system_info": a.getSystemInfo(),
		}
		statusJson, _ := json.Marshal(status)
		response.Response = string(statusJson)
		
	default:
		response.Error = fmt.Sprintf("Unknown command type: %s", cmd.Type)
	}

	response.ExecutionTime = time.Since(startTime).Milliseconds()
	
	a.logger.Info("Command executed", 
		"id", cmd.ID, 
		"type", cmd.Type, 
		"success", response.Success,
		"execution_time_ms", response.ExecutionTime,
	)

	return response
}

// executeSystemCommand executes a system command using shell
func (a *Agent) executeSystemCommand(command string) (string, int, error) {
	// Set timeout for command execution
	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()
	
	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	
	output, err := cmd.CombinedOutput()
	exitCode := 0
	
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}
	
	return string(output), exitCode, err
}

// reloadConfiguration reloads the agent configuration
func (a *Agent) reloadConfiguration() error {
	// This would reload the configuration and restart necessary components
	a.logger.Info("Configuration reload requested")
	// Implementation would go here
	return nil
}

// errorHandler handles errors from all components
func (a *Agent) errorHandler() {
	defer a.wg.Done()

	for {
		select {
		case <-a.ctx.Done():
			return
		case err := <-a.errorChan:
			a.logger.Error("Component error", "error", err)
			// Could implement error reporting to platform here
		}
	}
}

// getCapabilities returns the agent's capabilities
func (a *Agent) getCapabilities() []string {
	capabilities := []string{}

	if a.config.Collectors.Logs.Enabled {
		capabilities = append(capabilities, "logs")
	}
	if a.config.Collectors.Metrics.Enabled {
		capabilities = append(capabilities, "metrics")
	}
	if a.config.Collectors.Traces.Enabled {
		capabilities = append(capabilities, "traces")
	}
	if a.config.Collectors.Events.Enabled {
		capabilities = append(capabilities, "events")
	}

	return capabilities
}

// getSystemInfo returns current system information
func (a *Agent) getSystemInfo() map[string]interface{} {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	return map[string]interface{}{
		"uptime":          time.Since(a.startTime).Seconds(),
		"goroutines":      runtime.NumGoroutine(),
		"memory_used":     memStats.Alloc,
		"memory_total":    memStats.TotalAlloc,
		"gc_runs":         memStats.NumGC,
		"cpu_cores":       runtime.NumCPU(),
		"go_version":      runtime.Version(),
		"collectors":      len(a.collectors),
		"outputs":         len(a.outputs),
		"last_heartbeat":  a.lastHeartbeat,
	}
}

// getAgentMetrics returns agent-specific metrics
func (a *Agent) getAgentMetrics() map[string]interface{} {
	if a.metrics == nil {
		return nil
	}
	return a.metrics.GetMetrics()
}

// Helper functions
func getVersion() string {
	// This would be set at build time
	return "1.0.0"
}

func getLocalIP() string {
	// Implementation to get local IP address
	return "127.0.0.1"
}

func getOSVersion() string {
	// Implementation to get OS version
	return runtime.GOOS
}

// dataDistributionService distributes batched data from pipeline to all enabled outputs
func (a *Agent) dataDistributionService() {
	defer a.wg.Done()
	
	a.logger.Info("Starting data distribution service")
	
	outputCh := a.pipeline.GetOutput()
	
	for {
		select {
		case <-a.ctx.Done():
			a.logger.Info("Data distribution service shutting down")
			return
		case batch, ok := <-outputCh:
			if !ok {
				a.logger.Info("Pipeline output channel closed")
				return
			}
			
			if len(batch) == 0 {
				continue
			}
			
			// Distribute to all enabled outputs concurrently
			var wg sync.WaitGroup
			for _, output := range a.outputs {
				wg.Add(1)
				go func(out outputs.Output) {
					defer wg.Done()
					
					// Create a timeout context for this output
					ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
					defer cancel()
					
					if err := out.Send(ctx, batch); err != nil {
						a.logger.Error("Failed to send batch to output", 
							"output", out.Name(), 
							"batch_size", len(batch),
							"error", err)
					} else {
						a.logger.Debug("Successfully sent batch to output",
							"output", out.Name(),
							"batch_size", len(batch))
					}
				}(output)
			}
			
			// Wait for all outputs to complete or timeout
			done := make(chan struct{})
			go func() {
				wg.Wait()
				close(done)
			}()
			
			select {
			case <-done:
				// All outputs completed
			case <-time.After(45*time.Second):
				a.logger.Warn("Some outputs timed out while sending batch", "batch_size", len(batch))
			case <-a.ctx.Done():
				return
			}
		}
	}
}