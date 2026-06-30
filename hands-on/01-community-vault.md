# 01 - Community Vault

## Objective

Build a mini crowdfunding contract that accepts ETH contributions, mints ERC-20 tokens as receipts, and handles fund withdrawal or refunds depending on whether a funding goal is met. This exercise ties together state management, token standards, access control, security patterns, events, and testing with time-dependent logic.

## Context

In exercise 00 you set up tooling and deployed a trivial contract. Now you will work with a contract that has **real moving parts**: it holds ETH, interacts with an ERC-20 token, enforces deadlines, and must protect against common attack vectors. The goal is to see how these Week 1 concepts connect end-to-end in a realistic scenario.

## What to Build

A `CommunityVault` contract that:

1. **Is initialized** with a funding `goal` (in wei) and a `deadline` (unix timestamp).
2. **Accepts ETH contributions** via a `contribute()` payable function. Each contributor receives ERC-20 tokens proportional to their contribution (1 wei = 1 token is fine).
3. **Tracks contributions** per address using a mapping.
4. **Enforces the deadline**: contributions are only accepted before the deadline.
5. **Allows the owner to withdraw** all funds once the goal is reached (`withdraw()`). Only the owner can call this, and it should only succeed if `goal` is met.
6. **Allows contributors to claim refunds** if the deadline passes without reaching the goal (`refund()`). A contributor can only refund once, and they receive their original contribution back.
7. **Emits events** for all key actions:
   - `ContributionReceived(address indexed contributor, uint256 amount)`
   - `FundsWithdrawn(address indexed owner, uint256 amount)`
   - `RefundClaimed(address indexed contributor, uint256 amount)`

### Design Hints

- Inherit from OpenZeppelin's `ERC20`, `Ownable`, and `ReentrancyGuard`.
- The contract itself is the ERC-20 token (it mints tokens to contributors on `contribute()`).
- For refunds, use the **pull pattern**: each contributor calls `refund()` individually rather than the contract pushing ETH to everyone in a loop.
- Update state **before** making external calls (checks-effects-interactions) to prevent reentrancy.

## Deliverables

- [ ] `CommunityVault` contract in Solidity (`>=0.8.19`) using OpenZeppelin
- [ ] Tests covering at minimum:
  - Contributing ETH and receiving tokens
  - Owner withdrawing after goal is met
  - Contributor claiming a refund after deadline (goal not met)
  - Revert when contributing after deadline
  - Revert when owner withdraws before goal is met
  - Event emission for each action
- [ ] Successful local deployment (Hardhat local node or Foundry's Anvil)
- [ ] A project README explaining how to set up, compile, test, and deploy

## Concepts Covered

| Week 1 Module       | What you will practice                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| 1.1 Execution Model | `msg.value`, `msg.sender`, state via mappings, events and logs, gas awareness |
| 1.2 Solidity & ABI  | ERC-20 standard, `payable`, modifiers, visibility, reentrancy, access control |
| 1.3 Tooling         | Compile, test (including time manipulation for deadline), deploy              |
| 1.4 Infrastructure  | OpenZeppelin Contracts as a dependency                                        |

## Bonus (Optional)

- Deploy to **Arbitrum Sepolia** and verify the contract on a block explorer. Compare the gas cost of `contribute()` on the local node vs the L2.
- Add a `getStatus()` view function that returns a human-readable state: `Active`, `Successful`, or `Failed`.
- Write a fuzz test (Foundry) that verifies the invariant: the sum of all refunds can never exceed the contract's ETH balance.

## Choose Your Toolchain

You may use **Hardhat**, **Foundry**, or both.

## Resources

- [Solidity Docs](https://docs.soliditylang.org)
- [OpenZeppelin ERC-20](https://docs.openzeppelin.com/contracts/5.x/erc20)
- [OpenZeppelin Access Control](https://docs.openzeppelin.com/contracts/5.x/access-control)
- [Solidity by Example – Crowd Fund](https://solidity-by-example.org/app/crowd-fund/)
- [Hardhat – Testing with time](https://hardhat.org/docs/reference/json-rpc-methods#hardhat_mine)
- [Foundry – Cheatcodes (vm.warp)](https://book.getfoundry.sh/cheatcodes/)
