# Module 2.2 — Fraud Proofs & BoLD

← [Block 2 — Arbitrum & the Nitro Stack](./README.md)

**Temas:** Repaso del modelo de seguridad optimistic rollup · Assertions, validadores, bonds: qué se publica en L1 · BoLD: pruebas de fraude interactivas, permissionless y time-bounded

**Recursos must:**
- [BoLD: A Gentle Introduction](https://docs.arbitrum.io/how-arbitrum-works/bold/gentle-introduction) — empezar acá

**Referencia / nice to have:**
- [BoLD: Technical Deep Dive](https://docs.arbitrum.io/how-arbitrum-works/bold/bold-technical-deep-dive) — mecánica completa del protocolo
- [BoLD: Fast and Cheap Dispute Resolution](https://arxiv.org/pdf/2404.10491) — paper académico
- [Fraud Proof Protocols: BoLD, Dave, and other alternatives](https://research.arbitrum.io/t/fraud-proof-protocols-bold-dave-and-other-alternatives/9748) — Arbitrum Research

---

## Glosario nuevo

- **Assertion**: la afirmación de un validador de que "el estado del rollup avanzó de A a Z". No es solo una opinión — viene acompañada de un **bond** (depósito en garantía) que se pierde si la afirmación resulta ser falsa.
- **Bond**: plata que un participante deposita como garantía de que está diciendo la verdad. Si tiene razón, la recupera íntegra; si miente, la pierde por completo. Es el mecanismo económico que reemplaza a "confiar" en alguien — no necesitás confiar en el validador, necesitás que tenga algo que perder si te miente.
- **Bisección (bisection)**: la técnica de resolver una disputa dividiendo repetidamente el rango en disputa a la mitad, en vez de reproducir todo el cómputo de una. Es el mismo principio que una búsqueda binaria: si dos partes no coinciden en el resultado de ejecutar 1 millón de pasos, no hace falta re-ejecutar el millón — alcanza con ir partiendo al medio hasta encontrar el primer paso puntual donde discrepan.
- **One-step proof**: una vez que la bisección aisló la disputa a un único paso de ejecución, ambas partes envían una prueba criptográfica de cuál creen que es el resultado de *ese paso específico* — y Ethereum L1 lo ejecuta él mismo para desempatar.
- **Watchtower node**: un nodo que solo mira la cadena para detectar afirmaciones inválidas, sin necesidad de fondos propios — es el rol que le permite a "cualquiera" participar en la vigilancia de la red, no solo a validadores con capital bonded.

## 1. Repaso: el modelo de seguridad optimistic (y su problema original)

Como vimos en [Module 1.5](../block-1-ethereum-evm/module-1.5-why-l2s-exist.md), un optimistic rollup como Arbitrum asume que las transacciones son válidas por defecto, y abre una **ventana de desafío** (challenge period) durante la cual cualquiera puede probar que una afirmación es falsa. El sistema *anterior* de Arbitrum para esto tenía dos problemas concretos:

1. **Solo un conjunto de validadores permitidos (allowlisted)** podía abrir disputas — no era realmente permissionless.
2. **Vulnerable a "delay attacks"**: un atacante podía abrir disputas continuamente (perdiendo el bond cada vez, pero teniendo plata para sostenerlo) para extender indefinidamente el período de challenge — en la práctica, esto podía trabar los retiros de Arbitrum One (normalmente ~7 días) por mucho más tiempo del esperado.

**BoLD** ("Bounded Liquidity Delay") es el rediseño de este mecanismo, activo en Arbitrum One desde 2024, que resuelve ambos problemas.

## 2. Assertions: cómo se afirma el estado del rollup ante L1

Un validador toma la última assertion confirmada (llamémosla bloque A) y afirma: "aplicando la State Transition Function determinística a las transacciones que siguieron, el estado llega a Z". Esta afirmación va acompañada de un bond.

Para Arbitrum One, los montos concretos son:
- **Bond de assertion** (el que paga un "proposer", el rol de mayor responsabilidad): **3,600 ETH**.
- **Bonds de sub-challenge**, en cada nivel de la disputa: entre **555 y 79 ETH**, sumando aproximadamente **1,110 ETH** para resolver una disputa completa.

Estos montos son altos a propósito — es lo que hace económicamente irracional mentir. Si te preocupa que esto centralice quién puede participar: existen **bonding pools**, donde múltiples participantes juntan fondos sin necesidad de confiar entre sí (el contrato garantiza el reparto correcto), democratizando el acceso a ese capital.

Si alguien no está de acuerdo con el estado Z afirmado, abre una disputa afirmando un estado alternativo Y, bonding capital también. Ahí arranca el proceso de resolución.

## 3. El proceso de bisección: cómo se resuelve una disputa sin re-ejecutar todo

Re-ejecutar millones de transacciones en L1 para resolver una disputa sería prohibitivamente caro. En cambio, BoLD usa un proceso interactivo de **bisección** en varios niveles, cada uno más granular que el anterior:

1. **Bisección a nivel de bloques**: las partes van partiendo al medio el rango de bloques en disputa, turnándose, hasta aislar el bloque específico donde discrepan.
2. **Bisección "big-step"**: dentro de ese bloque, bisectan rangos de instrucciones de la State Transition Function (que corre en WASM, como vimos en [Module 2.1](./module-2.1-nitro-architecture.md)) hasta aislar un rango de **2^20 pasos** que contiene la discrepancia.
3. **Bisección "one-step"**: siguen bisectando hasta aislar un único paso de ejecución puntual donde efectivamente discrepan.
4. **One-step proof**: ambas partes envían una prueba criptográfica de cuál creen que es el resultado de ese paso único al contrato `OneStepProof` en Ethereum. **Ethereum ejecuta ese paso él mismo**, valida las pruebas, y declara un ganador.
5. **Confirmación en cascada**: una vez confirmado el "edge" (fragmento de historia en disputa) de nivel más bajo, la confirmación se propaga hacia arriba por todos los edges padres, hasta confirmar la assertion de nivel superior como correcta.

**Analogía**: es exactamente el juego de "adiviná el número" con búsqueda binaria — en vez de listar uno por uno todos los números del 1 al millón, preguntás "¿es mayor a 500 mil?" y descartás la mitad en cada ronda. BoLD hace lo mismo pero para aislar el primer punto exacto de un desacuerdo computacional, y el "número" a adivinar es literalmente el paso de ejecución donde dos réplicas del mismo programa determinístico dieron resultados distintos.

## 4. Por qué "permissionless" y por qué "time-bounded"

**Permissionless**: no hay lista de validadores autorizados. Cualquier entidad puede: detectar una assertion inválida (correr un watchtower node no requiere fondos propios), abrir una disputa (usando bonding pools si no tiene el capital solo), y participar ganando el reembolso de su bond si tiene razón.

**Time-bounded**: acá está la solución al delay attack original. En cada etapa de la bisección corre un timer que avanza hacia un período de desafío T (**6.4 días** por default). El timer arranca cuando una parte publica su commitment bisectado, y se detiene cuando el rival responde. Si el timer llega a T sin respuesta, **el edge se confirma automáticamente** — no hace falta que nadie "gane" activamente, el silencio pierde. Esto elimina por diseño la posibilidad de extender la disputa indefinidamente: en el peor caso, todo el proceso se resuelve dentro de **~6.4 días + 2 días de gracia** para que el Security Council pueda intervenir si hiciera falta, sin importar cuántos atacantes maliciosos participen en paralelo.

Además, a diferencia del sistema viejo (disputas 1-vs-1 secuenciales, "torneo"), BoLD permite disputas **todos-contra-todos en paralelo** ("battle royale"): pueden competir múltiples challengers simultáneamente sobre la misma assertion, y matemáticamente, un único participante honesto con capital bonded a la afirmación correcta siempre termina prevaleciendo contra cualquier cantidad de adversarios maliciosos — porque el proceso de bisección siempre converge al paso real donde la ejecución determinística difiere, y ahí gana quien tiene razón.

## Conexión con el ejercicio (Nitro Chain Monitor)

Este módulo es principalmente conceptual — no vas a disparar una disputa BoLD real corriendo el testnode local (el testnode corre en modo dev, sin el mecanismo de challenge activo). Pero conecta directo con lo que sí vas a medir: la brecha entre el bloque L2 (que avanza con soft finality, confiando en el Sequencer) y el bloque L1 (que solo confirma con retraso) es precisamente la ventana durante la cual, en producción, BoLD podría estar resolviendo una disputa si alguna assertion fuera cuestionada. Entender BoLD te da el "por qué" de esa ventana de tiempo que vas a ver reflejada en los números del monitor.

## Siguiente

[Module 2.3 — Cross-chain Messaging & Bridges](./module-2.3-cross-chain-messaging-bridges.md): ahora que entendés cómo se prueba el estado de Arbitrum ante L1, toca ver **cómo viajan mensajes y valor entre L1 y L2** — el mecanismo que hace posible depositar, retirar, y llamar contratos de una cadena a la otra.
