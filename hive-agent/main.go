package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"hive-agent/internal/agent"
	"hive-agent/internal/config"
	"hive-agent/internal/logger"
)

var (
	version   = "dev"
	buildTime = "unknown"
	gitCommit = "unknown"
)

func main() {
	var (
		configPath  = flag.String("config", "", "Path to configuration file")
		showVersion = flag.Bool("version", false, "Show version information")
		showHelp    = flag.Bool("help", false, "Show help information")
	)
	flag.Parse()

	if *showVersion {
		fmt.Printf("Pulse Hive Agent\n")
		fmt.Printf("Version: %s\n", version)
		fmt.Printf("Build Time: %s\n", buildTime)
		fmt.Printf("Git Commit: %s\n", gitCommit)
		os.Exit(0)
	}

	if *showHelp {
		printHelp()
		os.Exit(0)
	}

	// Determine config path
	if *configPath == "" {
		// Try default locations
		defaultPaths := []string{
			"/etc/pulse-hive/config.yaml",
			"/usr/local/etc/pulse-hive/config.yaml",
			"./config.yaml",
		}

		for _, path := range defaultPaths {
			if _, err := os.Stat(path); err == nil {
				*configPath = path
				break
			}
		}

		if *configPath == "" {
			log.Fatal("No configuration file found. Use -config flag to specify location.")
		}
	}

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger, err := logger.New(cfg.Logging)
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}

	logger.Info("Starting Pulse Hive Agent",
		"version", version,
		"buildTime", buildTime,
		"gitCommit", gitCommit,
		"config", *configPath,
	)

	// Create agent
	hiveAgent, err := agent.New(cfg, logger)
	if err != nil {
		logger.Error("Failed to create agent", "error", err)
		os.Exit(1)
	}

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start agent
	go func() {
		if err := hiveAgent.Start(ctx); err != nil {
			logger.Error("Agent failed to start", "error", err)
			cancel()
		}
	}()

	logger.Info("Pulse Hive Agent started successfully")

	// Wait for shutdown signal
	select {
	case sig := <-sigChan:
		logger.Info("Received shutdown signal", "signal", sig.String())
	case <-ctx.Done():
		logger.Info("Context cancelled")
	}

	// Graceful shutdown
	logger.Info("Shutting down agent...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := hiveAgent.Stop(shutdownCtx); err != nil {
		logger.Error("Error during shutdown", "error", err)
		os.Exit(1)
	}

	logger.Info("Agent shutdown complete")
}

func printHelp() {
	fmt.Printf(`Pulse Hive Agent - Distributed Observability Agent

USAGE:
    pulse-hive-agent [FLAGS]

FLAGS:
    -config <PATH>     Path to configuration file (default: auto-detect)
    -version           Show version information
    -help              Show this help message

CONFIGURATION:
    The agent looks for configuration files in the following order:
    1. Path specified by -config flag
    2. /etc/pulse-hive/config.yaml
    3. /usr/local/etc/pulse-hive/config.yaml
    4. ./config.yaml

EXAMPLES:
    # Start with default configuration
    pulse-hive-agent

    # Start with specific configuration
    pulse-hive-agent -config /path/to/config.yaml

    # Show version
    pulse-hive-agent -version

For more information, visit: https://docs.pulse-platform.com/hive-agent
`)
}