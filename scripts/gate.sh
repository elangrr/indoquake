#!/usr/bin/env bash
# Indoquake gate. Unit gate by default; --int adds integration (Testcontainers), --e2e adds Playwright.
# Last line is always "GATE PASS" or "GATE FAIL <step>".
# GATE_INSTALL=ci (default) | install | skip
set -u
cd "$(dirname "$0")/.."
# Few build workers by default: every Next build worker starts its own thread pool, and small
# sandboxes cap the number of threads. Override with NEXT_BUILD_CPUS.
export NEXT_BUILD_CPUS="${NEXT_BUILD_CPUS:-4}"
export NEXT_TELEMETRY_DISABLED=1

RUN_UNIT=1
RUN_INT=0
RUN_E2E=0
for arg in "$@"; do
  case "$arg" in
    --int) RUN_INT=1; RUN_UNIT=0 ;;
    --e2e) RUN_E2E=1; RUN_UNIT=0 ;;
    --all) RUN_UNIT=1; RUN_INT=1; RUN_E2E=1 ;;
    *) echo "unknown argument: $arg"; echo "GATE FAIL args"; exit 64 ;;
  esac
done

step() {
  local name="$1"
  shift
  echo "== gate step: $name: $*"
  if ! "$@"; then
    echo "GATE FAIL $name"
    exit 1
  fi
}

if [ "$RUN_UNIT" = "1" ]; then
  case "${GATE_INSTALL:-ci}" in
    ci) step install npm ci --no-audit --no-fund ;;
    install) step install npm install --no-audit --no-fund ;;
    skip) echo "== gate step: install skipped (GATE_INSTALL=skip)" ;;
    *) echo "GATE FAIL install"; exit 1 ;;
  esac
  step contract node scripts/check-contract.mjs
  step typecheck npm run typecheck
  step lint npm run lint
  step test npm test
  step build npm run build
  step public-repo node scripts/check-public-repo.mjs
fi
if [ "$RUN_INT" = "1" ]; then
  step int npm run test:int
fi
if [ "$RUN_E2E" = "1" ]; then
  step e2e npm run test:e2e
fi
echo "GATE PASS"
