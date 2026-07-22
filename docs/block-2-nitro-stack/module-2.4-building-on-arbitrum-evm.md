# Module 2.4 — Building on Arbitrum (EVM)

← [Block 2 — Arbitrum & the Nitro Stack](./README.md)

**Temas:** Endpoints de red e info de chain: Arbitrum One, Arbitrum Sepolia · Gas en Arbitrum: ejecución L2 + posteo de calldata en L1 · Precompiles: ArbSys, ArbGasInfo, NodeInterface · Deploy de un contrato Solidity en Arbitrum Sepolia · Timeboost y el modelo de express-lane

**Recursos must:**
- [Chain Info & Endpoints](https://docs.arbitrum.io/for-devs/dev-tools-and-resources/chain-info) — endpoints de red para One y Sepolia
- [How to Estimate Gas in Arbitrum](https://docs.arbitrum.io/build-decentralized-apps/how-to-estimate-gas) — modelo de fee de dos dimensiones
- [Precompiles Reference](https://docs.arbitrum.io/arbitrum-essentials/precompiles/reference) — ArbSys, ArbGasInfo, NodeInterface
- [Timeboost: A Gentle Introduction](https://docs.arbitrum.io/how-arbitrum-works/timeboost/gentle-introduction) — modelo de subasta de express-lane, MEV en Arbitrum

---

## Glosario nuevo

- **Precompile**: un contrato que no está escrito en Solidity y desplegado normalmente — es funcionalidad nativa del cliente (Geth/Nitro), expuesta en una dirección fija como si fuera un contrato más, para que puedas llamarla con la sintaxis normal de Solidity (`ArbSys(0x64).arbBlockNumber()`). Es mucho más eficiente que reimplementar esa lógica en Solidity puro.
- **MEV (Maximal Extractable Value)**: el valor que alguien puede extraer reordenando, insertando o excluyendo transacciones dentro de un bloque — por ejemplo, viendo una transacción grande de swap en el mempool y colocando la propia justo antes para beneficiarse del movimiento de precio que esa transacción va a causar.
- **FCFS (First-Come, First-Serve)**: la política de ordenamiento "por defecto" de un Sequencer — la primera transacción que llega es la primera que se procesa. Suena justo, pero incentiva carreras de latencia (correr servidores físicamente más cerca del Sequencer, hardware más caro) entre bots que compiten por la misma oportunidad de MEV.

## 1. Endpoints y chain IDs

Para interactuar con Arbitrum necesitás apuntar tu RPC (Hardhat, Foundry, viem/ethers) a estos endpoints:

| Red | RPC | Chain ID | Explorer |
|---|---|---|---|
| Arbitrum One (mainnet) | `https://arb1.arbitrum.io/rpc` | 42161 | [arbiscan.io](https://arbiscan.io/) |
| Arbitrum Sepolia (testnet) | `https://sepolia-rollup.arbitrum.io/rpc` | 421614 | [sepolia.arbiscan.io](https://sepolia.arbiscan.io/) |

Nota práctica: los RPCs públicos **no soportan WebSocket** — si tu app depende de recibir eventos en tiempo real (`eth_subscribe`), necesitás un proveedor de nodo de terceros (Alchemy, Infura, QuickNode), no el endpoint público. Esto ya lo veías reflejado en `hardhat.config.ts` de los proyectos anteriores, que apuntan al RPC público solo para deploy/lectura ocasional.

## 2. El modelo de gas de dos dimensiones

Este es el concepto técnico central del módulo, y el que vas a medir directamente en el ejercicio. A diferencia de Ethereum L1 (donde el gas paga solo la ejecución), en Arbitrum **una única fee que ves en tu wallet combina dos costos distintos**:

- **L2 Execution Gas (L2G)**: el costo computacional de correr tu transacción — lo mismo que en Ethereum L1: opcodes, acceso a storage, complejidad del contrato.
- **L1 Data Posting Cost (L1C)**: el costo que el Sequencer va a tener que pagar más tarde para publicar el batch que contiene tu transacción en L1 (ver [Module 2.1](./module-2.1-nitro-architecture.md)) — Arbitrum te lo cobra por adelantado, convertido a una cantidad equivalente de gas L2.

La fórmula (simplificada) es:

```
TXFEES = P × (L2G + (L1P × L1S) / P)
```

Donde:
- **P** = precio del gas L2 (ajusta con la demanda desde un piso mínimo — esto es lo que lee `ArbGasInfo.getMinimumGasPrice()`, el precompile que vas a consultar en el ejercicio)
- **L1P** = costo estimado por byte en L1 (esto es lo que lee `ArbGasInfo.getL1BaseFeeEstimate()`, el otro precompile del ejercicio)
- **L1S** = el tamaño de tu transacción en bytes, **después** de la compresión Brotli

**Ejemplo de intuición**: si el precio de gas en Ethereum L1 se dispara (más demanda de bloques en L1), tu transacción en Arbitrum se encarece también — aunque la ejecución en L2 sea exactamente igual de barata que siempre — porque el componente `L1P` de la fórmula sube. Esto explica un fenómeno que a veces sorprende a quien recién llega a L2s: "¿por qué mi transacción en Arbitrum costó más hoy si nada cambió en Arbitrum?" — la respuesta casi siempre es que subió el gas en L1, no en L2.

Consecuencia práctica para vos como developer: `eth_estimateGas` en Arbitrum puede darte resultados que varían con el tiempo incluso para la misma transacción exacta, porque el componente L1 fluctúa con el gas price de Ethereum en tiempo real — no asumas que un gas estimate viejo sigue siendo válido.

## 3. Los precompiles que vas a usar en el ejercicio

Ya nombramos varios en módulos anteriores; acá los juntamos con su dirección y función exacta:

| Precompile | Dirección | Función | Para qué sirve |
|---|---|---|---|
| `ArbSys` | `0x64` | `arbBlockNumber()` | Número de bloque L2 actual |
| `ArbSys` | `0x64` | `arbChainID()` | Chain ID del rollup |
| `ArbGasInfo` | `0x6C` | `getL1BaseFeeEstimate()` | Estimación del costo de posteo en L1 (componente L1P de la fórmula) |
| `ArbGasInfo` | `0x6C` | `getMinimumGasPrice()` | Piso del precio de gas L2 (componente P de la fórmula) |
| `ArbGasInfo` | `0x6C` | `getPricesInWei()` | Desglose completo de precios en wei |
| `NodeInterface` | `0xC8` | `gasEstimateL1Component()` | Desglosa cuánto de tu fee total corresponde específicamente al componente L1 (parte del bonus del ejercicio) |

Todos se consultan vía `eth_call` contra el nodo L2 — no son transacciones, son lecturas, así que no cuestan gas real (más allá del costo de hacer el RPC call).

## 4. Timeboost: quién decide el orden dentro de un bloque

Ya vimos que el Sequencer ordena transacciones bajo **FCFS** por default. El problema con FCFS puro: incentiva carreras de latencia entre bots buscando MEV, generando spam y congestión — y todo ese valor extraído queda en manos de los searchers, sin que el owner de la chain (ni la red en general) capture nada de eso.

**Timeboost** modifica esto agregando un endpoint especial del Sequencer (`timeboost_sendExpressLaneTransaction`): las transacciones que manda el controlador de la "express lane" en la ronda actual se secuencian de inmediato; las transacciones normales reciben un delay artificial de **200ms** por default (lo que puede empujarlas al siguiente bloque).

Punto importante de diseño: el controlador de la express lane **no puede reordenar transacciones** ni garantizar ser el primero — solo se salta el delay de 200ms. El mempool sigue siendo privado, así que esto no reintroduce front-running o sandwich attacks; solo cambia la prioridad de inclusión.

**Cómo se asigna el control de la express lane**: una subasta sellada de segundo precio, por rondas de **60 segundos** por default. Cualquiera puede ofertar con cualquier token ERC-20, pre-depositando fondos en el contrato de subasta. La subasta cierra 15 segundos antes de que arranque la ronda (dando 45 segundos para ofertar), solo se considera la oferta más reciente de cada address, y hay un máximo de 5 ofertas por address por ronda.

**A dónde va la plata**: el contrato le cobra al ganador el precio de la *segunda* oferta más alta (subasta de segundo precio — el mismo mecanismo que usa Google Ads), y transfiere ese monto a una cuenta beneficiaria que define el owner de la chain. Esto es lo que permite que el dueño de una chain Arbitrum capture parte del MEV que antes se iba entero a searchers — y potencialmente redistribuirlo a apps o usuarios.

## Conexión con el ejercicio (Nitro Chain Monitor)

Este es el módulo más directamente aplicado — el ejercicio completo es básicamente "poné en práctica la sección 2 y 3 con números reales":

- Vas a llamar `ArbGasInfo.getL1BaseFeeEstimate()` y `ArbGasInfo.getMinimumGasPrice()` — los dos componentes exactos de la fórmula de fee de la sección 2.
- Vas a calcular **block fill** (`gasUsed / gasLimit`) del bloque L2 más reciente, para ver en vivo cómo reacciona la red cuando el workload script manda una ráfaga de transacciones.
- El bonus de `NodeInterface.gasEstimateL1Component()` te deja desglosar, transacción por transacción, cuánto de la fee total corresponde a cada una de las dos dimensiones de la sección 2 — la forma más concreta posible de "ver" el modelo de gas de dos dimensiones en la práctica.
- No vas a interactuar con Timeboost directamente (el testnode local no corre subastas de express lane), pero entender que existe te explica por qué, en producción, el orden de inclusión dentro de un bloque no es simplemente "quién llegó primero".

## Siguiente

Con esto se cierran los 4 módulos de Block 2. Ahora toca resolver el ejercicio **02 — Nitro Chain Monitor**, aplicando todo lo visto en 2.1–2.4 contra un testnode real corriendo en Docker.
