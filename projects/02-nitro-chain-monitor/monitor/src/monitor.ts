import { createPublicClient, http, formatGwei } from "viem";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Precompile addresses (same on every Arbitrum chain, including the testnode).
const ARB_SYS = "0x0000000000000000000000000000000000000064" as const;
const ARB_GAS_INFO = "0x000000000000000000000000000000000000006C" as const;

// 4-byte selectors from the exercise brief (hands-on/02-nitro-chain-monitor.md).
const SELECTOR_ARB_BLOCK_NUMBER = "0xa3b1b31d";
const SELECTOR_L1_BASE_FEE_ESTIMATE = "0xf5d6ded7";
const SELECTOR_MIN_GAS_PRICE = "0xf918379a";

const L1_RPC = process.env.L1_RPC ?? "http://127.0.0.1:8545";
const L2_RPC = process.env.L2_RPC ?? "http://127.0.0.1:8547";
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 3000);
const DURATION_MS = Number(process.env.DURATION_MS ?? 90000);
const OUT_FILE = process.env.OUT_FILE ?? "../output/metrics.ndjson";

const l1 = createPublicClient({ transport: http(L1_RPC) });
const l2 = createPublicClient({ transport: http(L2_RPC) });

async function callUint256(
  client: typeof l1,
  to: `0x${string}`,
  selector: `0x${string}`,
): Promise<bigint> {
  const { data } = await client.call({ to, data: selector });
  return BigInt(data ?? "0x0");
}

interface Metrics {
  t: string;
  elapsedSec: number;
  l1BlockNumber: string;
  l2BlockNumber: string;
  l1BaseFeeEstimateGwei: string;
  l2MinGasPriceGwei: string;
  l2GasUsed: string;
  l2GasLimit: string;
  l2BlockFillPct: string;
}

async function poll(startedAt: number): Promise<Metrics> {
  const [l1BlockNumber, l2BlockNumberFromSys, l2Block, l1BaseFeeEstimate, l2MinGasPrice] =
    await Promise.all([
      l1.getBlockNumber(),
      callUint256(l2, ARB_SYS, SELECTOR_ARB_BLOCK_NUMBER),
      l2.getBlock({ blockTag: "latest" }),
      callUint256(l2, ARB_GAS_INFO, SELECTOR_L1_BASE_FEE_ESTIMATE),
      callUint256(l2, ARB_GAS_INFO, SELECTOR_MIN_GAS_PRICE),
    ]);

  const fillPct =
    l2Block.gasLimit > 0n
      ? (Number(l2Block.gasUsed) / Number(l2Block.gasLimit)) * 100
      : 0;

  return {
    t: new Date().toISOString(),
    elapsedSec: Math.round((Date.now() - startedAt) / 1000),
    l1BlockNumber: l1BlockNumber.toString(),
    l2BlockNumber: l2BlockNumberFromSys.toString(),
    l1BaseFeeEstimateGwei: formatGwei(l1BaseFeeEstimate),
    l2MinGasPriceGwei: formatGwei(l2MinGasPrice),
    l2GasUsed: l2Block.gasUsed.toString(),
    l2GasLimit: l2Block.gasLimit.toString(),
    l2BlockFillPct: fillPct.toFixed(2),
  };
}

async function main() {
  mkdirSync(dirname(OUT_FILE), { recursive: true });

  console.log(
    `Polling every ${INTERVAL_MS}ms for ${DURATION_MS}ms — L1=${L1_RPC} L2=${L2_RPC}`,
  );
  console.log(
    "elapsed  l1Block  l2Block  l1BaseFee(gwei)  l2GasPrice(gwei)  l2Fill%",
  );

  const startedAt = Date.now();
  while (Date.now() - startedAt < DURATION_MS) {
    try {
      const m = await poll(startedAt);
      appendFileSync(OUT_FILE, JSON.stringify(m) + "\n");
      console.log(
        `${String(m.elapsedSec).padStart(4, " ")}s   ${m.l1BlockNumber.padStart(6, " ")}   ${m.l2BlockNumber.padStart(6, " ")}   ${m.l1BaseFeeEstimateGwei.padStart(10, " ")}       ${m.l2MinGasPriceGwei.padStart(10, " ")}      ${m.l2BlockFillPct.padStart(5, " ")}%`,
      );
    } catch (err) {
      console.error("poll failed:", (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  console.log(`Done. Metrics appended to ${OUT_FILE}`);
}

main();
