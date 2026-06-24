# 00 - Simple Storage

## Objective

Build and deploy a minimal Solidity smart contract to get familiar with the development toolchain. This is a warm-up exercise; the focus is on the workflow, not the contract logic.

## What to Build

A `SimpleStorage` contract that:

1. Stores a single `uint256` value in state.
2. Exposes a `store(uint256)` function to update the value.
3. Exposes a `retrieve()` view function to read the current value.
4. Emits a `ValueChanged(uint256 newValue)` event when the value is updated.

## Deliverables

- [ ] Working contract in Solidity (`>=0.8.19`)
- [ ] At least one test covering store and retrieve
- [ ] Successful local deployment (Hardhat local node or Foundry's Anvil)
- [ ] A project README explaining how to set up, compile, test, and deploy

## Choose Your Toolchain

You may use **Hardhat**, **Foundry**, or both. The example project at [`projects/00-simple-storage`](../projects/00-simple-storage/) includes both variants as a reference.

## Resources

- [Solidity Docs](https://docs.soliditylang.org)
- [Hardhat Getting Started](https://hardhat.org/hardhat-runner/docs/getting-started)
- [Foundry Book](https://book.getfoundry.sh)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
