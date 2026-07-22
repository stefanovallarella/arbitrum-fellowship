# Walkthrough — Community Vault paso a paso

Este documento no es la referencia técnica (para eso está el `README.md`) — es el repaso narrado de **qué hicimos, en qué orden, y por qué**, la primera vez que probamos el contrato a mano desde el navegador. Sirve para volver a entender los conceptos aplicados a la práctica, no solo leídos en la teoría de [Block 1](../../docs/block-1-ethereum-evm/README.md).

## El panorama: 4 capas hablando entre sí

```
Tu click en un botón de la página
   → página web (web/index.html, JS + ethers.js)
      → MetaMask (firma la transacción)
         → nodo Hardhat local (ejecuta el EVM)
            → contrato CommunityVault (cambia su estado)
```

Cada capa solo le habla a la de al lado. La página nunca toca el contrato directamente — siempre pasa por MetaMask, que es quien tiene la private key y puede autorizar algo en tu nombre.

## Paso 1 — Levantar la blockchain local

```bash
cd hardhat && npx hardhat node
```

Esto arranca una blockchain de prueba en `http://127.0.0.1:8545`, con 20 cuentas precargadas con 10.000 ETH de mentira cada una. No es una simulación aparte — es un nodo Ethereum real (el mismo motor que usa Hardhat para testear), solo que privado y descartable.

## Paso 2 — Deployar el contrato

```bash
npx hardhat ignition deploy ./ignition/modules/CommunityVault.ts --network localhost --parameters '...'
```

Esto sube el bytecode compilado de `CommunityVault.sol` a esa blockchain local, con un `goal` y un `deadline` concretos pasados como parámetros del constructor. A partir de acá el contrato existe en una dirección fija (ej. `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`) y cualquiera que tenga esa dirección puede interactuar con él.

**Detalle real que nos pasó**: la primera vez pusimos un `deadline` de solo 10 minutos, pensando que alcanzaba para el setup de MetaMask. No alcanzó — armar una wallet desde cero (crear cuenta, agregar red, importar cuenta de prueba) llevó más que eso, y cuando llegamos a `contribute()` el contrato lo rechazó. Nada raro: el contrato hizo exactamente lo que tenía que hacer. Solución: redeployar con un deadline más largo (1 hora) para tener margen real de prueba.

## Paso 3 — MetaMask: crear cuenta, agregar red, importar cuenta de prueba

MetaMask, apenas instalado, no tiene ninguna cuenta ni conoce tu red local. Tres cosas separadas:

1. **Crear la wallet** (obligatorio la primera vez): genera una private key + frase de recuperación de 12 palabras. Esta wallet en sí no la usamos para nada — es el "contenedor" que necesita MetaMask para funcionar.
2. **Agregar la red `Hardhat Local`** (RPC `http://127.0.0.1:8545`, Chain ID `31337`): sin esto, MetaMask ni sabe que tu nodo existe. El Chain ID es el número que identifica de forma única cada blockchain — Ethereum mainnet es `1`, Arbitrum One es `42161`, Hardhat usa `31337` por convención.
3. **Importar una cuenta de Hardhat por private key**: tu wallet nueva tiene 0 ETH incluso en la red local (porque vos la generaste, no es una de las 20 que Hardhat precarga). Importamos la private key `0xac0974...2ff80` — es pública y conocida, Hardhat siempre genera las mismas 20 cuentas de prueba, por eso es segura de compartir (nunca la usarías en una red real).

Esta cuenta importada resultó ser la **misma** que deployó el contrato — por eso, sin buscarlo, terminamos siendo la "owner" del `CommunityVault` desde el arranque.

## Paso 4 — Servir la página y conectar

```bash
cd web && npx serve -l 5173 .
```

`web/index.html` es un archivo estático sin build (JS plano + `ethers.js` cargado desde un CDN). Necesita servirse por HTTP (no abrir como `file://`) porque MetaMask exige un origen web real para inyectar `window.ethereum`.

Al pegar la dirección del contrato y clickear **"Conectar wallet"**:
```js
provider = new ethers.BrowserProvider(window.ethereum);
const accounts = await provider.send("eth_requestAccounts", []);
```
Esto le pide permiso a MetaMask para ver tu cuenta — MetaMask te muestra un popup de "¿autorizás a este sitio?". Una vez aceptado, la página empieza a **leer** el contrato: `goal()`, `deadline()`, `getStatus()`, etc. Son lecturas (`eth_call`), no cuestan gas ni piden firma — por eso no hay más popups en este paso.

## Paso 5 — `contribute()`: la primera escritura real

Al poner `1.0` en el campo y clickear **Contribute**:
```js
const tx = await contract.contribute({ value: ethers.parseEther("1.0") });
await tx.wait();
```

A diferencia de leer, esto **cambia el estado de la blockchain** — necesita tu firma. MetaMask te mostró el popup de confirmación (con el gas estimado), vos aceptaste, y ahí:

1. MetaMask firmó la transacción con la private key importada.
2. La transacción viajó al nodo Hardhat.
3. El nodo ejecutó el bytecode del contrato — literalmente esta lógica de `CommunityVault.sol`:
   ```solidity
   function contribute() external payable {
       if (block.timestamp >= deadline) revert DeadlinePassed();
       if (msg.value == 0) revert ZeroContribution();

       contributions[msg.sender] += msg.value;   // tu mapping pasó a 1 ETH
       totalRaised += msg.value;                 // el contador global subió a 1 ETH

       _mint(msg.sender, msg.value);             // te acuñó 1 VRT
       emit ContributionReceived(msg.sender, msg.value);
   }
   ```
   Acá `msg.sender` es tu dirección (la que firmó) y `msg.value` es el ETH que mandaste — los mismos conceptos de [Module 1.1](../../docs/block-1-ethereum-evm/module-1.1-ethereum-execution-model.md), ahora con datos reales tuyos en vez de teoría.
4. El estado cambió **de verdad, on-chain**: `totalRaised` pasó de `0` a `1.0 ETH`. Eso no vive en la página ni en MetaMask — vive en el storage del contrato, en el nodo. Cerrar el navegador no lo borra.
5. `getStatus()` recalculó solo, sin guardar ningún flag: `if (totalRaised >= goal) return "Successful";` — como pusiste exactamente el goal, pasó a `Successful`.

## El bug real que encontramos (y por qué fue valioso)

En una prueba posterior, `contribute()` falló con: `execution reverted (unknown custom error)`. En vez de asumir, lo diagnosticamos:

1. Reprodujimos el error directamente con un script de Node/ethers contra el contrato.
2. Capturamos el selector crudo del revert: `0x70f65caa`.
3. Calculamos el selector de cada error custom del contrato (`ethers.id("DeadlinePassed()").slice(0,10)`) y comparamos — coincidía exactamente con `DeadlinePassed()`.

Conclusión: no era un bug del contrato ni de la UI — el deadline de 10 minutos había vencido mientras armábamos MetaMask. Lo que sí era una falla real de la UI: el ABI que le pasamos a `ethers.Contract` no incluía la lista de errores custom (`error DeadlinePassed()`, etc.), así que ethers no podía traducir el selector a un nombre — mostraba "unknown custom error" en vez de "DeadlinePassed". Lo arreglamos agregando las definiciones de error al ABI y un diccionario de mensajes legibles (`ERROR_MESSAGES` en `web/index.html`).

**Lección**: un mensaje de error críptico en una dApp casi siempre se puede decodificar — el revert data (`0x70f65caa...`) es información pública en la blockchain, no hace falta adivinar.

## Paso 6 — `withdraw()`: el camino "éxito"

Con `totalRaised >= goal` y siendo la cuenta owner:
```solidity
function withdraw() external onlyOwner nonReentrant {
    if (totalRaised < goal) revert GoalNotMet();
    if (withdrawn) revert AlreadyWithdrawn();
    withdrawn = true;                    // effects primero...
    (bool success,) = owner().call{value: amount}("");  // ...interaction después
    emit FundsWithdrawn(owner(), amount);
}
```
Al ser la cuenta owner, funcionó directo. El patrón **checks-effects-interactions** ([Module 1.2](../../docs/block-1-ethereum-evm/module-1.2-solidity-abi-contract-lifecycle.md)) es literal acá: `withdrawn = true` se escribe *antes* de mandar el ETH, para que una eventual reentrancy no pueda volver a entrar y retirar dos veces.

## Paso 7 — `refund()`: el camino "fracaso" (necesitó un contrato nuevo)

El contrato que ya usamos tenía `status = Successful` — pedirle `refund()` ahí siempre iba a fallar con `GoalAlreadyMet`, por diseño (no tiene sentido reembolsar una campaña exitosa). Para ver el otro camino, deployamos una **tercera instancia** con un goal inalcanzable (5 ETH) y un deadline de 60 segundos:

1. Contribuimos algo chico (0.5 ETH, muy por debajo del goal).
2. Esperamos que pasen los 60 segundos sin que nadie más contribuya.
3. `getStatus()` pasó de `Active` a `Failed` (venció el deadline, nunca se llegó al goal).
4. `refund()` funcionó — nos devolvió el 0.5 ETH, usando el mismo patrón pull (cada quien reclama el suyo, el contrato no empuja ETH a nadie).

Si hubiéramos llamado `refund()` antes de los 60 segundos: `DeadlineNotReached`. Si el goal se hubiera cumplido: `GoalAlreadyMet`. Cada rama del contrato tiene su propio camino de prueba — no alcanza con un solo deploy para ver los tres estados (`Active`/`Successful`/`Failed`).

## Para repasar rápido

| Qué vimos | Dónde en el contrato | Concepto de Block 1 |
|---|---|---|
| Firma de transacción | MetaMask, antes de cualquier `write` | Private key / cuentas |
| `msg.sender`, `msg.value` | `contribute()` | [Module 1.1](../../docs/block-1-ethereum-evm/module-1.1-ethereum-execution-model.md) — execution model |
| Custom errors + revert data | Todo el contrato | [Module 1.2](../../docs/block-1-ethereum-evm/module-1.2-solidity-abi-contract-lifecycle.md) — ABI encoding |
| Checks-effects-interactions | `withdraw()`, `refund()` | [Module 1.2](../../docs/block-1-ethereum-evm/module-1.2-solidity-abi-contract-lifecycle.md) — reentrancy |
| Pull pattern | `refund()` | Deliverable del brief original |
| Lecturas vs escrituras (`eth_call` vs tx firmada) | `getStatus()` vs `contribute()` | [Module 1.1](../../docs/block-1-ethereum-evm/module-1.1-ethereum-execution-model.md) |
