# Module 2.1 — Nitro Architecture

← [Block 2 — Arbitrum & the Nitro Stack](./README.md)

**Temas:** Nitro internals: sequencer, Geth embebido, compresión de calldata · Soft vs hard finality e inclusión censorship-resistant · ArbOS como unidad de upgrade sobre Nitro

**Recursos must:**
- [Inside Arbitrum Nitro](https://docs.arbitrum.io/how-arbitrum-works/inside-arbitrum-nitro) — deep dive oficial

**Referencia / nice to have:**
- [Arbitrum Nitro Whitepaper](https://docs.arbitrum.io/nitro-whitepaper.pdf) — las "4 grandes ideas", 30+ páginas
- [Deep Dive Into How Arbitrum Works](https://www.quillaudits.com/blog/blockchain/how-arbitrum-works) — overview bien estructurado
- [Nitro Source Code](https://github.com/OffchainLabs/nitro)

---

## Glosario nuevo

- **Sequencer**: el nodo que recibe las transacciones de un rollup, decide el orden en que se van a ejecutar, y las publica hacia L1. Ya lo mencionamos como concepto general en [Module 1.5](../block-1-ethereum-evm/module-1.5-why-l2s-exist.md) — acá vemos la implementación concreta que usa Arbitrum.
- **Calldata**: los datos de una transacción que se guardan permanentemente en la blockchain (a diferencia de `memory`, que es temporal). Publicar calldata en L1 es la parte más cara de operar un rollup, porque cada byte que subís a Ethereum tiene que ser almacenado y replicado por todos los nodos de L1 para siempre.
- **Brotli**: un algoritmo de compresión de datos (el mismo tipo de algoritmo que usa un `.zip`, pero optimizado para este caso). Comprimir antes de publicar en L1 reduce directamente el costo, porque pagás por byte publicado.
- **Blob (EIP-4844)**: un tipo de dato especial que Ethereum agregó en 2024 específicamente para que los rollups publiquen sus datos de forma más barata que usando calldata tradicional — se explica en detalle en la sección 3.
- **STF (State Transition Function)**: la función determinística "dado el estado actual + una transacción, calculá el nuevo estado" — el mismo concepto de Module 1.1 (`Y(S,T) = S'`), aplicado ahora a nivel de todo un rollup en vez de a un contrato individual.

## 1. El Sequencer: cómo Arbitrum ordena y publica transacciones

Cuando mandás una transacción a Arbitrum, no le pega directo a Ethereum L1 — le pega al **Sequencer**, un nodo operado (hoy) por Offchain Labs que hace de "punto de entrada" del rollup. El Sequencer hace tres cosas, en este orden:

1. **Acepta y ordena** tu transacción, y la transmite inmediatamente por un feed en tiempo real. Esto es lo que te da una confirmación casi instantánea (sub-segundo) — mucho más rápido que esperar confirmación en L1.
2. **Agrupa** ("batchea") muchas transacciones juntas, hasta que se acumula un tamaño predefinido o pasa un intervalo de tiempo fijo.
3. **Comprime** el batch entero con **Brotli**, ajustando el nivel de compresión dinámicamente (de 0 a 11) según qué tan congestionada esté la red — más compresión cuando hay tiempo, menos cuando hay que priorizar velocidad de procesamiento. Esta combinación de batching + compresión es lo que reduce el costo de publicar en L1 entre **10 y 100 veces** comparado con publicar cada transacción individualmente.

Una vez comprimido, el batch se publica en Ethereum L1 de dos formas posibles: como **blobs EIP-4844** (el método default, mucho más barato cuando está disponible) o como **calldata tradicional** (fallback, más predecible en costo). Vas a ver el impacto de esto directamente en el ejercicio: cuando corras el monitor y generes carga, el "L1 base fee estimate" que lee el contrato `ArbGasInfo` es justamente el costo estimado de esta publicación.

## 2. Soft finality vs hard finality

Acá aparece una distinción importante que no existe en Ethereum L1 (donde "finalidad" es más binaria): Arbitrum tiene **dos niveles de finalidad**.

- **Soft finality**: ocurre apenas el Sequencer acepta tu transacción y la incluye en su feed. Es instantánea, y te da el orden de inclusión — pero **depende de que confíes en el Sequencer**. No tiene respaldo criptográfico todavía; si el Sequencer fuera malicioso o se cayera antes de publicar en L1, técnicamente esa transacción "soft-finalizada" podría no llegar a confirmarse nunca en L1 tal como la viste.
- **Hard finality**: ocurre cuando el batch que contiene tu transacción efectivamente se publica en L1 y Ethereum lo confirma — típicamente **10 a 20 minutos** después, dependiendo del tiempo de bloque de Ethereum. Una vez que llegás a hard finality, tu transacción hereda toda la seguridad de consenso de Ethereum: los datos están públicamente disponibles y la transacción es irreversible.

**Analogía**: pensá en soft finality como cuando un mozo te confirma verbalmente tu pedido en un restaurante — confiás en que va a la cocina, pero no tenés un comprobante. Hard finality es cuando te dan el ticket impreso: ahora hay un registro que cualquiera puede verificar independientemente del mozo.

En la práctica, para la mayoría de las dApps (una wallet mostrándote que tu swap se ejecutó, por ejemplo) soft finality es suficiente — es lo que te da esa sensación de "Arbitrum es rápido". Pero para algo de alto valor (un puente institucional grande, un exchange liquidando una posición) vale la pena esperar hard finality.

## 3. ¿Cómo ejecuta Arbitrum el EVM? El "Geth sandwich"

Una pregunta natural: si Arbitrum no es Ethereum L1, ¿cómo corre exactamente el mismo Solidity sin cambios? La respuesta es una arquitectura de tres capas que la documentación de Arbitrum llama informalmente el **"Geth sandwich"**:

1. En el medio, la capa que realmente ejecuta el EVM es **Geth** — sí, el mismo cliente de Ethereum que corren miles de nodos de L1, literalmente reusado como librería. Esto es clave: en vez de reimplementar el EVM desde cero (con el riesgo de introducir bugs sutiles de compatibilidad), Arbitrum reutiliza código de Ethereum extensamente testeado en producción. Por eso un contrato de Ethereum L1 se deploya en Arbitrum sin tocar una línea.
2. Por encima de Geth está **ArbOS** (ver sección 4) — agrega todo lo que Geth no sabe hacer porque es específico de un rollup.
3. Por debajo, Nitro envuelve todo esto en una máquina de estados que corre en **WASM**, lo cual es lo que permite generar las fraud proofs que vas a ver en [Module 2.2](./module-2.2-fraud-proofs-bold.md) — poder probarle a L1 "ejecuté correctamente este paso" requiere poder ejecutar ese mismo paso dentro de un entorno verificable en L1, y WASM es el formato elegido para eso.

## 4. ArbOS: la capa que hace que esto sea un rollup y no solo "Ethereum corriendo dos veces"

**ArbOS** (Arbitrum OS) es la capa intermedia entre el Sequencer/Nitro y Geth. Es donde vive toda la lógica que es específica de ser un L2 y que no existe en Ethereum L1 vainilla:

- Mensajería cross-chain (lo que vas a ver en detalle en [Module 2.3](./module-2.3-cross-chain-messaging-bridges.md))
- El modelo de gas de dos dimensiones (L2 execution + L1 posting — [Module 2.4](./module-2.4-building-on-arbitrum-evm.md))
- Manejo de depósitos y retiros
- Los precompiles que vas a usar directamente en el ejercicio (`ArbSys`, `ArbGasInfo`)
- Soporte para Stylus (contratos en Rust/WASM — eso es Block 3, fuera del alcance de esta semana)

Para cada transacción, ArbOS: (1) valida el formato y que haya fondos suficientes, (2) cobra gas tanto por la ejecución L2 como por el costo estimado de posteo a L1, (3) delega a Geth la ejecución real del EVM, y (4) actualiza el estado y cualquier elemento cross-chain pendiente.

**Por qué importa que ArbOS sea una capa separada de Geth**: significa que Offchain Labs puede lanzar mejoras al protocolo (nuevas features, cambios de pricing, nuevos precompiles) modificando ArbOS, sin tener que tocar ni forkear Geth. Es la unidad de upgrade del stack — cuando ves anuncios de "ArbOS 20", "ArbOS 30", etc., son upgrades de esta capa.

## Conexión con el ejercicio (Nitro Chain Monitor)

Todo lo de este módulo lo vas a ver en vivo:

- Vas a levantar el **testnode** de Nitro con Docker — un Sequencer + nodos L1/L2 corriendo localmente, la misma arquitectura que acabás de leer, en miniatura.
- Vas a leer `ArbSys.arbBlockNumber()` — el número de bloque L2 que produce el Sequencer, avanzando mucho más rápido que el bloque L1.
- Vas a leer `ArbGasInfo.getL1BaseFeeEstimate()` — el costo estimado de publicar en L1 del que habla la sección 1, que debería reaccionar cuando generes carga con el workload script.
- La diferencia entre el ritmo de bloques L2 (rapidísimo, soft finality) y L1 (mucho más lento) es exactamente la distinción soft vs hard finality de la sección 2, medida con números reales en vez de en teoría.

## Siguiente

[Module 2.2 — Fraud Proofs & BoLD](./module-2.2-fraud-proofs-bold.md): ahora que sabés cómo Arbitrum ejecuta y publica transacciones, toca ver **cómo se prueba ante L1 que esa ejecución fue correcta** — el mecanismo BoLD.
