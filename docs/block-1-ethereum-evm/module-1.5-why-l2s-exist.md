# Module 1.5 — Why L2s Exist

← [Block 1 — Ethereum & the EVM](./README.md)

**Temas:** Problema de escalabilidad de Ethereum; rollup-centric roadmap · Optimistic vs ZK rollups: tradeoffs de diseño · Data availability, sequencers, fraud proofs · Mapa del ecosistema L2, dónde se ubica Arbitrum

**Recursos must:**
- [Rollups Explained: How Ethereum Layer 2s Work](https://optimism.io/blog/rollups-explained-how-ethereum-layer-2s-work) — cubre los 4 bullets del módulo en un solo artículo

**Referencia / nice to have:**
- [Ethereum Scaling](https://ethereum.org/developers/docs/scaling) — página de referencia de ethereum.org sobre approaches de escalado
- [Rollups — The Ultimate Ethereum Scaling Strategy](https://www.youtube.com/watch?v=7pWxCklcNsU) — video, Arbitrum & Optimism explicados (Finematics)
- [An Incomplete Guide to Rollups](https://vitalik.eth.limo/general/2021/01/05/rollup.html) — el framing original de Vitalik Buterin, sigue siendo el modelo mental más claro

---

## Glosario nuevo

- **TPS (transacciones por segundo)**: la métrica cruda de cuánta capacidad de procesamiento tiene una red.
- **Ventana de desafío (challenge window)**: el período de tiempo después de publicar un resultado durante el cual cualquiera puede disputarlo con una prueba de fraude, antes de que se considere definitivo.
- **Prueba de validez (validity proof)**: una prueba criptográfica que demuestra matemáticamente que un cómputo se hizo correctamente, sin necesidad de volver a ejecutar ese cómputo para verificarlo.

---

## 1. El problema de escalabilidad de Ethereum

Ethereum L1 (la red principal, la que venimos describiendo en todo Block 1) procesa del orden de **15 transacciones por segundo**. Eso está fijado, en gran parte, por una decisión de diseño deliberada: cada nodo de la red tiene que poder re-ejecutar y verificar cada transacción (recordá el determinismo de Module 1.1 — `Y(S,T) = S'` tiene que poder recalcularlo cualquier nodo, no solo los más potentes), así que subir el límite de gas por bloque para procesar más transacciones más rápido significaría que cada vez menos gente podría correr un nodo completo, centralizando la red.

El resultado práctico cuando la demanda supera esa capacidad: la subasta de gas que vimos en Module 1.1 (base fee ajustándose +12.5% por bloque lleno) dispara el precio del gas — transacciones que en condiciones normales cuestan centavos llegaron a costar decenas de dólares en los picos de 2021-2022. Para una aplicación real (no solo para traders con mucho capital), eso es simplemente inutilizable.

## 2. La solución: rollups, y el rollup-centric roadmap

En vez de intentar que L1 procese más transacciones directamente (lo que comprometería la descentralización, como vimos arriba), la estrategia que ganó consenso en la comunidad de Ethereum es: **mové la ejecución a otra capa, y usá Ethereum L1 solo para lo que nadie más puede darte — seguridad y disponibilidad de datos verificable**. Eso es un **rollup**: una blockchain separada que procesa transacciones fuera de L1, las comprime en lotes ("rolls them up") y publica esos lotes de vuelta en Ethereum para que quede registro verificable.

División de responsabilidades:
- **El rollup (L2)** provee velocidad y bajo costo — ahí es donde efectivamente se ejecutan tus transacciones.
- **Ethereum (L1)** provee seguridad — garantiza que, pase lo que pase en el L2, existe una forma de verificar (o disputar) que todo se hizo correctamente, y que los datos necesarios para reconstruir el estado del L2 están disponibles.

Esta estrategia se llama el **rollup-centric roadmap**: durante años se consideró escalar Ethereum L1 directamente vía *sharding* (partir el estado en pedazos procesados en paralelo), pero la comunidad terminó priorizando los rollups como estrategia principal — mantiene la lógica de consenso de L1 más simple, y deja que la innovación en ejecución rápida pase en L2, donde hay mucho más espacio de diseño.

## 3. Optimistic vs ZK rollups: tradeoffs de diseño

Los dos "sabores" de rollup difieren en **cómo le prueban a Ethereum L1 que el nuevo estado que publican es correcto**:

**Optimistic rollups** (la familia a la que pertenece Arbitrum, que van a ver en profundidad en Block 2): asumen que las transacciones son válidas *por defecto* — no mandan ninguna prueba matemática junto con cada lote. En cambio, abren una **ventana de desafío** (típicamente 7 días) durante la cual cualquiera que tenga los datos puede detectar un resultado incorrecto y enviar una **prueba de fraude** a L1 para disputarlo. Ventaja principal: compatibilidad completa con la EVM tal cual la conocés desde Module 1.1-1.2 — el mismo Solidity, los mismos opcodes, sin adaptaciones. Desventaja: los retiros hacia L1 tienen que esperar esa ventana de desafío (o usar un "fast withdrawal" de un tercero que asume el riesgo por vos, a cambio de una comisión).

**ZK rollups** (zero-knowledge): generan una **prueba de validez** criptográfica junto con cada lote — una prueba matemática de que la ejecución fue correcta, verificable por Ethereum L1 en el momento, sin ventana de espera. Ventaja: finalidad casi instantánea. Desventaja histórica: generar esas pruebas para código EVM arbitrario es computacionalmente muy caro y complejo — durante años esto significaba compatibilidad EVM limitada (había que escribir contratos de forma especial, o solo soportaban operaciones específicas), aunque esto viene mejorando rápido con los "zkEVMs".

No hay un ganador universal — es un tradeoff explícito entre "finalidad rápida con más complejidad técnica" (ZK) y "compatibilidad total con más tiempo de espera para retirar" (optimistic).

## 4. Data availability, sequencers, fraud proofs

Tres piezas mecánicas que aparecen en cualquier rollup, y que vas a ver con mucho más detalle en Block 2 (Nitro, BoLD):

- **Data availability (disponibilidad de datos)**: no alcanza con que el rollup diga "confiá en mí, el estado es este" — para que cualquiera pueda *verificar* (o disputar, en el caso optimista) ese estado, los datos de las transacciones tienen que estar públicamente accesibles. La forma estándar hoy es publicarlos en Ethereum L1 mismo, usando **blobs** (un formato de datos introducido específicamente para esto, que redujo el costo de publicar en más de 90% respecto a usar calldata normal). Algunas soluciones alternativas usan redes de disponibilidad de datos externas (como Celestia) para bajar costos aún más, a cambio de un modelo de seguridad distinto — ya no heredan la garantía de disponibilidad directamente de Ethereum L1.
- **Sequencer**: el nodo (o conjunto de nodos) responsable de recibir, ordenar y ejecutar las transacciones del rollup antes de publicarlas a L1. Es la pieza más centralizada típicamente en un rollup hoy — controla el orden de inclusión, lo que le da poder sobre censura y MEV (la capacidad de reordenar transacciones para extraer valor). Gran parte de la investigación actual en rollups (incluido Arbitrum) apunta a descentralizar esta pieza.
- **Fraud proofs (pruebas de fraude)**: el mecanismo que le da sentido a la "ventana de desafío" de los optimistic rollups — un desafío criptográfico verificable en L1 que permite demostrar que un estado publicado por el rollup es incorrecto, sin tener que confiar ciegamente en el sequencer. Van a ver el mecanismo específico de Arbitrum (BoLD) en Block 2.

## 5. Mapa del ecosistema L2, dónde se ubica Arbitrum

El panorama de L2s hoy se organiza, a grandes rasgos, así:

- **Optimistic rollups**: Arbitrum (el más grande por TVL y actividad), Optimism, Base (construido sobre el stack de Optimism)
- **ZK rollups**: zkSync, Starknet, Scroll, Linea, Polygon zkEVM
- Fuera de la familia rollup: **sidechains** (blockchains EVM-compatibles paralelas que no heredan seguridad de L1 directamente, ej. Polygon PoS), **state channels** y **Plasma/Validium** (variantes más antiguas o especializadas, hoy menos centrales en el roadmap)

**Arbitrum** es un optimistic rollup — de ahí que su ventaja competitiva histórica haya sido compatibilidad EVM total desde el día uno (podés tomar literalmente cualquier contrato de Ethereum L1 y deployarlo en Arbitrum sin cambios) y un ecosistema DeFi muy maduro. Es el punto exacto donde termina Block 1 (fundamentos generales de Ethereum) y arranca Block 2: van a abrir la arquitectura interna de Arbitrum específicamente — Nitro (cómo procesa transacciones), BoLD (su mecanismo actual de fraud proofs), y cómo se conecta con L1 vía mensajería cross-chain.

---

## Conexión con el ejercicio (Community Vault)

Este módulo es más conceptual que el resto — no hay una línea de código directa en el contrato. Pero conecta con la mejora opcional del ejercicio: **desplegar en Arbitrum Sepolia** (la testnet de Arbitrum) en vez de (o además de) un nodo local. Ahí vas a experimentar de primera mano lo que este módulo describe en teoría: mismo Solidity, mismo proceso de deploy que conocés de Module 1.2-1.3, pero corriendo sobre una L2 optimistic rollup en vez de sobre Ethereum L1 directamente — y vas a poder comparar el costo de gas real entre ambas.

Ver [Block 1](./README.md) para el detalle completo del ejercicio.

## Siguiente

Con esto se cierran los 5 módulos de Block 1. Ejercicio **01 — Community Vault** resuelto (ver `projects/01-community-vault/` en el repo). Sigue [Block 2 — Arbitrum & the Nitro Stack](../block-2-nitro-stack/README.md), donde se abre la arquitectura interna de Arbitrum: Nitro, BoLD, y mensajería cross-chain.
