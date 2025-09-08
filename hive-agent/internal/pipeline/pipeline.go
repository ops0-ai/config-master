package pipeline

import (
	"context"
	"sync"
	"time"

	"hive-agent/internal/logger"
)

// Config contains pipeline configuration
type Config struct {
	BufferSize    int
	BatchSize     int
	FlushInterval time.Duration
	CompressData  bool
}

// Pipeline processes and batches data
type Pipeline struct {
	config Config
	logger *logger.Logger
	
	// Data processing
	buffer    []interface{}
	bufferMu  sync.Mutex
	outputCh  chan []interface{}
	
	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// New creates a new pipeline
func New(cfg Config, log *logger.Logger) *Pipeline {
	return &Pipeline{
		config:   cfg,
		logger:   log,
		buffer:   make([]interface{}, 0, cfg.BufferSize),
		outputCh: make(chan []interface{}, 1000), // Increased from 10 to 1000
	}
}

// Start starts the pipeline
func (p *Pipeline) Start(ctx context.Context, dataChan <-chan interface{}) error {
	p.ctx, p.cancel = context.WithCancel(ctx)
	
	p.logger.Info("Starting pipeline",
		"buffer_size", p.config.BufferSize,
		"batch_size", p.config.BatchSize,
		"flush_interval", p.config.FlushInterval,
	)

	// Start data processor
	p.wg.Add(2)
	go p.processData(dataChan)
	go p.flushTimer()

	return nil
}

// Stop stops the pipeline
func (p *Pipeline) Stop(ctx context.Context) error {
	p.logger.Info("Stopping pipeline")
	
	if p.cancel != nil {
		p.cancel()
	}

	// Flush remaining data
	p.flush()

	// Wait for goroutines
	done := make(chan struct{})
	go func() {
		p.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		p.logger.Info("Pipeline stopped")
		return nil
	case <-ctx.Done():
		p.logger.Warn("Pipeline stop timeout")
		return ctx.Err()
	}
}

// GetOutput returns the output channel for batched data
func (p *Pipeline) GetOutput() <-chan []interface{} {
	return p.outputCh
}

// processData processes incoming data
func (p *Pipeline) processData(dataChan <-chan interface{}) {
	defer p.wg.Done()

	for {
		select {
		case <-p.ctx.Done():
			return
		case data, ok := <-dataChan:
			if !ok {
				return
			}
			
			p.addToBuffer(data)
		}
	}
}

// addToBuffer adds data to the buffer and flushes if needed
func (p *Pipeline) addToBuffer(data interface{}) {
	p.bufferMu.Lock()
	defer p.bufferMu.Unlock()

	p.buffer = append(p.buffer, data)

	// Flush if buffer is full
	if len(p.buffer) >= p.config.BatchSize {
		p.flushUnsafe()
	}
}

// flushTimer periodically flushes the buffer
func (p *Pipeline) flushTimer() {
	defer p.wg.Done()

	ticker := time.NewTicker(p.config.FlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-p.ctx.Done():
			return
		case <-ticker.C:
			p.flush()
		}
	}
}

// flush flushes the buffer (thread-safe)
func (p *Pipeline) flush() {
	p.bufferMu.Lock()
	defer p.bufferMu.Unlock()
	p.flushUnsafe()
}

// flushUnsafe flushes the buffer (must hold lock)
func (p *Pipeline) flushUnsafe() {
	if len(p.buffer) == 0 {
		return
	}

	// Create batch
	batch := make([]interface{}, len(p.buffer))
	copy(batch, p.buffer)
	
	// Clear buffer
	p.buffer = p.buffer[:0]

	// Send batch to output channel with timeout
	select {
	case p.outputCh <- batch:
		p.logger.Debug("Flushed batch", "size", len(batch))
	case <-p.ctx.Done():
		return
	case <-time.After(5 * time.Second):
		p.logger.Error("Output channel blocked for 5 seconds, dropping batch", "size", len(batch))
	}
}