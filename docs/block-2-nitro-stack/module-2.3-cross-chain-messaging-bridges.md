# Module 2.3 — Cross-chain Messaging & Bridges

← [Block 2 — Arbitrum & the Nitro Stack](./README.md)

**Temas:** Modelo Inbox/Outbox; mensajería parent-child · Retryable tickets, ArbSys, flujo de retiro · Arquitectura del bridge canónico de tokens · Período de desafío e implicancias de UX

**Recursos must:**
- [Cross-chain Messaging Tutorial](https://docs.arbitrum.io/build-decentralized-apps/bridging/cross-chain-messaging) — walkthrough del ejemplo Greeter
- [Token Bridge Overview](https://docs.arbitrum.io/arbitrum-essentials/bridging/overview) — arquitectura del bridge canónico

**Referencia / nice to have:**
- [L1 to L2 Messaging: Retryable Tickets](https://docs.arbitrum.io/how-arbitrum-works/deep-dives/l1-to-l2-messaging) — deep dive de la mecánica de retryable tickets

---

## Glosario nuevo

- **Parent chain / child chain**: la terminología moderna de Arbitrum para lo que veníamos llamando L1/L2 — "parent" (Ethereum) y "child" (Arbitrum). Se usa así porque Arbitrum también soporta L3s ("Orbit chains"), donde una L2 pasa a ser el "parent" de una L3 — el rol es relativo, no absoluto.
- **Retryable ticket**: un mensaje de L1 a L2 empaquetado de forma que, si su primera ejecución en L2 falla (por ejemplo, por quedarse sin gas), pueda **reintentarse** más tarde por cualquiera, en vez de perderse.
- **Address aliasing**: una transformación de dirección que Arbitrum aplica automáticamente cuando un contrato de L1 manda un mensaje a L2, para que el contrato de L2 pueda distinguir "esto vino realmente del contrato X de L1" de "alguien está intentando hacerse pasar por el contrato X".
- **Outbox proof**: la prueba criptográfica que necesitás construir para poder ejecutar en L1 un mensaje que se originó en L2 (la dirección opuesta a un retryable ticket).

## 1. El modelo Inbox/Outbox

Arbitrum comunica L1 y L2 mediante dos contratos con roles opuestos:

- **Inbox** (vive en L1): la puerta de entrada para mensajes que van de **L1 hacia L2**.
- **Outbox** (vive en L1 también, pero recibe pruebas generadas a partir de L2): la puerta de salida para mensajes que van de **L2 hacia L1**.

La asimetría entre ambas direcciones no es casualidad — refleja el modelo de seguridad optimistic que ya conocés: mandar algo *hacia* L2 es relativamente directo (L2 no necesita "confiar" en L1, solo procesar lo que le llega), pero mandar algo *desde* L2 hacia L1 requiere que L1 tenga alguna garantía de que ese mensaje realmente corresponde a un estado válido del rollup — de ahí que este camino pase por el período de desafío.

## 2. L1 → L2: retryable tickets

Cuando un contrato en L1 quiere ejecutar algo en L2 (por ejemplo, un puente que deposita tokens y después quiere que el contrato del otro lado te los acredite), llama al método `createRetryableTicket` del Inbox. Este método necesita tres parámetros clave, que en la práctica calculás con el `ParentToChildMessageGasEstimator` del SDK de Arbitrum:

- **`maxSubmissionCost`**: el costo de publicar los datos del ticket en L2.
- **`gasLimit`**: el gas que va a necesitar la ejecución del lado L2.
- **`maxFeePerGas`**: el precio de gas que estás dispuesto a pagar en L2.

**Flujo normal**: el ticket típicamente se incluye en L2 en cuestión de minutos, y en la mayoría de los casos **se auto-ejecuta ("auto-redeem")** sin que nadie tenga que hacer nada más — es la experiencia por defecto para un depósito simple.

**Cuando algo sale mal**: si la ejecución en L2 revierte o se queda sin gas, el ticket queda en un estado "pendiente de reintento". Ahí es donde entra el precompile `ArbRetryableTx` — su método `redeem(ticketId)` permite que *cualquiera* (no solo el emisor original) vuelva a intentar la ejecución. Esto es importante: significa que un fallo temporal (gas mal estimado, congestión puntual) no te deja los fondos varados para siempre.

**Expiración**: un retryable ticket que nadie reintenta exitosamente **expira a los 7 días** por default, y después de eso ya no se puede redimir.

## 3. L2 → L1: el camino largo, con período de desafío

Cuando un contrato en L2 quiere mandar algo hacia L1 (el caso típico: un retiro), llama a `ArbSys.sendTxToL1(...)` — sí, el mismo precompile `ArbSys` que vas a usar en el ejercicio para leer el número de bloque. Esto encola el mensaje, pero **no lo ejecuta en L1 automáticamente**.

Acá aparece la asimetría que mencionamos en la sección 1: la documentación indica que la confirmación llega **"aproximadamente una semana después"** — el mismo período de desafío que conociste conceptualmente en [Module 1.5](../block-1-ethereum-evm/module-1.5-why-l2s-exist.md) y en el detalle mecánico de [Module 2.2](./module-2.2-fraud-proofs-bold.md) (BoLD). Durante esa ventana, los validadores tienen tiempo de disputar cualquier assertion incorrecta antes de que se considere segura.

Una vez pasado ese período, para efectivamente ejecutar el mensaje en L1 hacen falta dos pasos más:
1. Llamar `constructOutboxProof` en el contrato `NodeInterface` para obtener la prueba criptográfica necesaria.
2. Invocar `executeTransaction` en el contrato `Outbox` de L1, pasando esa prueba, para finalizar la ejecución.

**Implicancia de UX real**: esto es exactamente por qué "retirar de un L2 optimistic" se siente lento comparado con depositar — depositar es casi instantáneo (retryable ticket, auto-redeem), pero retirar implica esperar el período de desafío completo. Es también por qué existen servicios de **"fast withdrawal"** de terceros: te adelantan la plata de inmediato (asumiendo ellos el riesgo y esperando el período completo a cambio tuyo) a cambio de una comisión — el mismo trade-off que ya habías visto mencionado en Module 1.5, ahora con el mecanismo concreto detrás.

## 4. Ejemplo completo: Greeter (contrato en ambos lados)

El tutorial oficial usa un ejemplo simple para atar todo esto: un contrato `Greeter` que guarda un string de saludo, deployado en ambas cadenas.

- **`GreeterParent`** (en Ethereum): tiene `setGreetingInChild`, que empaqueta el nuevo saludo como calldata y lo manda usando un retryable ticket vía el Inbox.
- **`GreeterChild`** (en Arbitrum): tiene `setGreetingInParent`, que llama `ArbSys.sendTxToL1` para encolar un mensaje de vuelta hacia L1.

**El detalle de seguridad más importante del ejemplo** está en `GreeterChild`: su función `setGreeting` sólo acepta llamadas que vengan realmente del contrato `GreeterParent` de L1. Para poder verificar eso, Arbitrum aplica **address aliasing**: cuando un contrato de L1 manda un mensaje cross-chain, el `msg.sender` que ve el contrato de L2 no es la dirección original — es esa dirección **más un offset fijo** (`0x1111000000000000000000000000000000001111`). La librería `AddressAliasHelper` hace esta transformación (y su inversa) por vos. Sin este mecanismo, cualquiera podría intentar llamar a `GreeterChild` haciéndose pasar por `GreeterParent`.

El flujo completo en código: deployás ambos contratos, calculás los parámetros de gas con el estimator, mandás el saludo vía retryable ticket, y esperás la confirmación en L2 (`waitForChildTransactionReceipt`) hasta que el estado del ticket sea `REDEEMED` — ahí ya podés leer el nuevo saludo desde L2.

## 5. El bridge canónico de tokens

Por encima de este mecanismo de mensajería genérico, Arbitrum define un **bridge canónico** para tokens: el mecanismo estándar y "oficial" para mover ETH y tokens ERC-20 entre L1 y L2, construido usando exactamente los primitivos de arriba (retryable tickets para depósitos, el camino Outbox para retiros). Es "canónico" en el sentido de que es el que todas las wallets y exploradores reconocen por default — un token que llega via este bridge es el que ves listado como "el" puente oficial en Arbiscan, a diferencia de bridges de terceros que usan su propio mecanismo (a veces más rápido, pero con supuestos de confianza distintos).

## Conexión con el ejercicio (Nitro Chain Monitor)

Vas a usar `ArbSys` directamente — el mismo precompile de la sección 3, aunque para leer `arbBlockNumber()` en vez de mandar un mensaje a L1. Vale la pena notar la diferencia de rol: en este módulo `ArbSys` aparece como el punto de salida de mensajes L2→L1; en el ejercicio lo usás simplemente como fuente de lectura de estado del rollup. Es el mismo contrato, cumpliendo ambos roles porque vive en la capa ArbOS que administra tanto el estado del chain como su mensajería cross-chain (ver [Module 2.1](./module-2.1-nitro-architecture.md)).

## Siguiente

[Module 2.4 — Building on Arbitrum (EVM)](./module-2.4-building-on-arbitrum-evm.md): el módulo más práctico de la semana — endpoints de red, el modelo de gas de dos dimensiones, y cómo deployar y consultar contratos directamente sobre Arbitrum, cerrando todo lo conceptual con las herramientas que vas a usar en el ejercicio.
