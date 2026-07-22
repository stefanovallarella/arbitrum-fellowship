# Block 2 — Arbitrum & the Nitro Stack

**Subtítulo:** L2 Architecture Deep Dive
**Objetivo:** entender la arquitectura y el estado actual de Arbitrum One (Nitro, BoLD, ArbOS) para poder razonar sobre deployments, finalidad, fees y bridging.

← [Fellowship Cobuilders](../README.md)

## Módulos

- [2.1 — Nitro Architecture](./module-2.1-nitro-architecture.md) ✅
- [2.2 — Fraud Proofs & BoLD](./module-2.2-fraud-proofs-bold.md) ✅
- [2.3 — Cross-chain Messaging & Bridges](./module-2.3-cross-chain-messaging-bridges.md) ✅
- [2.4 — Building on Arbitrum (EVM)](./module-2.4-building-on-arbitrum-evm.md) ✅

Los 4 módulos de Block 2 están completos, y el ejercicio de la semana está resuelto en `projects/02-nitro-chain-monitor/`: testnode de Nitro levantado con Docker, monitor en TypeScript (viem) leyendo `ArbSys`/`ArbGasInfo` vía `eth_call`, y una carga real de 3.000 transacciones concurrentes disparada contra el testnode. Hallazgo interesante: en este testnode de desarrollo, el precio de gas L2, el L1 base fee estimate y el block fill se mantuvieron completamente planos antes/durante/después de la carga — el Sequencer produce bloques L2 a un ritmo fijo (~4/s) independientemente de la demanda, a diferencia de Arbitrum One en producción (ver detalle en el README del proyecto).

## Ejercicio de la semana

**02 — Nitro Chain Monitor**
Fuente: [hands-on/02-nitro-chain-monitor.md](https://github.com/CoBuilders-xyz/stylus-fellowship/blob/main/hands-on/02-nitro-chain-monitor.md) (también en el fork local, `hands-on/`)

Levantar el Nitro testnode local (L1 en `:8545`, L2 en `:8547`), escribir un monitor que consulte cada pocos segundos: número de bloque L2 (`ArbSys.arbBlockNumber()`), número de bloque L1 (`eth_blockNumber`), estimación de base fee L1 (`ArbGasInfo.getL1BaseFeeEstimate()`), precio mínimo de gas L2 (`ArbGasInfo.getMinimumGasPrice()`), y block fill (`gasUsed/gasLimit`). Correr una carga de transacciones y observar cómo reaccionan esas métricas antes, durante y después.

**Requisitos técnicos:**
- Nitro testnode corriendo en Docker
- Monitor en cualquier lenguaje, consultando los precompiles vía `eth_call`
- Script de carga (provisto por `nitro-testnode` o propio)
- Output que muestre el antes/durante/después

**Entregables:** testnode corriendo + monitor + ejecución de carga + output capturado + README explicando cómo correrlo y qué se observó.

**Opcional:** conectar el mismo monitor a Arbitrum Sepolia y comparar, desglosar `NodeInterface.gasEstimateL1Component()`, visualización en tiempo real.

| Módulo Week 2 | Aplicación en el ejercicio | Nota |
|---|---|---|
| 2.1 Nitro Architecture | Correr el stack de Nitro localmente; observar el comportamiento del Sequencer | 2.1 |
| 2.2 Fraud Proofs & BoLD | Ver la tasa de producción de bloques L2 vs finalidad L1 | 2.2 |
| 2.3 Cross-chain Messaging | Interfaz `ArbSys`; relación entre bloques L1/L2 | 2.3 |
| 2.4 Building on Arbitrum | Consultas a precompiles, modelo de gas de dos dimensiones, interacción RPC | 2.4 |

## Live Q&A cubre

Arquitectura de Nitro, fraud proofs BoLD, patrones de bridging, deployment en Arbitrum.

## Outcomes esperados al cierre de la semana

- Deployar un contrato Solidity en Arbitrum Sepolia
- Explicar la relación entre Arbitrum One y Nitro
- Explicar la STF determinística de Nitro y el rol de BoLD
- Trazar un retiro de L2 a L1 paso a paso
