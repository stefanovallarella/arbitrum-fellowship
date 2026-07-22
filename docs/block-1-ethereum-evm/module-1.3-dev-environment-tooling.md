# Module 1.3 — Dev Environment & Tooling

← [Block 1 — Ethereum & the EVM](./README.md)

**Temas:** Hardhat & Foundry: fortalezas, cuándo usar cada uno · Nodos locales & forking de mainnet para tests · JSON-RPC: viem, ethers, wagmi (patrones de frontend) · Wallets: MetaMask, RainbowKit, WalletConnect · Account abstraction (ERC-4337, EIP-7702)

**Recursos must:**
- [Foundry Book](https://book.getfoundry.sh) — leer: Getting Started + secciones de Forge (nodos locales, forking, testing)
- [Connect React to Ethereum with wagmi + viem](https://rocco.me/blog/2026-05-30-connect-react-ethereum-wagmi-viem) — reads/writes tipados, manejo de errores, chain switching
- [Account Abstraction in 2026: EIP-7702 & ERC-4337](https://blog.thirdweb.com/account-abstraction-in-2026-how-eip-7702-and-erc-4337-are-transforming-ethereum-wallets-for-developers/) — qué cambia para la UX de wallets

**Referencia (consultar cuando haga falta):**
- [Hardhat Docs](https://hardhat.org/docs) — skim del Getting Started; referencia para workflows JS/TS

---

## Glosario nuevo

- **Nodo local**: una copia de la blockchain (o una simulación de ella) corriendo en tu propia máquina, para desarrollar y testear sin gastar ETH real ni depender de la red pública.
- **Fork de mainnet**: un nodo local que arranca copiando el estado *real* de una red (ej. Ethereum mainnet o Arbitrum) en un momento dado — así podés testear contra contratos y balances que existen de verdad (ej. Chainlink, Uniswap) sin deployar nada vos.
- **RPC (Remote Procedure Call)**: el protocolo con el que cualquier cliente (tu frontend, un script, una wallet) le habla a un nodo de Ethereum — "leeme el balance de esta dirección", "mandá esta transacción firmada". JSON-RPC es el formato específico que usa Ethereum.
- **Bundler / Paymaster** (account abstraction): un bundler agrupa "intenciones de transacción" de varios usuarios y las manda a la red; un paymaster es un contrato que puede pagar el gas en nombre de otra cuenta (ej. para que el usuario no necesite ETH para su primera transacción).

---

## 1. Hardhat vs Foundry: cuándo usar cada uno

Son las dos suites de desarrollo dominantes hoy, y hacen básicamente lo mismo (compilar, testear, deployar, debuggear) con filosofías distintas:

- **Foundry**: todo en Solidity. Los tests se escriben en `.sol`, no en JS/TS — la ventaja es que pensás y testeás en el mismo lenguaje que escribís los contratos, y es sensiblemente más rápido para correr suites grandes de tests. Se instala con un solo comando (`foundryup`) y trae 4 herramientas:
  - **forge**: compilar y testear
  - **cast**: interactuar con contratos/blockchain desde la terminal (mandar transacciones, leer storage, decodear calldata)
  - **anvil**: tu nodo local — el equivalente Foundry de "una blockchain de prueba en tu máquina"
  - **chisel**: un REPL interactivo de Solidity, para probar expresiones sueltas sin escribir un contrato entero
- **Hardhat**: basado en JavaScript/TypeScript, con un ecosistema de plugins muy maduro. Los tests se escriben en JS/TS usando librerías como ethers o viem para interactuar con los contratos — más natural si tu equipo/proyecto ya vive en el mundo JS/TS (por ejemplo, si el mismo repo tiene el frontend).

**Regla práctica**: el ejercicio de esta semana permite cualquiera de los dos. Foundry suele ser la opción por default hoy en la mayoría de equipos serios de Solidity por velocidad y porque test-en-Solidity reduce el "context switch" entre escribir el contrato y escribir su test — por eso las notas de este fellowship van a usar Foundry como referencia, pero si venís de un stack más JS-heavy, Hardhat es perfectamente válido y quizás más cómodo al principio.

## 2. Nodos locales & forking de mainnet para tests

Cuando corrés `anvil` (o el nodo local equivalente de Hardhat), levantás una blockchain completa pero vacía en tu máquina: sin historial, con un puñado de cuentas pre-cargadas con ETH de prueba, minando bloques instantáneamente. Ahí podés deployar y romper cosas sin costo ni consecuencias.

**Forking** es un paso más: en vez de arrancar vacío, le decís a tu nodo local "copiá el estado real de tal red en tal bloque" (usando un RPC de un proveedor como Alchemy o Infura, o el endpoint público que uses):

```bash
forge test --fork-url https://ethereum.reth.rs/rpc --fork-block-number 18000000
```

Esto te deja testear contra contratos que existen de verdad — por ejemplo, si tu contrato necesita leer un price feed de Chainlink (Module 1.4) o interactuar con un pool de Uniswap, podés hacerlo en tu test local exactamente como pasaría en producción, sin gastar un centavo ni esperar confirmaciones reales. Fijar el `--fork-block-number` además hace que tus tests sean reproducibles: siempre parten del mismo estado exacto.

Para el ejercicio de esta semana en particular vas a usar los **cheatcodes** de Foundry (comandos especiales que solo existen en el entorno de test, no en producción) para simular el paso del tiempo y probar la lógica del `deadline`:

```solidity
vm.warp(block.timestamp + 8 days);  // "viajar en el tiempo" hacia adelante
vm.prank(alice);                     // la próxima llamada la hace "alice", no el test contract
vm.deal(alice, 10 ether);            // darle ETH de prueba a alice
vm.expectRevert("Deadline passed");  // afirmar que la próxima llamada revierte con ese mensaje
```

Sin esto sería imposible testear "qué pasa si pasó el deadline" sin esperar literalmente días reales.

## 3. JSON-RPC: viem, ethers, wagmi (patrones de frontend)

Tu contrato ya deployado no sirve de mucho si nadie puede interactuar con él desde una interfaz normal. Ahí entran las librerías cliente:

- **viem**: la librería de bajo nivel más moderna para hablar JSON-RPC desde JS/TS — reemplazó en gran parte a ethers.js como estándar de facto. Se encarga de cosas como codificar/decodificar ABI (Module 1.2), armar y firmar transacciones, leer logs.
- **ethers.js**: la librería veterana — todavía muy usada, API un poco distinta a viem pero resuelve lo mismo.
- **wagmi**: una capa de hooks de React construida sobre viem — te da `useReadContract`, `useWriteContract`, `useAccount`, etc., con caching y manejo de estado ya resuelto (usa TanStack Query por debajo).

El patrón real para **escribir** en un contrato desde un frontend no es una sola llamada — son dos pasos con dos estados de UI distintos:

1. `useWriteContract` → el usuario confirma en su wallet, te devuelve el **hash** de la transacción (todavía no está confirmada en un bloque).
2. `useWaitForTransactionReceipt` → esperás a que ese hash efectivamente entre en un bloque.

Por eso una buena UI de dApp muestra al menos dos estados distintos ("Confirmá en tu wallet…" → "Procesando…" → "Listo"), no un solo spinner genérico.

Otros detalles que importan en la práctica: usar `parseUnits()`/`formatUnits()` para convertir entre la unidad "humana" (ej. "5 tokens") y la unidad cruda en wei (evita bugs de precisión de punto flotante — recordá de Module 1.1 que la EVM solo entiende enteros), validar direcciones con `isAddress()` antes de mandar cualquier transacción, y separar errores de "el usuario rechazó la transacción en su wallet" de errores reales de ejecución.

## 4. Wallets: MetaMask, RainbowKit, WalletConnect

Una **wallet** es el software que guarda tu clave privada (Module 1.1) y te deja firmar transacciones sin exponerla — es la interfaz humana hacia una EOA.

- **MetaMask**: la wallet de extensión de navegador más usada; expone un objeto `window.ethereum` que las dApps usan para pedir conexión y firmas.
- **WalletConnect**: un protocolo (no una wallet en sí) que conecta tu dApp web con una wallet mobile vía QR code o deep link — así podés usar una wallet de tu celular con una dApp corriendo en tu compu.
- **RainbowKit**: una librería de componentes de UI (botón de "Connect Wallet", modal de selección de wallet, etc.) construida sobre wagmi, para no tener que armar esa interfaz desde cero.

En la práctica, cuando armás el frontend de una dApp no eliges "una" wallet — soportás varias a la vez (MetaMask, WalletConnect, Coinbase Wallet, etc.) y dejás que el usuario elija con cuál conectarse; wagmi + RainbowKit son justamente la combinación estándar hoy para no reimplementar ese selector vos mismo.

## 5. Account abstraction (ERC-4337, EIP-7702)

Recordá de Module 1.1 que hay dos tipos de cuenta: EOA (controlada por clave privada, puede iniciar transacciones) y contract account (código, sin clave, solo reacciona). **Account abstraction** difumina esa frontera: la idea es que tu cuenta *también* sea programable, como un contrato — pudiendo definir sus propias reglas de validación (no solo "una firma ECDSA"), pagar el gas de formas alternativas, o agrupar varias operaciones en una sola transacción.

Dos piezas que resuelven esto, complementarias entre sí:

- **ERC-4337** (2023): construido *encima* del protocolo, sin necesitar ningún cambio en Ethereum mismo. Introduce "smart accounts" (contratos que actúan como tu cuenta), un contrato central **EntryPoint**, y **bundlers** que agrupan operaciones de usuario ("UserOperations") y las mandan a la red — parecido a cómo un validador agrupa transacciones en un bloque, pero para este flujo específico. Ya tiene millones de cuentas desplegadas usándolo.
- **EIP-7702** (2025, upgrade "Pectra"): esta sí es un cambio de protocolo. Permite que una **EOA existente** delegue temporalmente su comportamiento a código de un contrato inteligente, sin migrar de dirección ni desplegar nada nuevo — tu misma wallet de siempre gana capacidades de smart account "prestadas".

No compiten — EIP-7702 es la puerta de entrada para que cuentas EOA ya existentes puedan aprovechar la infraestructura que ERC-4337 ya construyó (bundlers, paymasters). Lo que esto habilita en la práctica: onboarding sin que el usuario necesite ETH de entrada (alguien más paga el gas vía paymaster), agrupar varias acciones en una sola confirmación de wallet, y recuperación de cuenta sin depender únicamente de una seed phrase.

*(Para el ejercicio de esta semana no es necesario — Community Vault se interactúa con EOAs normales — pero es contexto importante para todo lo que sigue en el fellowship, especialmente cuando se hable de UX en Arbitrum.)*

---

## Conexión con el ejercicio (Community Vault)

- Compilación y deploy local → Foundry (`forge build`, `anvil`) o Hardhat, cualquiera de los dos autorizados
- Tests con manipulación temporal del deadline → cheatcodes `vm.warp`, `vm.prank`, `vm.deal`, `vm.expectRevert` (sección 2)
- El README pedido como entregable → documentar cómo correr `forge test` / `forge script` para compilar, testear y deployar

Ver [Block 1](./README.md) para el detalle completo del ejercicio.

## Siguiente

→ [Module 1.4 — Critical Infrastructure](./module-1.4-critical-infrastructure.md)
