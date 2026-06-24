# 00 - Simple Storage

A minimal Solidity smart contract that stores and retrieves a single `uint256` value. This project serves as the reference example for the fellowship. Every project you submit should follow a similar README structure.

## Contract Overview

`SimpleStorage` exposes two functions:

| Function                | Mutability | Description                                 |
| ----------------------- | ---------- | ------------------------------------------- |
| `store(uint256 _value)` | write      | Stores a new value and emits `ValueChanged` |
| `retrieve()`            | view       | Returns the currently stored value          |

## Prerequisites

- [Node.js](https://nodejs.org) >= 18 (for Hardhat)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for Foundry)

## Project Structure

```
00-simple-storage/
├── hardhat/          # Hardhat-based project (TypeScript)
│   ├── contracts/
│   │   └── SimpleStorage.sol
│   ├── test/
│   │   └── SimpleStorage.test.ts
│   ├── hardhat.config.ts
│   └── package.json
└── foundry/          # Foundry-based project
    ├── src/
    │   └── SimpleStorage.sol
    ├── test/
    │   └── SimpleStorage.t.sol
    └── foundry.toml
```

---

## Hardhat

### Setup

```bash
cd hardhat
npm install
```

### Compile

```bash
npx hardhat compile
```

### Test

```bash
npx hardhat test
```

### Deploy Locally

Start a local node in one terminal:

```bash
npx hardhat node
```

Deploy in another terminal:

```bash
npx hardhat ignition deploy ./ignition/modules/SimpleStorage.ts --network localhost
```

### Deploy to Arbitrum Sepolia (optional)

1. Copy the environment template and fill in your private key:

```bash
cp .env.example .env
```

2. Deploy:

```bash
npx hardhat ignition deploy ./ignition/modules/SimpleStorage.ts --network arbitrumSepolia
```

---

## Foundry

### Setup

```bash
cd foundry
forge soldeer install
```

### Compile

```bash
forge build
```

### Test

```bash
forge test
```

### Deploy Locally

Start Anvil in one terminal:

```bash
anvil
```

Deploy in another terminal:

```bash
forge create src/SimpleStorage.sol:SimpleStorage --rpc-url http://127.0.0.1:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Deploy to Arbitrum Sepolia (optional)

```bash
forge create src/SimpleStorage.sol:SimpleStorage \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key <YOUR_PRIVATE_KEY>
```

> **Warning**: Never commit private keys. Use environment variables or a keystore for real deployments.
