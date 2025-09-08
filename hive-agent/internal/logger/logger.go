package logger

import (
	"fmt"
	"io"
	"os"
	"strings"

	"hive-agent/internal/config"
	"github.com/sirupsen/logrus"
)

// Logger wraps logrus with structured logging
type Logger struct {
	*logrus.Logger
	fields logrus.Fields
}

// New creates a new logger instance
func New(cfg config.LoggingConfig) (*Logger, error) {
	log := logrus.New()

	// Set log level
	level, err := logrus.ParseLevel(cfg.Level)
	if err != nil {
		return nil, fmt.Errorf("invalid log level %s: %w", cfg.Level, err)
	}
	log.SetLevel(level)

	// Set formatter
	switch strings.ToLower(cfg.Format) {
	case "json":
		log.SetFormatter(&logrus.JSONFormatter{
			TimestampFormat: "2006-01-02T15:04:05.000Z07:00",
			FieldMap: logrus.FieldMap{
				logrus.FieldKeyTime:  "timestamp",
				logrus.FieldKeyLevel: "level",
				logrus.FieldKeyMsg:   "message",
				logrus.FieldKeyFunc:  "caller",
			},
		})
	case "text":
		log.SetFormatter(&logrus.TextFormatter{
			TimestampFormat: "2006-01-02T15:04:05.000Z07:00",
			FullTimestamp:   true,
		})
	default:
		return nil, fmt.Errorf("unsupported log format: %s", cfg.Format)
	}

	// Set output
	switch strings.ToLower(cfg.Output) {
	case "stdout":
		log.SetOutput(os.Stdout)
	case "file":
		if cfg.File == "" {
			return nil, fmt.Errorf("log file path is required when output is 'file'")
		}
		
		// Create directory if it doesn't exist
		dir := strings.TrimSuffix(cfg.File, "/"+strings.Split(cfg.File, "/")[len(strings.Split(cfg.File, "/"))-1])
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create log directory %s: %w", dir, err)
		}

		file, err := os.OpenFile(cfg.File, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			return nil, fmt.Errorf("failed to open log file %s: %w", cfg.File, err)
		}
		log.SetOutput(file)
	default:
		return nil, fmt.Errorf("unsupported log output: %s", cfg.Output)
	}

	return &Logger{
		Logger: log,
		fields: logrus.Fields{},
	}, nil
}

// WithField adds a field to the logger context
func (l *Logger) WithField(key string, value interface{}) *Logger {
	fields := logrus.Fields{}
	for k, v := range l.fields {
		fields[k] = v
	}
	fields[key] = value

	return &Logger{
		Logger: l.Logger,
		fields: fields,
	}
}

// WithFields adds multiple fields to the logger context
func (l *Logger) WithFields(fields logrus.Fields) *Logger {
	newFields := logrus.Fields{}
	for k, v := range l.fields {
		newFields[k] = v
	}
	for k, v := range fields {
		newFields[k] = v
	}

	return &Logger{
		Logger: l.Logger,
		fields: newFields,
	}
}

// WithError adds an error field to the logger context
func (l *Logger) WithError(err error) *Logger {
	return l.WithField("error", err.Error())
}

// Debug logs a debug message with optional key-value pairs
func (l *Logger) Debug(msg string, kvs ...interface{}) {
	entry := l.Logger.WithFields(l.fields)
	if len(kvs) > 0 {
		entry = entry.WithFields(parseKVs(kvs...))
	}
	entry.Debug(msg)
}

// Info logs an info message with optional key-value pairs
func (l *Logger) Info(msg string, kvs ...interface{}) {
	entry := l.Logger.WithFields(l.fields)
	if len(kvs) > 0 {
		entry = entry.WithFields(parseKVs(kvs...))
	}
	entry.Info(msg)
}

// Warn logs a warning message with optional key-value pairs
func (l *Logger) Warn(msg string, kvs ...interface{}) {
	entry := l.Logger.WithFields(l.fields)
	if len(kvs) > 0 {
		entry = entry.WithFields(parseKVs(kvs...))
	}
	entry.Warn(msg)
}

// Error logs an error message with optional key-value pairs
func (l *Logger) Error(msg string, kvs ...interface{}) {
	entry := l.Logger.WithFields(l.fields)
	if len(kvs) > 0 {
		entry = entry.WithFields(parseKVs(kvs...))
	}
	entry.Error(msg)
}

// Fatal logs a fatal message with optional key-value pairs and exits
func (l *Logger) Fatal(msg string, kvs ...interface{}) {
	entry := l.Logger.WithFields(l.fields)
	if len(kvs) > 0 {
		entry = entry.WithFields(parseKVs(kvs...))
	}
	entry.Fatal(msg)
}

// Panic logs a panic message with optional key-value pairs and panics
func (l *Logger) Panic(msg string, kvs ...interface{}) {
	entry := l.Logger.WithFields(l.fields)
	if len(kvs) > 0 {
		entry = entry.WithFields(parseKVs(kvs...))
	}
	entry.Panic(msg)
}

// SetOutput sets the output destination for the logger
func (l *Logger) SetOutput(output io.Writer) {
	l.Logger.SetOutput(output)
}

// parseKVs parses key-value pairs into logrus.Fields
func parseKVs(kvs ...interface{}) logrus.Fields {
	fields := logrus.Fields{}
	
	for i := 0; i < len(kvs); i += 2 {
		if i+1 < len(kvs) {
			key, ok := kvs[i].(string)
			if ok {
				fields[key] = kvs[i+1]
			}
		}
	}
	
	return fields
}

// Component creates a logger for a specific component
func (l *Logger) Component(name string) *Logger {
	return l.WithField("component", name)
}

// Subsystem creates a logger for a specific subsystem
func (l *Logger) Subsystem(name string) *Logger {
	return l.WithField("subsystem", name)
}