# 02 - Nitro Chain Monitor

## Objective

Spin up the Nitro testnode, build a tool that reads chain metrics from Arbitrum precompiles and RPC, and display those metrics while generating load on the chain.

## What to Build

1. **Start the Nitro testnode** — L1 on `:8545`, L2 on `:8547`.
2. **Write a monitor** (any language) that polls these data points every few seconds:
   - L2 block number — `ArbSys(0x64).arbBlockNumber()`
   - L1 block number — `eth_blockNumber` on the L1 node
   - L1 base fee — `ArbGasInfo(0x6C).getL1BaseFeeEstimate()`
   - L2 gas price — `ArbGasInfo(0x6C).getMinimumGasPrice()`
   - Block fill — `gasUsed / gasLimit` from `eth_getBlockByNumber`
3. **Run the workload script** (provided in the project folder) to deploy contracts and send bursts of transactions while the monitor is running.
4. **Display the results** — terminal, HTML page, JSON dump, CSV, whatever you prefer. The output should make it obvious how L2 blocks, gas prices, and block fill behaved before, during, and after the workload.

## Precompile Reference

| Precompile | Address | Function | Selector |
| ---------- | ------- | -------- | -------- |
| ArbSys | `0x64` | `arbBlockNumber()` | `0xa3b1b31d` |
| ArbSys | `0x64` | `arbChainID()` | `0xd127f54a` |
| ArbGasInfo | `0x6C` | `getL1BaseFeeEstimate()` | `0xf5d6ded7` |
| ArbGasInfo | `0x6C` | `getMinimumGasPrice()` | `0xf918379a` |
| ArbGasInfo | `0x6C` | `getPricesInWei()` | `0x41b247a8` |

All precompiles are queried via `eth_call` against the L2 node.

## Deliverables

- [ ] Nitro testnode running locally
- [ ] Monitor tool that polls and displays the metrics listed above
- [ ] Workload execution (use the provided script or write your own)
- [ ] Output showing metrics before, during, and after load
- [ ] Project README: how to run, what you observed

## Bonus

- Connect the same monitor to **Arbitrum Sepolia** (`https://sepolia-rollup.arbitrum.io/rpc`) and compare against the testnode.
- Query `NodeInterface(0xC8).gasEstimateL1Component()` to break down L1 gas cost per transaction.
- Add real-time visualization (charts, sparklines, progress bars).

## Concepts Covered

| Week 2 Module             | What you practice                                              |
| ------------------------- | ---------------------------------------------------------------- |
| 2.1 Nitro Architecture    | Run the Nitro stack locally; observe sequencer behavior        |
| 2.2 Fraud Proofs & BoLD   | See L2 block production rate vs L1 finality                    |
| 2.3 Cross-chain Messaging | ArbSys interface; L1/L2 block relationship                     |
| 2.4 Building on Arbitrum  | Precompile queries, two-dimensional gas model, RPC interaction |

## Resources

- [Nitro Testnode](https://github.com/OffchainLabs/nitro-testnode)
- [Precompiles Reference](https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference)
- [Gas Estimation on Arbitrum](https://docs.arbitrum.io/build-decentralized-apps/how-to-estimate-gas)
- [Foundry Cast Reference](https://book.getfoundry.sh/reference/cast/)
