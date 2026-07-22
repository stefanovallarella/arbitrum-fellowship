# Walkthrough — Nitro Chain Monitor paso a paso

Igual que en [`01-community-vault/WALKTHROUGH.md`](../01-community-vault/WALKTHROUGH.md): esto no es la referencia técnica (para eso el `README.md`), es el repaso narrado de qué corrimos, qué vimos en vivo, y qué significa cada cosa — con los números reales de nuestras propias corridas, no ejemplos inventados. Cada vez que se cita un módulo del currículum, va con una explicación corta al lado de qué es el concepto y cómo se vio acá — no hace falta ir a leer la doc genérica para entender la referencia.

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

1. **Arranca geth en modo dev** — tu L1. Escribe un "genesis block": el bloque 0, el punto de partida fijo a partir del cual se calcula todo estado posterior (nadie puede "empezar antes" de él). Es el mismo concepto de estado inicial de [Module 1.1](../../docs/block-1-ethereum-evm/module-1.1-ethereum-execution-model.md) (ahí a nivel de un contrato, acá a nivel de toda una red).
2. **Deploya sobre ese L1 los contratos reales del rollup de Arbitrum**. En nuestra corrida vimos pasar, entre otros:
   - `Bridge` (`0x7DD3F2a3fAeF3B9F2364c335163244D3388Feb83`) — el contrato que recibe y encola los mensajes que cruzan entre L1 y L2 (depósitos, retiros, llamadas cross-chain). Es la pieza de infraestructura que hace posible mover valor entre las dos redes; el mecanismo completo (retryable tickets, período de desafío) está en [Module 2.3](../../docs/block-2-nitro-stack/module-2.3-cross-chain-messaging-bridges.md).
   - `EdgeChallengeManager` (`0xBd4Cc2f69fFd94b5F62DCc5a27c2eb805093FC0d`) — el contrato que resolvería una disputa si alguien afirmara que el estado del rollup es incorrecto: implementa BoLD, el mecanismo de "adiviná el número" por bisección que reduce la disputa a un único paso de ejecución verificable en L1 ([Module 2.2](../../docs/block-2-nitro-stack/module-2.2-fraud-proofs-bold.md)). Nunca se activa en modo dev (no hay validadores maliciosos, todo corre en confianza), pero está deployado y funcionando igual que en producción.
   - `RollupUserLogic` (`0x92f58045FFB1C00a7b9486B9D2a55d316380CB45`) — el contrato que guarda cuál es la última assertion (afirmación de estado) confirmada del rollup — el "estado oficial" que cualquiera puede consultar desde L1.
3. **Arranca el Sequencer** — tu L2, puerto `8547`. Es el proceso que recibe, ordena y ejecuta las transacciones del rollup antes de publicarlas a L1 — el mismo software que corre Arbitrum One en producción, apuntando acá a tu L1 local.

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

Más `eth_blockNumber` estándar contra el L1, y `gasUsed/gasLimit` del último bloque L2 (block fill %). Estas cuatro métricas son justamente los dos componentes de la fórmula de fee de Arbitrum explicada en [Module 2.4](../../docs/block-2-nitro-stack/module-2.4-building-on-arbitrum-evm.md): `l2GasPrice` es el costo de ejecución en L2, `l1BaseFee` es lo que le cuesta al Sequencer publicar tu transacción en L1 (convertido a una equivalencia de gas), y ambos se combinan en la fee única que ves en tu wallet.

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

El bloque L2 arrancó a subir apenas empezaron a llegar transacciones reales. Es la prueba en vivo de algo que [Module 2.1](../../docs/block-2-nitro-stack/module-2.1-nitro-architecture.md) explica en teoría sobre el Sequencer: agrupa ("batchea") transacciones que van llegando y produce un bloque nuevo cuando tiene algo que procesar — no corre con un timer fijo que genere bloques vacíos solo porque pasó el tiempo, como sí hace geth en modo dev (por eso `l1Block` sube solo y `l2Block` no).

**Lo que NO se movió, en toda la corrida**: `l1BaseFee`, `l2GasPrice` y `l2Fill%` se mantuvieron exactamente iguales del principio al final. Esto no es un error — [Module 2.4](../../docs/block-2-nitro-stack/module-2.4-building-on-arbitrum-evm.md) explica que `l2GasPrice` (el "piso" de gas L2) debería subir cuando la demanda supera un límite sostenido de la red — es el mecanismo que evita que la red se sature. Este testnode de desarrollo simplemente no tiene ese mecanismo de precios activado: está configurado para iterar rápido y predecible en local, no para simular el comportamiento de congestión de Arbitrum One real. El precio queda clavado en su piso mínimo pase lo que pase, sin importar cuánta carga le mandes.

## El hallazgo que no esperábamos: siguió subiendo después

El monitor corrió 180 segundos en total. El bloque L2 siguió subiendo bastante **después** de que el comando de carga ya había terminado (`workload-end`) — de `361` a `470` en los últimos ~55 segundos. En vez de asumir una explicación, lo investigamos mirando el contenido real de un bloque reciente:

```js
// eth_getBlockByNumber directo, con las transacciones incluidas
block 1056, 2 transacciones:
  tx 1: from 0x000...A4B05 → a sí misma, value 0, gas 0        (transacción interna de ArbOS)
  tx 2: from 0x8442...df61 → a sí misma, value 0.0001 ETH, gas 21000   (¡una de las nuestras!)
```

Dos cosas quedaron claras:

1. **Cada bloque L2 trae una transacción interna automática** (dirección especial `0x...A4B05`) que **ArbOS** inserta sola, registrando datos del bloque L1 correspondiente. ArbOS es la capa de software que corre por encima de Geth dentro de Nitro ([Module 2.1](../../docs/block-2-nitro-stack/module-2.1-nitro-architecture.md)) — agrega todo lo que hace que esto sea un rollup y no "Ethereum corriendo dos veces": mensajería cross-chain, el modelo de gas de dos dimensiones, y este tipo de contabilidad interna. La estás viendo actuar sola, en cada bloque, sin que nosotros hiciéramos nada para pedirla.
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

| Qué vimos | Evidencia real | Qué significa, concretamente | Módulo |
|---|---|---|---|
| Bloques L2 on-demand, no por timer | `l2Block` clavado en `9` sin carga | El Sequencer arma un bloque cuando tiene transacciones para procesar, no en un timer fijo — por eso se queda quieto si no le mandás nada, a diferencia de un L1 en modo dev | [Module 2.1](../../docs/block-2-nitro-stack/module-2.1-nitro-architecture.md) — Sequencer |
| Contratos reales de BoLD deployados | `EdgeChallengeManager` en el log de init | El contrato que resolvería, por bisección, una disputa sobre si el estado del rollup es correcto — nunca se activó acá porque no hubo ninguna disputa, pero es el mismo contrato de producción | [Module 2.2](../../docs/block-2-nitro-stack/module-2.2-fraud-proofs-bold.md) |
| Bridge L1↔L2 | Contrato `Bridge` en el log de init | El punto de entrada de mensajes que cruzan de L1 a L2 (y viceversa) — depósitos, retiros, llamadas cross-chain, todo pasa por acá | [Module 2.3](../../docs/block-2-nitro-stack/module-2.3-cross-chain-messaging-bridges.md) |
| Precompiles (`ArbSys`, `ArbGasInfo`) | Todo `monitor.ts` | Funciones nativas del EVM de Arbitrum en direcciones fijas (no contratos deployados) — la forma estándar de consultar datos de la chain (número de bloque, precios de gas) sin pasar por un contrato intermediario | [Module 2.4](../../docs/block-2-nitro-stack/module-2.4-building-on-arbitrum-evm.md) |
| Transacción interna de ArbOS por bloque | `from 0x...A4B05` en cada bloque | ArbOS (la capa que corre sobre Geth) registra sola, en cada bloque, datos del bloque L1 correspondiente — parte de la "contabilidad" que hace que Arbitrum sea un rollup y no solo Ethereum corriendo dos veces | [Module 2.1](../../docs/block-2-nitro-stack/module-2.1-nitro-architecture.md) |
| Precio de gas SIN reaccionar a demanda (devnet) | `l2GasPrice` fijo en `0.1` toda la corrida | En Arbitrum One real, este precio subiría con congestión sostenida; acá el testnode no tiene ese mecanismo activo, así que se queda en su piso mínimo sin importar la carga | [Module 2.4](../../docs/block-2-nitro-stack/module-2.4-building-on-arbitrum-evm.md) — contraste con producción |
