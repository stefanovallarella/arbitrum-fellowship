// Generates a static, self-contained HTML report from a captured metrics.ndjson run.
// Usage: npx tsx src/report.ts [path/to/metrics.ndjson] [path/to/output.html]
import { readFileSync, writeFileSync } from "node:fs";

const IN_FILE = process.argv[2] ?? "../output/metrics.ndjson";
const OUT_FILE = process.argv[3] ?? "../output/report.html";

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

const rows: Metrics[] = readFileSync(IN_FILE, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

function sparkPoints(values: number[], width: number, height: number): string {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function sparkline(values: number[], label: string): string {
  const w = 600;
  const h = 60;
  const points = sparkPoints(values, w, h);
  return `
    <div class="chart">
      <div class="chart-label">${label}</div>
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
        <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
    </div>`;
}

const l2Blocks = rows.map((r) => Number(r.l2BlockNumber));
const l1Blocks = rows.map((r) => Number(r.l1BlockNumber));
const gasPrices = rows.map((r) => Number(r.l2MinGasPriceGwei));
const l1BaseFees = rows.map((r) => Number(r.l1BaseFeeEstimateGwei));
const fillPcts = rows.map((r) => Number(r.l2BlockFillPct));

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Nitro Chain Monitor — Reporte</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color-scheme: light dark; }
  h1 { font-size: 1.3rem; }
  .chart { margin-bottom: 1.5rem; }
  .chart-label { font-size: 0.85rem; opacity: 0.7; margin-bottom: 0.25rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th, td { text-align: right; padding: 0.25rem 0.5rem; border-bottom: 1px solid rgba(128,128,128,0.2); }
  th:first-child, td:first-child { text-align: left; }
  .meta { font-size: 0.85rem; opacity: 0.7; margin-bottom: 1.5rem; }
</style>
</head>
<body>
  <h1>📈 Nitro Chain Monitor — Reporte de la corrida</h1>
  <p class="meta">${rows.length} muestras · desde ${rows[0]?.t} hasta ${rows[rows.length - 1]?.t}</p>

  ${sparkline(l2Blocks, "Bloque L2 (ArbSys.arbBlockNumber)")}
  ${sparkline(l1Blocks, "Bloque L1 (eth_blockNumber)")}
  ${sparkline(gasPrices, "L2 min gas price (gwei)")}
  ${sparkline(l1BaseFees, "L1 base fee estimate (gwei)")}
  ${sparkline(fillPcts, "L2 block fill (%)")}

  <table>
    <thead><tr><th>t (s)</th><th>L1 block</th><th>L2 block</th><th>L1 base fee (gwei)</th><th>L2 gas price (gwei)</th><th>Fill %</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr><td>${r.elapsedSec}</td><td>${r.l1BlockNumber}</td><td>${r.l2BlockNumber}</td><td>${r.l1BaseFeeEstimateGwei}</td><td>${r.l2MinGasPriceGwei}</td><td>${r.l2BlockFillPct}</td></tr>`,
        )
        .join("\n")}
    </tbody>
  </table>
</body>
</html>
`;

writeFileSync(OUT_FILE, html);
console.log(`Wrote ${OUT_FILE} (${rows.length} rows)`);
