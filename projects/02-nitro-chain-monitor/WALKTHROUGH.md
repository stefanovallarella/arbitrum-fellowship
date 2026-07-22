# Walkthrough — Nitro Chain Monitor paso a paso

Igual que en [`01-community-vault/WALKTHROUGH.md`](../01-community-vault/WALKTHROUGH.md): esto no es la referencia técnica (para eso el `README.md`), es el repaso narrado de qué corrimos, qué vimos en vivo, y qué significa cada cosa — con los números reales de nuestras propias corridas, no ejemplos inventados.

## El panorama: qué se levanta y cómo se conecta

```
nitro-testnode (Docker)
├── geth (L1)         → puerto :8545 — Ethereum simulado
└── sequencer (L2)    → puerto :8547 — el mismo binario de Nitro que corre Arbitrum One
        ↑
monitor.ts  ──lee──→  ArbSys / ArbGasInfo (precompiles del L2)
        ↑
workload.sh ──manda──→ transacciones reales al L2
```

`nitro-testnode` es el repo oficial de Offchain Labs para levantar, en Docker, una réplica real (no un mock) de todo el stack: los mismos contratos y el mismo Sequencer que corren en producción, apuntando a una red privada tuya.

## Paso 1 — Levantar el testnode

```bash
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"   # gotcha de Git Bash en Windows
./test-node.bash --init
```

Mientras corre, en orden:

1. **Arranca geth en modo dev** — tu L1. Escribe un "genesis block" (el bloque 0, el estado inicial del que todo lo demás se deriva — el mismo concepto de [Module 1.1](../../docs/block-1-ethereum-evm/module-1.1-ethereum-execution-model.md), ahora a nivel de todo un rollup).
2. **Deploya sobre ese L1 los contratos reales del rollup de Arbitrum**. En nuestra corrida vimos pasar, entre otros:
   - `Bridge` (`0x7DD3F2a3fAeF3B9F2364c335163244D3388Feb83`) — el contrato de mensajería L1↔L2 de [Module 2.3](../../docs/block-2-nitro-stack/module-2.3-cross-chain-messaging-bridges.md).
   - `EdgeChallengeManager` (`0xBd4Cc2f69fFd94b5F62DCc5a27c2eb805093FC0d`) — el contrato de disputas BoLD de [Module 2.2](../../docs/block-2-nitro-stack/module-2.2-fraud-proofs-bold.md). Nunca se activa en modo dev (no hay validadores maliciosos), pero está ahí, deployado, funcionando igual que en producción.
   - `RollupUserLogic` (`0x92f58045FFB1C00a7b9486B9D2a55d316380CB45`) — el contrato que guarda cuál es el estado confirmado del rollup.
3. **Arranca el Sequencer** — tu L2, puerto `8547`.

**Gotcha real que nos pasó dos veces**: `Error: ports are not available: exposing port TCP 127.0.0.1:8545` — porque ya teníamos un `hardhat node` corriendo (del ejercicio 01) ocupando el mismo puerto. Dos blockchains locales distintas no pueden compartir puerto. Solución: parar el nodo de Hardhat antes de levantar el testnode.

## Paso 2 — Confirmar que las dos capas responden

```bash
curl -X POST http://127.0.0.1:8545 -d '{"jsonrpc":"2.0","method":"eth_blockNumber",...}'
curl -X POST http://127.0.0.1:8547 -d '{"jsonrpc":"2.0","method":"eth_blockNumber",...}'
```

En nuestra corrida: L1 ya iba por el bloque `36`, L2 recién por el `8` — pistas de que el L1 ya venía "produciendo tiempo" solo (geth dev mode mina bloques automáticamente cada tanto) mientras el L2 recién arrancaba.

## Paso 3 — Correr el monitor y leer la tabla en vivo

```bash
cd monitor && npx tsx src/monitor.ts
```

Cada 2-3 segundos, `monitor.ts` hace `eth_call` directo a dos precompiles — direcciones fijas donde vive funcionalidad nativa del EVM de Arbitrum, no contratos deployados por nosotros:

| Precompile | Dirección | Qué leímos |
|---|---|---|
| `ArbSys` | `0x64` | `arbBlockNumber()` — número de bloque L2 |
| `ArbGasInfo` | `0x6C` | `getL1BaseFeeEstimate()`, `getMinimumGasPrice()` |

Más `eth_blockNumber` estándar contra el L1, y `gasUsed/gasLimit` del último bloque L2 (block fill %) — los mismos conceptos de [Module 2.4](../../docs/block-2-nitro-stack/module-2.4-building-on-arbitrum-evm.md) sobre el modelo de gas de dos dimensiones.

**Nuestra primera lectura real, en reposo**:
```
elapsed  l1Block  l2Block  l1BaseFee(gwei)  l2GasPrice(gwei)  l2Fill%
   0s      178        9   0.000000025              0.1       0.00%
   3s      178        9   0.000000025              0.1       0.00%
   6s      184        9   0.000000025              0.1       0.00%
```

`l1Block` sube solo (geth dev mode mina igual, con o sin transacciones). `l2Block` está **clavado en 9** — el Sequencer de Arbitrum, a diferencia de geth dev, **no mina bloques vacíos**: solo produce un bloque cuando tiene algo real que procesar. Sin carga, no pasa nada.

## Paso 4 — Generar carga real y ver la reacción

```bash
./test-node.bash script send-l2 --from funnel --to funnel --ethamount 0.0001 --times 300 --threads 1
```

Esto manda 300 auto-transferencias chiquitas, una atrás de la otra, contra el L2. Mirando el monitor en simultáneo:

```
  21s      196       11   ...
  24s      202       17   ← acá arrancó la reacción
  33s      208       31
  42s      220       67
  60s      238      140
  90s      268      261
 124s      298      361
```

El bloque L2 arrancó a subir apenas empezaron a llegar transacciones reales — la prueba en vivo de "el Sequencer produce bloques on-demand, no por timer" que veníamos leyendo en teoría en [Module 2.1](../../docs/block-2-nitro-stack/module-2.1-nitro-architecture.md).

**Lo que NO se movió, en toda la corrida**: `l1BaseFee`, `l2GasPrice` y `l2Fill%` se mantuvieron exactamente iguales del principio al final. Esto no es un error — es que este testnode de desarrollo no tiene activo el mecanismo de precios por congestión que sí tiene Arbitrum One en producción (el modelo de [Module 2.4](../../docs/block-2-nitro-stack/module-2.4-building-on-arbitrum-evm.md), donde el precio de gas L2 debería subir con demanda sostenida). Acá el precio queda clavado en su piso mínimo pase lo que pase.

## El hallazgo que no esperábamos: siguió subiendo después

El monitor corrió 180 segundos en total. El bloque L2 siguió subiendo bastante **después** de que el comando de carga ya había terminado (`workload-end`) — de `361` a `470` en los últimos ~55 segundos. En vez de asumir una explicación, lo investigamos mirando el contenido real de un bloque reciente:

```js
// eth_getBlockByNumber directo, con las transacciones incluidas
block 1056, 2 transacciones:
  tx 1: from 0x000...A4B05 → a sí misma, value 0, gas 0        (transacción interna de ArbOS)
  tx 2: from 0x8442...df61 → a sí misma, value 0.0001 ETH, gas 21000   (¡una de las nuestras!)
```

Dos cosas quedaron claras:

1. **Cada bloque L2 trae una transacción interna automática** (dirección especial `0x...A4B05`) que ArbOS inserta sola, registrando datos del bloque L1 correspondiente — la capa "pegamento" entre L1 y L2 de [Module 2.1](../../docs/block-2-nitro-stack/module-2.1-nitro-architecture.md), visible en cada bloque sin que nosotros hagamos nada.
2. **El Sequencer todavía estaba procesando nuestra ráfaga**, minutos después de que el script de carga "terminara". El script manda las 300 transacciones a los tiros (sin esperar confirmación una por una), pero el Sequencer las va incluyendo en bloques a su propio ritmo — acá, literal, una transacción real nuestra por bloque. La demanda ya estaba "puesta" mucho antes de que el Sequencer terminara de absorberla.

## Paso 5 — Generar el reporte visual

```bash
npx tsx src/report.ts ../output/metrics.ndjson ../output/report.html
```

Convierte el NDJSON (una línea JSON por muestra) en un HTML con sparklines + tabla — abrible con doble clic, sin servidor ni conexión RPC. `report.html` es exactamente el gráfico que describe este documento: la línea de bloque L2 arrancando chata y curvándose hacia arriba, mientras gas price/L1 base fee/fill quedan perfectamente planas.

## Paso 6 — Bajar todo

```bash
docker compose down -v
```

Container y volúmenes se destruyen — la próxima vez que se levante, arranca de cero (nuevo genesis, nuevos contratos redeployados). Las imágenes de Docker ya descargadas/construidas quedan cacheadas, así que la segunda vez que lo levantamos (en esta misma sesión) tardó mucho menos que la primera.

## Para repasar rápido

| Qué vimos | Evidencia real | Concepto de Block 2 |
|---|---|---|
| Bloques L2 on-demand, no por timer | `l2Block` clavado en `9` sin carga | [Module 2.1](../../docs/block-2-nitro-stack/module-2.1-nitro-architecture.md) — Sequencer |
| Contratos reales de BoLD deployados | `EdgeChallengeManager` en el log de init | [Module 2.2](../../docs/block-2-nitro-stack/module-2.2-fraud-proofs-bold.md) |
| Bridge L1↔L2 | Contrato `Bridge` en el log de init | [Module 2.3](../../docs/block-2-nitro-stack/module-2.3-cross-chain-messaging-bridges.md) |
| Precompiles (`ArbSys`, `ArbGasInfo`) | Todo `monitor.ts` | [Module 2.4](../../docs/block-2-nitro-stack/module-2.4-building-on-arbitrum-evm.md) |
| Transacción interna de ArbOS por bloque | `from 0x...A4B05` en cada bloque | [Module 2.1](../../docs/block-2-nitro-stack/module-2.1-nitro-architecture.md) |
| Precio de gas SIN reaccionar a demanda (devnet) | `l2GasPrice` fijo en `0.1` toda la corrida | [Module 2.4](../../docs/block-2-nitro-stack/module-2.4-building-on-arbitrum-evm.md) — contraste con producción |
