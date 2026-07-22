# Block 1 — Ethereum & the EVM

**Subtítulo:** Ecosystem Foundations
**Objetivo:** construir un modelo mental sólido de cómo Ethereum ejecuta código, cómo se conectan las dApps de punta a punta, y qué capas de infraestructura asume el resto del programa como background.

← [Fellowship Cobuilders](../README.md)

## Módulos

- [1.1 — Ethereum Execution Model](./module-1.1-ethereum-execution-model.md) ✅
- [1.2 — Solidity, ABI & Contract Lifecycle](./module-1.2-solidity-abi-contract-lifecycle.md) ✅
- [1.3 — Dev Environment & Tooling](./module-1.3-dev-environment-tooling.md) ✅
- [1.4 — Critical Infrastructure](./module-1.4-critical-infrastructure.md) ✅
- [1.5 — Why L2s Exist](./module-1.5-why-l2s-exist.md) ✅

Los 5 módulos de Block 1 están completos, y el ejercicio de la semana está resuelto en `projects/01-community-vault/` (Foundry + Hardhat, 15 y 11 tests respectivamente).

## Ejercicio de la semana

**01 — Community Vault**
Fuente: [hands-on/01-community-vault.md](https://github.com/CoBuilders-xyz/stylus-fellowship/blob/main/hands-on/01-community-vault.md) (también en el fork local, `hands-on/`)

Contrato de mini-crowdfunding: acepta contribuciones en ETH antes de un deadline, acuña tokens ERC-20 como recibo (1 wei = 1 token), permite `withdraw()` (solo owner, si se alcanzó la meta) y `refund()` (pull pattern, si venció el deadline sin alcanzar la meta).

**Requisitos técnicos:**
- OpenZeppelin: `ERC20`, `Ownable`, `ReentrancyGuard`
- Solidity ≥ 0.8.19
- Patrón checks-effects-interactions (anti-reentrancy)
- Pull pattern para refunds (cada colaborador reclama individualmente)
- Eventos: `ContributionReceived`, `FundsWithdrawn`, `RefundClaimed`

**Entregables:** contrato `CommunityVault` + suite de tests completa (contribuciones, withdraw tras meta, refund post-deadline, rechazos, eventos) + deploy local (Hardhat o Foundry) + README.

**Opcional:** deploy en Arbitrum Sepolia + verificación en explorer, `getStatus()` (Active/Successful/Failed), fuzz testing (Foundry) sobre el invariante refunds totales ≤ balance ETH del contrato.

| Módulo Week 1 | Aplicación en el ejercicio | Nota |
|---|---|---|
| 1.1 Execution Model | `msg.value`, `msg.sender`, mappings, eventos, gas | 1.1 |
| 1.2 Solidity/ABI | ERC-20, `payable`, modifiers, reentrancy, access control | 1.2 |
| 1.3 Tooling | compilación, tests con manipulación temporal (deadline) | 1.3 |
| 1.4 Infraestructura | integración de dependencias OpenZeppelin | 1.4 |

## Live Q&A cubre

Fundamentos de Ethereum, modelo de ejecución de la EVM, patrones de Solidity, setup de tooling.

## Outcomes esperados al cierre de la semana

- Leer y entender un contrato de Solidity de punta a punta
- Compilar y deployar un contrato de ejemplo en un nodo local (Hardhat o Foundry)
- Explicar el modelo de gas y el execution path de la EVM
- Identificar cuándo un dApp design necesita un oracle o un indexer
