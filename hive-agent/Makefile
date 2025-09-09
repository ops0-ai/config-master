# Pulse Hive Agent Makefile

# Build variables
BINARY_NAME=pulse-hive-agent
VERSION?=1.0.0
BUILD_TIME?=$(shell date -u +%Y%m%d.%H%M%S)
GIT_COMMIT?=$(shell git rev-parse HEAD 2>/dev/null || echo "unknown")
LDFLAGS=-ldflags "-X main.version=${VERSION} -X main.buildTime=${BUILD_TIME} -X main.gitCommit=${GIT_COMMIT}"

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod

# Build targets
.PHONY: all build clean test deps help install uninstall

all: clean deps test build

help: ## Show this help message
	@echo 'Pulse Hive Agent Build System'
	@echo ''
	@echo 'Usage:'
	@echo '  make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

deps: ## Download dependencies
	$(GOMOD) download
	$(GOMOD) tidy

build: ## Build the binary
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME) .

build-all: ## Build for all platforms
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME)-linux-amd64 .
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME)-linux-arm64 .
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME)-darwin-amd64 .
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME)-darwin-arm64 .
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME)-windows-amd64.exe .

test: ## Run tests
	$(GOTEST) -v ./...

test-coverage: ## Run tests with coverage
	$(GOTEST) -v -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html

clean: ## Clean build artifacts
	$(GOCLEAN)
	rm -f $(BINARY_NAME)*
	rm -f coverage.out coverage.html

fmt: ## Format code
	$(GOCMD) fmt ./...

vet: ## Run go vet
	$(GOCMD) vet ./...

lint: ## Run linter
	golangci-lint run

install: build ## Install the binary
	sudo mkdir -p /usr/local/bin
	sudo mkdir -p /etc/pulse-hive
	sudo mkdir -p /var/lib/pulse-hive
	sudo mkdir -p /var/log/pulse-hive
	sudo cp $(BINARY_NAME) /usr/local/bin/
	sudo chmod +x /usr/local/bin/$(BINARY_NAME)
	sudo cp configs/config.yaml.template /etc/pulse-hive/config.yaml.template
	sudo cp scripts/pulse-hive-agent.service /etc/systemd/system/
	sudo systemctl daemon-reload
	@echo "Agent installed. Copy /etc/pulse-hive/config.yaml.template to /etc/pulse-hive/config.yaml and configure it."
	@echo "Then run: sudo systemctl enable pulse-hive-agent && sudo systemctl start pulse-hive-agent"

uninstall: ## Uninstall the binary
	sudo systemctl stop pulse-hive-agent || true
	sudo systemctl disable pulse-hive-agent || true
	sudo rm -f /usr/local/bin/$(BINARY_NAME)
	sudo rm -f /etc/systemd/system/pulse-hive-agent.service
	sudo systemctl daemon-reload
	@echo "Agent uninstalled. Configuration and data directories preserved."

docker-build: ## Build Docker image
	docker build -t pulse-hive-agent:$(VERSION) .

docker-run: ## Run Docker container
	docker run --rm -v $(PWD)/configs:/etc/pulse-hive pulse-hive-agent:$(VERSION)

dev: ## Run in development mode
	$(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME) .
	./$(BINARY_NAME) -config configs/config.yaml.template

# Release targets
release: clean deps test build-all ## Create release builds

package: release ## Create packages
	mkdir -p dist
	tar -czf dist/$(BINARY_NAME)-$(VERSION)-linux-amd64.tar.gz $(BINARY_NAME)-linux-amd64 configs/ scripts/
	tar -czf dist/$(BINARY_NAME)-$(VERSION)-linux-arm64.tar.gz $(BINARY_NAME)-linux-arm64 configs/ scripts/
	tar -czf dist/$(BINARY_NAME)-$(VERSION)-darwin-amd64.tar.gz $(BINARY_NAME)-darwin-amd64 configs/ scripts/
	tar -czf dist/$(BINARY_NAME)-$(VERSION)-darwin-arm64.tar.gz $(BINARY_NAME)-darwin-arm64 configs/ scripts/
	zip -r dist/$(BINARY_NAME)-$(VERSION)-windows-amd64.zip $(BINARY_NAME)-windows-amd64.exe configs/ scripts/