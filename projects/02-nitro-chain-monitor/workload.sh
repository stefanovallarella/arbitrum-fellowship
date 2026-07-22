#!/usr/bin/env bash
# Generates load on the local Nitro testnode L2 by sending a burst of L2-to-L2
# transfers via the testnode's own `script send-l2` helper (nitro-testnode/scripts).
#
# Usage: TESTNODE_DIR=/path/to/nitro-testnode ./workload.sh [times] [threads]
set -euo pipefail

TESTNODE_DIR="${TESTNODE_DIR:?Set TESTNODE_DIR to your local nitro-testnode clone}"
TIMES="${1:-200}"
THREADS="${2:-5}"

echo "workload-start $(date -u +%Y-%m-%dT%H:%M:%SZ) times=$TIMES threads=$THREADS"

(
  cd "$TESTNODE_DIR"
  ./test-node.bash script send-l2 \
    --from funnel --to funnel --ethamount 0.0001 \
    --times "$TIMES" --threads "$THREADS"
)

echo "workload-end $(date -u +%Y-%m-%dT%H:%M:%SZ)"
