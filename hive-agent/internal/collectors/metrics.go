package collectors

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"time"

	"hive-agent/internal/config"
	"hive-agent/internal/logger"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

// SystemMetricsCollector collects system metrics
type SystemMetricsCollector struct {
	name     string
	config   config.MetricsCollectorConfig
	logger   *logger.Logger
	dataChan chan<- interface{}
	
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
	
	healthy   bool
	lastError string
}

// NewSystemMetricsCollector creates a new system metrics collector
func NewSystemMetricsCollector(cfg config.MetricsCollectorConfig, log *logger.Logger) (*SystemMetricsCollector, error) {
	if !cfg.Enabled {
		return nil, fmt.Errorf("metrics collector is disabled")
	}

	return &SystemMetricsCollector{
		name:    "system-metrics-collector",
		config:  cfg,
		logger:  log,
		healthy: true,
	}, nil
}

// Name returns the collector name
func (smc *SystemMetricsCollector) Name() string {
	return smc.name
}

// Start starts the metrics collector
func (smc *SystemMetricsCollector) Start(ctx context.Context, dataChan chan<- interface{}) error {
	smc.ctx, smc.cancel = context.WithCancel(ctx)
	smc.dataChan = dataChan
	
	smc.logger.Info("Starting system metrics collector")

	smc.wg.Add(1)
	go smc.collectMetrics()

	smc.logger.Info("System metrics collector started")
	return nil
}

// Stop stops the metrics collector
func (smc *SystemMetricsCollector) Stop(ctx context.Context) error {
	smc.logger.Info("Stopping system metrics collector")
	
	if smc.cancel != nil {
		smc.cancel()
	}

	// Wait for goroutines to finish
	done := make(chan struct{})
	go func() {
		smc.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		smc.logger.Info("System metrics collector stopped")
		return nil
	case <-ctx.Done():
		smc.logger.Warn("System metrics collector stop timeout")
		return ctx.Err()
	}
}

// Health returns the collector health status
func (smc *SystemMetricsCollector) Health() HealthStatus {
	status := HealthStatus{
		Healthy:   smc.healthy,
		Message:   "System metrics collector operational",
		Timestamp: time.Now().Format(time.RFC3339),
		Details: map[string]string{
			"interval": smc.config.Interval.String(),
		},
	}

	if smc.lastError != "" {
		status.Message = smc.lastError
		status.Healthy = false
	}

	return status
}

// collectMetrics periodically collects system metrics
func (smc *SystemMetricsCollector) collectMetrics() {
	defer smc.wg.Done()

	ticker := time.NewTicker(smc.config.Interval)
	defer ticker.Stop()

	// Collect initial metrics
	smc.gatherMetrics()

	for {
		select {
		case <-smc.ctx.Done():
			return
		case <-ticker.C:
			smc.gatherMetrics()
		}
	}
}

// gatherMetrics collects all configured system metrics
func (smc *SystemMetricsCollector) gatherMetrics() {
	timestamp := time.Now()
	
	if smc.config.SystemMetrics.CPU {
		smc.collectCPUMetrics(timestamp)
	}
	
	if smc.config.SystemMetrics.Memory {
		smc.collectMemoryMetrics(timestamp)
	}
	
	if smc.config.SystemMetrics.Disk {
		smc.collectDiskMetrics(timestamp)
	}
	
	if smc.config.SystemMetrics.Network {
		smc.collectNetworkMetrics(timestamp)
	}
	
	if smc.config.SystemMetrics.Process {
		smc.collectProcessMetrics(timestamp)
	}

	// Collect custom metrics
	for _, customMetric := range smc.config.CustomMetrics {
		smc.collectCustomMetric(customMetric, timestamp)
	}
}

// collectCPUMetrics collects CPU usage metrics
func (smc *SystemMetricsCollector) collectCPUMetrics(timestamp time.Time) {
	cpuPercent, err := cpu.Percent(time.Second, false)
	if err != nil {
		smc.logger.Error("Failed to get CPU metrics", "error", err)
		smc.lastError = fmt.Sprintf("CPU metrics error: %v", err)
		return
	}

	if len(cpuPercent) > 0 {
		smc.sendMetric(&MetricData{
			Name:      "system.cpu.usage_percent",
			Type:      "gauge",
			Value:     cpuPercent[0],
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "percent",
		})
	}

	// Per-core CPU metrics
	cpuPerCore, err := cpu.Percent(time.Second, true)
	if err == nil {
		for i, usage := range cpuPerCore {
			smc.sendMetric(&MetricData{
				Name:  "system.cpu.core.usage_percent",
				Type:  "gauge",
				Value: usage,
				Labels: map[string]string{
					"core": fmt.Sprintf("%d", i),
				},
				Timestamp: timestamp.Format(time.RFC3339),
				Unit:      "percent",
			})
		}
	}

	// CPU load average (Linux/Mac)
	if runtime.GOOS != "windows" {
		// Load average would be implemented here
	}
}

// collectMemoryMetrics collects memory usage metrics
func (smc *SystemMetricsCollector) collectMemoryMetrics(timestamp time.Time) {
	memInfo, err := mem.VirtualMemory()
	if err != nil {
		smc.logger.Error("Failed to get memory metrics", "error", err)
		smc.lastError = fmt.Sprintf("Memory metrics error: %v", err)
		return
	}

	smc.sendMetric(&MetricData{
		Name:      "system.memory.total",
		Type:      "gauge",
		Value:     memInfo.Total,
		Timestamp: timestamp.Format(time.RFC3339),
		Unit:      "bytes",
	})

	smc.sendMetric(&MetricData{
		Name:      "system.memory.used",
		Type:      "gauge",
		Value:     memInfo.Used,
		Timestamp: timestamp.Format(time.RFC3339),
		Unit:      "bytes",
	})

	smc.sendMetric(&MetricData{
		Name:      "system.memory.available",
		Type:      "gauge",
		Value:     memInfo.Available,
		Timestamp: timestamp.Format(time.RFC3339),
		Unit:      "bytes",
	})

	smc.sendMetric(&MetricData{
		Name:      "system.memory.usage_percent",
		Type:      "gauge",
		Value:     memInfo.UsedPercent,
		Timestamp: timestamp.Format(time.RFC3339),
		Unit:      "percent",
	})

	// Swap metrics
	swapInfo, err := mem.SwapMemory()
	if err == nil {
		smc.sendMetric(&MetricData{
			Name:      "system.swap.total",
			Type:      "gauge",
			Value:     swapInfo.Total,
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "bytes",
		})

		smc.sendMetric(&MetricData{
			Name:      "system.swap.used",
			Type:      "gauge",
			Value:     swapInfo.Used,
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "bytes",
		})
	}
}

// collectDiskMetrics collects disk usage metrics
func (smc *SystemMetricsCollector) collectDiskMetrics(timestamp time.Time) {
	partitions, err := disk.Partitions(false)
	if err != nil {
		smc.logger.Error("Failed to get disk partitions", "error", err)
		return
	}

	for _, partition := range partitions {
		usage, err := disk.Usage(partition.Mountpoint)
		if err != nil {
			continue
		}

		labels := map[string]string{
			"device":     partition.Device,
			"mountpoint": partition.Mountpoint,
			"fstype":     partition.Fstype,
		}

		smc.sendMetric(&MetricData{
			Name:      "system.disk.total",
			Type:      "gauge",
			Value:     usage.Total,
			Labels:    labels,
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "bytes",
		})

		smc.sendMetric(&MetricData{
			Name:      "system.disk.used",
			Type:      "gauge",
			Value:     usage.Used,
			Labels:    labels,
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "bytes",
		})

		smc.sendMetric(&MetricData{
			Name:      "system.disk.free",
			Type:      "gauge",
			Value:     usage.Free,
			Labels:    labels,
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "bytes",
		})

		smc.sendMetric(&MetricData{
			Name:      "system.disk.usage_percent",
			Type:      "gauge",
			Value:     usage.UsedPercent,
			Labels:    labels,
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "percent",
		})
	}
}

// collectNetworkMetrics collects network interface metrics
func (smc *SystemMetricsCollector) collectNetworkMetrics(timestamp time.Time) {
	interfaces, err := net.IOCounters(true)
	if err != nil {
		smc.logger.Error("Failed to get network metrics", "error", err)
		return
	}

	for _, iface := range interfaces {
		labels := map[string]string{
			"interface": iface.Name,
		}

		smc.sendMetric(&MetricData{
			Name:      "system.network.bytes_sent",
			Type:      "counter",
			Value:     iface.BytesSent,
			Labels:    labels,
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "bytes",
		})

		smc.sendMetric(&MetricData{
			Name:      "system.network.bytes_recv",
			Type:      "counter",
			Value:     iface.BytesRecv,
			Labels:    labels,
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "bytes",
		})

		smc.sendMetric(&MetricData{
			Name:      "system.network.packets_sent",
			Type:      "counter",
			Value:     iface.PacketsSent,
			Labels:    labels,
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "count",
		})

		smc.sendMetric(&MetricData{
			Name:      "system.network.packets_recv",
			Type:      "counter",
			Value:     iface.PacketsRecv,
			Labels:    labels,
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "count",
		})
	}
}

// collectProcessMetrics collects process-related metrics
func (smc *SystemMetricsCollector) collectProcessMetrics(timestamp time.Time) {
	processes, err := process.Processes()
	if err != nil {
		smc.logger.Error("Failed to get process list", "error", err)
		return
	}

	processCount := len(processes)
	smc.sendMetric(&MetricData{
		Name:      "system.processes.count",
		Type:      "gauge",
		Value:     processCount,
		Timestamp: timestamp.Format(time.RFC3339),
		Unit:      "count",
	})

	// Count processes by status
	statusCounts := make(map[string]int)
	for _, proc := range processes {
		if status, err := proc.Status(); err == nil {
			statusCounts[status[0]]++
		}
	}

	for status, count := range statusCounts {
		smc.sendMetric(&MetricData{
			Name:  "system.processes.by_status",
			Type:  "gauge",
			Value: count,
			Labels: map[string]string{
				"status": status,
			},
			Timestamp: timestamp.Format(time.RFC3339),
			Unit:      "count",
		})
	}
}

// collectCustomMetric collects a custom metric
func (smc *SystemMetricsCollector) collectCustomMetric(metric config.CustomMetricConfig, timestamp time.Time) {
	// This would implement custom metric collection via commands or scripts
	// For now, we'll just log that it would be collected
	smc.logger.Debug("Custom metric would be collected", "name", metric.Name, "type", metric.Type)
}

// sendMetric sends a metric to the data channel
func (smc *SystemMetricsCollector) sendMetric(metric *MetricData) {
	select {
	case smc.dataChan <- CollectedData{
		Type:      DataTypeMetric,
		Source:    "system",
		Data:      map[string]interface{}{"metric": metric},
		Timestamp: metric.Timestamp,
	}:
	case <-smc.ctx.Done():
		return
	}
}