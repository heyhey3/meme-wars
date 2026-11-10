# Convenience targets. The README has the long-form commands.
SHELL := /bin/bash

# On macOS without the Xcode license accepted, invoke make with
#   DEVELOPER_DIR=/Library/Developer/CommandLineTools make <target>
# (the local make binary itself may otherwise ask for the Xcode license).
# The SDK_ENV below also sets it for recipes when make itself runs.
SDK_ENV := $(shell [ "$$(uname)" = "Darwin" ] && echo "DEVELOPER_DIR=/Library/Developer/CommandLineTools")

.PHONY: contract-test frontend-build sim verify secrets check clean

contract-test:
	cd contracts/meme-wars && $(SDK_ENV) cargo test

frontend-build:
	cd frontend && npm ci && npm run build

sim:
	python3 sim/simulate.py

verify:
	CONTRACT=$${CONTRACT:-war-demo.testnet} ./scripts/verify.sh

secrets:
	./scripts/check-secrets.sh

check: secrets contract-test frontend-build sim

clean:
	rm -rf contracts/meme-wars/target frontend/.next
