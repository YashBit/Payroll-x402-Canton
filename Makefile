.PHONY: build test clean sandbox upload

build:
	@echo "Building Daml templates..."
	daml build

test:
	@echo "Running tests..."
	daml test

sandbox:
	@echo "Starting Daml Sandbox..."
	daml sandbox

clean:
	@echo "Cleaning build artifacts..."
	rm -rf .daml/dist

upload:
	@echo "Uploading to Canton (make sure Canton is running)..."
	daml ledger upload-dar --host localhost --port 2901 .daml/dist/payroll-poc-1.0.0.dar

help:
	@echo "Available commands:"
	@echo "  make build    - Build Daml templates"
	@echo "  make test     - Run Daml tests"
	@echo "  make sandbox  - Start local Daml sandbox"
	@echo "  make upload   - Upload DAR to Canton (requires Canton running)"
	@echo "  make clean    - Clean build artifacts"
