# 02 - Nitro Chain Monitor

A monitor that polls Arbitrum precompiles (`ArbSys`, `ArbGasInfo`) and standard JSON-RPC against a local [Nitro testnode](https://github.com/OffchainLabs/nitro-testnode), while a workload script generates a burst of L2 transactions, to observe how L1/L2 block numbers, gas price, L1 base fee estimate, and block fill behave before, during, and after load.

> Looking for a narrated, concept-by-concept walkthrough of an actual live session (what each Docker init phase does, why the L2 block number stayed flat then reacted, why it kept climbing after the workload script exited) instead of just the reference commands below? See [`WALKTHROUGH.md`](./WALKTHROUGH.md).

## What's here

```
02-nitro-chain-monitor/
├── monitor/                # Node/TypeScript monitor (viem)
│   ├── src/monitor.ts
│   ├── package.json
│   └── tsconfig.json
├── workload.sh              # Wrapper around nitro-testnode's `script send-l2` load generator
├── output/                  # Captured run artifacts (metrics.ndjson, logs)
└── README.md
```

The Nitro testnode itself (`OffchainLabs/nitro-testnode`) is **not vendored in this repo** — it's a large upstream project meant to be cloned separately (same reasoning as any other external dev-dependency, and what the exercise brief itself points to). Clone it next to this project (or anywhere) and point `TESTNODE_DIR` at it.

## Prerequisites

- Docker + Docker Compose (for the testnode itself)
- Node.js >= 20 (for the monitor)
- bash (Git Bash on Windows works; the testnode's own scripts are bash)

## Setup

1. Clone the testnode:

   ```bash
   git clone -b release --recurse-submodules https://github.com/OffchainLabs/nitro-testnode.git
   cd nitro-testnode
   ./test-node.bash --init
   ```

   This builds/pulls the Nitro Docker images, deploys the L2 rollup contracts on a local L1 (geth, `:8545`), and starts the Sequencer (`:8547` HTTP / `:8548` WS).

   > **Windows/Git Bash gotcha**: MSYS auto-converts Unix-looking absolute paths (like `/config/geth_genesis.json`) into Windows paths before they reach Docker, which breaks the testnode's internal volume mounts (`Fatal: Failed to read genesis file: open C:/Program Files/Git/config/geth_genesis.json...`). Fix: `export MSYS_NO_PATHCONV=1` and `export MSYS2_ARG_CONV_EXCL="*"` before running `test-node.bash`.

2. Install the monitor's dependencies:

   ```bash
   cd monitor
   npm install
   ```

## Running the monitor

```bash
cd monitor
INTERVAL_MS=2000 DURATION_MS=100000 npx tsx src/monitor.ts
```

Env vars (all optional): `L1_RPC` (default `http://127.0.0.1:8545`), `L2_RPC` (default `http://127.0.0.1:8547`), `INTERVAL_MS` (poll interval, default 3000), `DURATION_MS` (total run time, default 90000), `OUT_FILE` (NDJSON output path, default `../output/metrics.ndjson`).

Each poll reads, via `eth_call` against the L2 node:
- `ArbSys.arbBlockNumber()` (selector `0xa3b1b31d`) — current L2 block number
- `ArbGasInfo.getL1BaseFeeEstimate()` (selector `0xf5d6ded7`) — estimated L1 posting cost
- `ArbGasInfo.getMinimumGasPrice()` (selector `0xf918379a`) — L2 gas price floor

## Viewing results in the browser

The terminal output is NDJSON (one metrics snapshot per line), not something you'd want to eyeball directly. `src/report.ts` turns a captured run into a single self-contained static HTML page (sparkline SVGs + a full data table) — no server needed, no live RPC connection, just open the file:

```bash
cd monitor
npx tsx src/report.ts ../output/metrics.ndjson ../output/report.html
```

Then open `output/report.html` directly in any browser (double-click it, or `start output/report.html` on Windows). [`output/report.html`](./output/report.html) in this repo is the report generated from the captured run described below.

...plus standard RPC: `eth_blockNumber` on the L1 node, and `gasUsed`/`gasLimit` from the latest L2 block (block fill %).

## Generating load

`workload.sh` wraps the testnode's own `script send-l2` helper (`nitro-testnode/scripts`), which is the "provided workload script" the exercise brief refers to:

```bash
export TESTNODE_DIR=/path/to/nitro-testnode
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"   # Windows/Git Bash only
./workload.sh <times> <threads>
```

**Important gotcha found while running this**: `send-l2` defaults `--from funnel --to funnel` for every thread. Running with `--threads > 1` on the *same* account races on the nonce (`NONCE_EXPIRED` / "nonce too low") because each thread submits concurrently against the same account's nonce counter. Two ways around it:
- `--threads 1` with a high `--times` (sequential, safe, but capped at whatever a single account's round-trip latency allows — measured ~5 tx/s this way).
- Fund N independent per-thread accounts first with `--serial`, then fire real concurrent load against them:

  ```bash
  # Fund 6 independent thread-local accounts (serial, from the shared funnel account)
  ./test-node.bash script send-l2 --from funnel --to threaduser_load --threads 6 --times 1 --serial --wait --ethamount 1

  # Real concurrent burst: 6 threads x 500 self-transfers each, independent nonces
  ./test-node.bash script send-l2 --from threaduser_load --to threaduser_load --threads 6 --times 500 --ethamount 0.0001
  ```

  This submitted **3,000 transactions in ~2 seconds** (fire-and-forget, not waiting for individual confirmations).

## What we actually observed

Full run captured in [`output/metrics.ndjson`](./output/metrics.ndjson) / [`output/monitor-run.log`](./output/monitor-run.log) (100s run, 2s polling interval, ~15s idle baseline before firing the 3,000-tx burst at `elapsed ≈ 15s`):

| Phase | L1 block | L2 block | L1 base fee est. | L2 min gas price | L2 block fill |
|---|---|---|---|---|---|
| Baseline (0-14s) | 595 → 607 | 1333 → 1390 | 0.000000029 gwei | 0.1 gwei | 0.00% |
| During burst (~16-40s) | 611 → 631 | 1399 → 1479 | 0.000000029 gwei | 0.1 gwei | 0.00% |
| After (40-100s) | 631 → ... | 1479 → ... | 0.000000029 gwei | 0.1 gwei | 0.00% |

A second, later run ([`output/metrics-live-demo.ndjson`](./output/metrics-live-demo.ndjson) / [`output/report-live-demo.html`](./output/report-live-demo.html)) shows the idle→load contrast even more clearly, because this time the L2 block number was genuinely frozen (not just flat-ish) before any load: `l2Block` sat at exactly `9` for the first ~21 seconds, then started climbing the moment a 300-tx burst was fired, ending at `470` while `l1Block`, gas price, and fill stayed just as flat as in the first run. See [`WALKTHROUGH.md`](./WALKTHROUGH.md) for the full narrated diagnosis, including tracing the block's actual transactions (an ArbOS-internal tx + one real transaction from our burst per block) to explain why the L2 block number kept climbing for almost a minute after the workload command had already returned.

**The honest, slightly surprising finding**: on this local dev testnode, **none of the gas-related metrics moved at all**, even though the burst really did land (3,000 txs confirmed within ~2s, verified via the workload script's own output). What *didn't* change:

- **L2 gas price stayed pinned at the floor** (`getMinimumGasPrice()` = 0.1 gwei throughout) — the testnode runs in dev mode without the resource-pricing / speed-limit mechanism that would push price above the floor on Arbitrum One under real congestion (see [Module 2.4](../../docs/block-2-nitro-stack/module-2.4-building-on-arbitrum-evm.md) for the two-dimensional fee formula this floor feeds into).
- **L1 base fee estimate stayed constant** — the local L1 (geth --dev) doesn't have real fee-market activity driving `getL1BaseFeeEstimate()` up.
- **L2 block fill stayed at 0.00%** — the sequencer here produces a new L2 block roughly every **250ms on a fixed timer** (~4 blocks/sec, measured identically before, during, and after the burst), rather than batching pending transactions until a block fills up. Each simple transfer only uses 21,000 gas against a block gas limit in the tens of millions, so even absorbing 3,000 txs across ~750 blocks (3000 tx / 4 blocks-per-sec / ~2s ≈ a handful of txs per block) never approaches visible fill.

**What *did* change, and is the real signal of load here**: the L2 block number's relationship to wall-clock time didn't change (still ~4 blocks/sec) — the load got absorbed by the existing block cadence rather than by the cadence speeding up or gas getting more expensive. That's the opposite of what you'd see on Arbitrum One, where the Sequencer batches by size-or-time threshold ([Module 2.1](../../docs/block-2-nitro-stack/module-2.1-nitro-architecture.md)) and the gas price floor is designed to rise under sustained congestion. This dev testnode is deliberately configured for fast, predictable local iteration (fixed block timer, no congestion pricing) rather than to model mainnet fee dynamics — which is itself a useful thing to have confirmed empirically rather than assumed from the docs alone.

## Bonus not attempted

- Arbitrum Sepolia comparison and `NodeInterface.gasEstimateL1Component()` breakdown are left for a follow-up — would need a funded Sepolia key and are the natural next step to see the *opposite* of what was observed here (a shared, rate-limited public RPC with real congestion pricing).
