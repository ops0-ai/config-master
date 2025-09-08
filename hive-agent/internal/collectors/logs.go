package collectors

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"hive-agent/internal/config"
	"hive-agent/internal/logger"
)

// LogCollector collects log data from files
type LogCollector struct {
	name     string
	config   config.LogCollectorConfig
	logger   *logger.Logger
	dataChan chan<- interface{}
	
	// File watching
	watcher  *fsnotify.Watcher
	files    map[string]*logFile
	filesMu  sync.RWMutex
	patterns []*regexp.Regexp
	
	// State
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
	
	healthy bool
	lastError string
	
	// Production-grade controls
	maxLinesPerSecond int
	backpressureThreshold int
	skipHistoricalData bool
}

type logFile struct {
	path     string
	file     *os.File
	scanner  *bufio.Scanner
	position int64
	parser   string
	tags     map[string]string
	fields   map[string]string
	
	// Streaming control
	linesPerSecond int
	lastReadTime   time.Time
	skipHistorical bool
}

// NewLogCollector creates a new log collector
func NewLogCollector(cfg config.LogCollectorConfig, log *logger.Logger) (*LogCollector, error) {
	if !cfg.Enabled {
		return nil, fmt.Errorf("log collector is disabled")
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("failed to create file watcher: %w", err)
	}

	collector := &LogCollector{
		name:    "log-collector",
		config:  cfg,
		logger:  log,
		watcher: watcher,
		files:   make(map[string]*logFile),
		healthy: true,
	}

	// Compile error detection patterns
	for _, pattern := range cfg.Patterns {
		regex, err := regexp.Compile(pattern.Pattern)
		if err != nil {
			log.Warn("Invalid pattern", "pattern", pattern.Name, "regex", pattern.Pattern, "error", err)
			continue
		}
		collector.patterns = append(collector.patterns, regex)
	}

	return collector, nil
}

// Name returns the collector name
func (lc *LogCollector) Name() string {
	return lc.name
}

// Start starts the log collector
func (lc *LogCollector) Start(ctx context.Context, dataChan chan<- interface{}) error {
	lc.ctx, lc.cancel = context.WithCancel(ctx)
	lc.dataChan = dataChan
	
	lc.logger.Info("Starting log collector")

	// Discover and watch log files
	if err := lc.discoverLogFiles(); err != nil {
		return fmt.Errorf("failed to discover log files: %w", err)
	}

	// Start file watcher
	lc.wg.Add(2)
	go lc.watchFiles()
	go lc.processEvents()

	lc.logger.Info("Log collector started", "files", len(lc.files))
	return nil
}

// Stop stops the log collector
func (lc *LogCollector) Stop(ctx context.Context) error {
	lc.logger.Info("Stopping log collector")
	
	if lc.cancel != nil {
		lc.cancel()
	}
	
	if lc.watcher != nil {
		lc.watcher.Close()
	}
	
	// Close all files
	lc.filesMu.Lock()
	for _, file := range lc.files {
		if file.file != nil {
			file.file.Close()
		}
	}
	lc.filesMu.Unlock()

	// Wait for goroutines to finish
	done := make(chan struct{})
	go func() {
		lc.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		lc.logger.Info("Log collector stopped")
		return nil
	case <-ctx.Done():
		lc.logger.Warn("Log collector stop timeout")
		return ctx.Err()
	}
}

// Health returns the collector health status
func (lc *LogCollector) Health() HealthStatus {
	lc.filesMu.RLock()
	fileCount := len(lc.files)
	lc.filesMu.RUnlock()

	status := HealthStatus{
		Healthy:   lc.healthy,
		Message:   "Log collector operational",
		Timestamp: time.Now().Format(time.RFC3339),
		Details: map[string]string{
			"files_watched": fmt.Sprintf("%d", fileCount),
		},
	}

	if lc.lastError != "" {
		status.Message = lc.lastError
		status.Healthy = false
	}

	return status
}

// discoverLogFiles discovers log files based on configuration
func (lc *LogCollector) discoverLogFiles() error {
	for _, pathConfig := range lc.config.Paths {
		if err := lc.addLogPath(pathConfig); err != nil {
			lc.logger.Error("Failed to add log path", "path", pathConfig.Path, "error", err)
			continue
		}
	}
	return nil
}

// addLogPath adds a log path for monitoring
func (lc *LogCollector) addLogPath(pathConfig config.LogPathConfig) error {
	// Handle glob patterns
	matches, err := filepath.Glob(pathConfig.Path)
	if err != nil {
		return fmt.Errorf("invalid glob pattern %s: %w", pathConfig.Path, err)
	}

	for _, match := range matches {
		// Skip if already watching
		lc.filesMu.RLock()
		_, exists := lc.files[match]
		lc.filesMu.RUnlock()
		if exists {
			continue
		}

		// Check if it's a file and readable
		info, err := os.Stat(match)
		if err != nil {
			lc.logger.Debug("Cannot stat file", "path", match, "error", err)
			continue
		}

		if info.IsDir() {
			if pathConfig.Recursive {
				if err := lc.addRecursivePath(match, pathConfig, 0); err != nil {
					lc.logger.Error("Failed to add recursive path", "path", match, "error", err)
				}
			}
			continue
		}

		// Add file for monitoring
		if err := lc.addLogFile(match, pathConfig); err != nil {
			lc.logger.Error("Failed to add log file", "path", match, "error", err)
			continue
		}
	}

	return nil
}

// addRecursivePath recursively adds files from a directory
func (lc *LogCollector) addRecursivePath(dir string, pathConfig config.LogPathConfig, depth int) error {
	if pathConfig.MaxDepth > 0 && depth >= pathConfig.MaxDepth {
		return nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		fullPath := filepath.Join(dir, entry.Name())
		
		if entry.IsDir() {
			if pathConfig.Recursive {
				lc.addRecursivePath(fullPath, pathConfig, depth+1)
			}
			continue
		}

		// Check if file matches pattern
		if strings.HasSuffix(entry.Name(), ".log") {
			lc.addLogFile(fullPath, pathConfig)
		}
	}

	return nil
}

// addLogFile adds a specific log file for monitoring
func (lc *LogCollector) addLogFile(path string, pathConfig config.LogPathConfig) error {
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("cannot open file %s: %w", path, err)
	}

	// Check if we should read from beginning or end
	// If position file exists, seek to saved position
	// Otherwise, seek to beginning for initial sync
	dataDir := "/var/lib/pulse-hive"
	os.MkdirAll(dataDir, 0755)
	positionFile := filepath.Join(dataDir, fmt.Sprintf(".%s.pos", strings.ReplaceAll(filepath.Base(path), "/", "_")))
	
	if posData, err := os.ReadFile(positionFile); err == nil {
		// Resume from saved position
		if pos, err := strconv.ParseInt(strings.TrimSpace(string(posData)), 10, 64); err == nil {
			if _, err := file.Seek(pos, 0); err != nil {
				lc.logger.Warn("Failed to seek to saved position, starting from end", "path", path, "position", pos)
				file.Seek(0, 2) // Fallback to end
			} else {
				lc.logger.Info("Resuming from saved position", "path", path, "position", pos)
			}
		}
	} else {
		// First time reading this file - skip historical data for production deployment
		if stat, err := file.Stat(); err == nil {
			fileSize := stat.Size()
			if fileSize > 100*1024*1024 { // > 100MB
				// Large file: seek to end to skip historical data
				lc.logger.Info("Large file detected, skipping historical data", "path", path, "size_mb", fileSize/(1024*1024))
				file.Seek(0, 2) // Seek to end
			} else {
				// Small file: read from beginning
				lc.logger.Info("Small file, reading from beginning", "path", path, "size_mb", fileSize/(1024*1024))
				file.Seek(0, 0)
			}
		} else {
			// Can't get file size, default to end for safety
			lc.logger.Info("Cannot determine file size, seeking to end", "path", path)
			file.Seek(0, 2)
		}
	}

	logFile := &logFile{
		path:    path,
		file:    file,
		scanner: bufio.NewScanner(file),
		parser:  pathConfig.Parser,
		tags:    pathConfig.Tags,
		fields:  pathConfig.Fields,
	}

	// Store file
	lc.filesMu.Lock()
	lc.files[path] = logFile
	lc.filesMu.Unlock()

	// Watch for changes
	if err := lc.watcher.Add(path); err != nil {
		lc.logger.Warn("Failed to watch file", "path", path, "error", err)
	}

	lc.logger.Debug("Added log file", "path", path, "parser", pathConfig.Parser)
	return nil
}

// watchFiles monitors file changes
func (lc *LogCollector) watchFiles() {
	defer lc.wg.Done()

	ticker := time.NewTicker(lc.config.ScanFreq)
	defer ticker.Stop()

	for {
		select {
		case <-lc.ctx.Done():
			return
		case <-ticker.C:
			lc.scanAllFiles()
		}
	}
}

// scanAllFiles scans all monitored files for new content
func (lc *LogCollector) scanAllFiles() {
	lc.filesMu.RLock()
	files := make([]*logFile, 0, len(lc.files))
	for _, file := range lc.files {
		files = append(files, file)
	}
	lc.filesMu.RUnlock()

	for _, file := range files {
		lc.scanFile(file)
	}
}

// scanFile scans a single file for new content using byte-level reading
func (lc *LogCollector) scanFile(logFile *logFile) {
	// Check if file still exists
	if _, err := os.Stat(logFile.path); err != nil {
		lc.logger.Debug("File no longer exists", "path", logFile.path)
		lc.removeLogFile(logFile.path)
		return
	}

	// Get current file size to check for growth
	fileInfo, err := logFile.file.Stat()
	if err != nil {
		lc.logger.Error("Failed to get file info", "path", logFile.path, "error", err)
		return
	}
	currentFileSize := fileInfo.Size()

	// Get current position
	currentPos, err := logFile.file.Seek(0, 1)
	if err != nil {
		lc.logger.Error("Failed to get file position", "path", logFile.path, "error", err)
		return
	}

	// Use tracked position if it's more accurate
	if logFile.position > currentPos {
		currentPos = logFile.position
	}

	// Check if file has grown since last scan
	if currentPos >= currentFileSize {
		lc.logger.Debug("No file growth detected", "path", logFile.path, "pos", currentPos, "size", currentFileSize)
		return
	}

	// Seek to our tracked position
	if _, err := logFile.file.Seek(logFile.position, 0); err != nil {
		lc.logger.Error("Failed to seek to position", "path", logFile.path, "position", logFile.position, "error", err)
		return
	}

	lc.logger.Debug("Scanning file", "path", logFile.path, "start_pos", logFile.position, "file_size", currentFileSize)

	// Read new data using byte-level reading with manual line parsing
	linesRead := 0
	startTime := time.Now()
	maxLinesPerBatch := 1000
	
	// Read data in chunks
	buffer := make([]byte, 8192) // 8KB buffer
	var lineBuffer []byte
	
	for linesRead < maxLinesPerBatch {
		// Read a chunk from the file
		n, err := logFile.file.Read(buffer)
		if n == 0 {
			if err != nil && err != io.EOF {
				lc.logger.Error("Error reading file", "path", logFile.path, "error", err)
			}
			break // No more data to read
		}

		// Process the chunk byte by byte to find complete lines
		for i := 0; i < n; i++ {
			b := buffer[i]
			
			if b == '\n' {
				// Found a complete line
				if len(lineBuffer) > 0 {
					line := string(lineBuffer)
					lineBuffer = lineBuffer[:0] // Reset buffer
					
					// Process the line
					if line != "" {
						lc.processLogLine(line, logFile)
						linesRead++
						
						if linesRead >= maxLinesPerBatch {
							break
						}
					}
				}
				
				// Update position after processing the newline
				logFile.position, _ = logFile.file.Seek(0, 1)
			} else if b != '\r' { // Skip carriage returns
				// Add byte to line buffer
				lineBuffer = append(lineBuffer, b)
			}
		}
		
		// Update position after reading chunk
		logFile.position, _ = logFile.file.Seek(0, 1)
		
		// Rate limiting check
		if linesRead > 0 && linesRead%100 == 0 {
			elapsed := time.Since(startTime)
			expectedTime := time.Duration(linesRead) * time.Microsecond * 100
			if elapsed < expectedTime {
				time.Sleep(expectedTime - elapsed)
			}
		}
	}
	
	// Process any remaining partial line (without newline at EOF)
	if len(lineBuffer) > 0 {
		// Check if we're at EOF - if so, this might be a complete line without trailing newline
		currentPos, _ := logFile.file.Seek(0, 1)
		if currentPos >= currentFileSize {
			line := string(lineBuffer)
			if line != "" {
				lc.processLogLine(line, logFile)
				linesRead++
			}
		}
		// If not at EOF, we'll pick up this partial line on the next scan
	}
	
	if linesRead > 0 {
		lc.logger.Debug("Processed log batch", "file", logFile.path, "lines", linesRead, "start_pos", currentPos, "end_pos", logFile.position, "duration", time.Since(startTime))
		
		// Save position to file
		dataDir := "/var/lib/pulse-hive"
		positionFile := filepath.Join(dataDir, fmt.Sprintf(".%s.pos", strings.ReplaceAll(filepath.Base(logFile.path), "/", "_")))
		if err := os.WriteFile(positionFile, []byte(fmt.Sprintf("%d", logFile.position)), 0644); err != nil {
			lc.logger.Warn("Failed to save position", "file", logFile.path, "position", logFile.position, "error", err)
		} else {
			lc.logger.Debug("Saved position", "file", logFile.path, "position", logFile.position)
		}
	} else {
		lc.logger.Debug("No new lines found", "file", logFile.path, "pos", logFile.position, "file_size", currentFileSize)
	}
}

// processLogLine processes a single log line and sends it to the data channel
func (lc *LogCollector) processLogLine(line string, logFile *logFile) {
	// Parse and send log data
	logData := lc.parseLogLine(line, logFile)
	if logData == nil {
		return
	}

	// Check for issues/patterns
	lc.checkForIssues(line, logFile, logData)

	// Send to data channel with backpressure detection - flatten for OpenObserve
	flattenedData := map[string]interface{}{
		"message":   logData.Message,
		"timestamp": logData.Timestamp,
		"source":    logData.Source,
		"level":     "info", // Default level
	}
	
	// Add all fields directly to root for OpenObserve JSON format
	for k, v := range logData.Fields {
		flattenedData[k] = v
	}
	
	// Add tags as fields
	for k, v := range logFile.tags {
		flattenedData[k] = v
	}
	
	select {
	case lc.dataChan <- CollectedData{
		Type:      DataTypeLog,
		Source:    logFile.path,
		Data:      flattenedData, // Send flattened JSON structure
		Tags:      logFile.tags,
		Timestamp: logData.Timestamp,
	}:
		// Successfully sent
	case <-lc.ctx.Done():
		return
	case <-time.After(100 * time.Millisecond):
		// Backpressure detected - pipeline is full
		lc.logger.Debug("Backpressure detected, pausing log collection", 
			"file", logFile.path)
		time.Sleep(500 * time.Millisecond) // Wait before continuing
		// Try to send again
		select {
		case lc.dataChan <- CollectedData{
			Type:      DataTypeLog,
			Source:    logFile.path,
			Data:      flattenedData, // Use same flattened data structure
			Tags:      logFile.tags,
			Timestamp: logData.Timestamp,
		}:
		case <-lc.ctx.Done():
			return
		default:
			// Still blocked, skip this line
			lc.logger.Warn("Skipping log line due to persistent backpressure", 
				"file", logFile.path)
		}
	}
}

// parseLogLine parses a log line based on the configured parser
func (lc *LogCollector) parseLogLine(line string, file *logFile) *LogData {
	logData := &LogData{
		Message:   line,
		Timestamp: time.Now().Format(time.RFC3339),
		Source:    file.path,
		Tags:      file.tags,
		Fields:    make(map[string]interface{}),
	}

	// Copy configured fields
	for k, v := range file.fields {
		logData.Fields[k] = v
	}

	// Apply parser if configured
	if parser, exists := lc.config.Parsers[file.parser]; exists {
		lc.applyParser(logData, line, parser)
	}

	return logData
}

// applyParser applies the configured parser to extract fields
func (lc *LogCollector) applyParser(logData *LogData, line string, parser config.ParserConfig) {
	switch parser.Type {
	case "regex":
		if regex, err := regexp.Compile(parser.Pattern); err == nil {
			matches := regex.FindStringSubmatch(line)
			if len(matches) > 1 {
				names := regex.SubexpNames()
				for i, match := range matches[1:] {
					if i+1 < len(names) && names[i+1] != "" {
						logData.Fields[names[i+1]] = match
					}
				}
			}
		}
	case "json":
		// JSON parsing would be implemented here
	case "grok":
		// Grok pattern parsing would be implemented here
	}
}

// checkForIssues checks log lines against configured patterns to detect issues
func (lc *LogCollector) checkForIssues(line string, file *logFile, logData *LogData) {
	for i, pattern := range lc.patterns {
		if pattern.MatchString(line) {
			patternConfig := lc.config.Patterns[i]
			
			// Create issue data
			issue := &IssueData{
				ID:          fmt.Sprintf("pattern-%s-%d", patternConfig.Name, time.Now().Unix()),
				Severity:    patternConfig.Severity,
				Category:    patternConfig.Category,
				Title:       fmt.Sprintf("Pattern detected: %s", patternConfig.Name),
				Description: patternConfig.Description,
				Pattern:     patternConfig.Pattern,
				Context: map[string]interface{}{
					"line":        line,
					"file":        file.path,
					"log_fields":  logData.Fields,
				},
				SuggestedFix: patternConfig.AutoFix,
				AutoFixable:  patternConfig.AutoFix != "",
				Source:       file.path,
				Timestamp:    time.Now().Format(time.RFC3339),
			}

			// Send issue to data channel
			select {
			case lc.dataChan <- CollectedData{
				Type:      DataTypeEvent,
				Source:    file.path,
				Data:      map[string]interface{}{"issue": issue},
				Tags:      file.tags,
				Timestamp: time.Now().Format(time.RFC3339),
			}:
			case <-lc.ctx.Done():
				return
			}

			lc.logger.Warn("Issue detected",
				"pattern", patternConfig.Name,
				"severity", patternConfig.Severity,
				"file", file.path,
				"line", line,
			)
		}
	}
}

// processEvents processes file system events
func (lc *LogCollector) processEvents() {
	defer lc.wg.Done()

	for {
		select {
		case <-lc.ctx.Done():
			return
		case event, ok := <-lc.watcher.Events:
			if !ok {
				return
			}
			lc.handleFileEvent(event)
		case err, ok := <-lc.watcher.Errors:
			if !ok {
				return
			}
			lc.logger.Error("File watcher error", "error", err)
		}
	}
}

// handleFileEvent handles file system events
func (lc *LogCollector) handleFileEvent(event fsnotify.Event) {
	lc.logger.Debug("File event", "event", event.Op.String(), "path", event.Name)

	switch {
	case event.Op&fsnotify.Remove == fsnotify.Remove:
		lc.removeLogFile(event.Name)
	case event.Op&fsnotify.Rename == fsnotify.Rename:
		lc.removeLogFile(event.Name)
	case event.Op&fsnotify.Create == fsnotify.Create:
		// Handle log rotation - new file created
		time.Sleep(lc.config.RotateWait) // Wait for rotation to complete
		for _, pathConfig := range lc.config.Paths {
			if matched, _ := filepath.Match(pathConfig.Path, event.Name); matched {
				lc.addLogFile(event.Name, pathConfig)
				break
			}
		}
	}
}

// removeLogFile removes a log file from monitoring
func (lc *LogCollector) removeLogFile(path string) {
	lc.filesMu.Lock()
	defer lc.filesMu.Unlock()

	if file, exists := lc.files[path]; exists {
		if file.file != nil {
			file.file.Close()
		}
		delete(lc.files, path)
		lc.logger.Debug("Removed log file", "path", path)
	}
}