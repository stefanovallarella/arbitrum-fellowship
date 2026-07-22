# 01 - Community Vault

A mini crowdfunding contract: contributors send ETH before a deadline and receive `VaultReceipt` (VRT) ERC-20 tokens 1:1 (wei:token) in return. If the funding `goal` is reached, the owner can withdraw everything; if the deadline passes without reaching the goal, each contributor pulls their own refund.

## Contract Overview

`CommunityVault` is itself the ERC-20 receipt token (inherits OpenZeppelin's `ERC20`, `Ownable`, `ReentrancyGuard`).

| Function        | Mutability | Description                                                              |
| ---------------- | ---------- | ------------------------------------------------------------------------ |
| `contribute()`   | payable    | Accepts ETH before the deadline, mints receipt tokens 1:1, emits `ContributionReceived` |
| `withdraw()`     | write      | Owner-only. Sends the full balance to the owner once `goal` is met, emits `FundsWithdrawn` |
| `refund()`       | write      | Pull-pattern refund for a contributor once the deadline passes without the goal being met, emits `RefundClaimed` |
| `getStatus()`    | view       | Returns `"Active"`, `"Successful"` or `"Failed"` |
| `contributions(address)` | view | Amount contributed by a given address |
| `totalRaised()`  | view       | Running total of ETH raised |

### Design notes

- **Checks-effects-interactions**: both `withdraw()` and `refund()` update state (`withdrawn = true`, `contributions[msg.sender] = 0`) *before* making the external ETH transfer, and both are also guarded by `nonReentrant`.
- **Pull over push**: `refund()` requires each contributor to call it individually rather than the contract looping over contributors and pushing ETH — avoids unbounded gas loops and a single failing transfer blocking everyone else.
- **Custom errors** (`ZeroContribution`, `DeadlinePassed`, `DeadlineNotReached`, `GoalNotMet`, `GoalAlreadyMet`, `AlreadyWithdrawn`, `NoContribution`, `TransferFailed`) instead of `require` strings, for cheaper reverts and clearer test assertions.
- **`receive()` reverts** — the only way to fund the vault is through `contribute()`, so `totalRaised` and the actual ETH balance never drift apart.
- Receipt tokens are **not burned on refund** — they remain in the contributor's wallet as a record of having participated, matching the brief's framing of them as "receipt" tokens rather than redeemable shares.

## Prerequisites

- [Node.js](https://nodejs.org) >= 20 (for Hardhat)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for Foundry)

## Project Structure

```
01-community-vault/
├── hardhat/          # Hardhat-based project (TypeScript)
│   ├── contracts/
│   │   └── CommunityVault.sol
│   ├── test/
│   │   └── CommunityVault.test.ts
│   ├── ignition/modules/CommunityVault.ts
│   ├── hardhat.config.ts
│   └── package.json
└── foundry/          # Foundry-based project
    ├── src/
    │   └── CommunityVault.sol
    ├── test/
    │   └── CommunityVault.t.sol
    ├── script/
    │   └── Deploy.s.sol
    └── foundry.toml
```

---

## Hardhat

### Setup

```bash
cd hardhat
npm install
```

> Note: pin `typescript` to the `~5.8` line in `package.json` (already done here). Letting npm resolve an unpinned `typescript` dependency can pull in TypeScript 7.x, which breaks `ts-node`'s config loader (`Cannot read properties of undefined (reading 'fileExists')`).

### Compile

```bash
npx hardhat compile
```

### Test

```bash
npx hardhat test
```

11 tests covering: contribution + minting, event emission, deadline enforcement, owner-only withdrawal after the goal is met, double-withdraw/double-refund protection, refund after a failed deadline, and `getStatus()` transitions. Uses `@nomicfoundation/hardhat-toolbox/network-helpers`'s `time.increaseTo` to fast-forward past the deadline.

### Deploy Locally

Start a local node in one terminal:

```bash
npx hardhat node
```

Deploy in another terminal:

```bash
npx hardhat ignition deploy ./ignition/modules/CommunityVault.ts --network localhost
```

Default parameters: 10 ETH goal, 7-day deadline from deploy time. Override with `--parameters`:

```bash
npx hardhat ignition deploy ./ignition/modules/CommunityVault.ts --network localhost \
  --parameters '{"CommunityVaultModule":{"goal":"5000000000000000000"}}'
```

### Deploy to Arbitrum Sepolia (optional)

```bash
cp .env.example .env   # fill in PRIVATE_KEY
npx hardhat ignition deploy ./ignition/modules/CommunityVault.ts --network arbitrumSepolia
```

---

## Foundry

### Setup

```bash
cd foundry
forge soldeer install
```

Installs `forge-std` and `@openzeppelin-contracts` as soldeer dependencies (see `remappings.txt`).

### Compile

```bash
forge build
```

### Test

```bash
forge test -vv
```

15 tests, including a fuzz test (`testFuzz_refundsNeverExceedContractBalance`, 256 runs) that checks the invariant: the sum of all refunds paid out can never exceed what the contract actually held.

### Deploy Locally

Start Anvil in one terminal:

```bash
anvil
```

Deploy in another terminal:

```bash
forge script script/Deploy.s.sol:DeployCommunityVault \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

Deploys with a 10 ETH goal and a 7-day deadline from the current block timestamp.

### Deploy to Arbitrum Sepolia (optional)

```bash
forge script script/Deploy.s.sol:DeployCommunityVault \
  --rpc-url arbitrum_sepolia \
  --private-key <YOUR_PRIVATE_KEY> \
  --broadcast
```

> **Warning**: Never commit private keys. Use environment variables or a keystore for real deployments.

## Bonus / Stretch Goals Done

- [x] `getStatus()` view returning `Active` / `Successful` / `Failed`.
- [x] Foundry fuzz test on the refund invariant.
- [ ] Deploy to Arbitrum Sepolia + verify (left to the reader — needs a funded testnet key).
