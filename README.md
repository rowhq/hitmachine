# HitMachine

A blockchain-based album purchase system built on the Sophon network using upgradeable smart contracts.

## Overview

HitMachine enables users to purchase albums using USDC on the Sophon network. The system features:
- UUPS upgradeable smart contracts for future improvements
- Role-based access control for secure fund management
- Integrated Next.js frontend with API endpoints
- Automated CI/CD with Claude Code reviews

## Architecture

### Smart Contracts
- **StoreV2**: Handles album purchases at configurable prices
- **JobsV2**: Manages fund distribution and claims from Store

### Frontend
- Next.js application with integrated API routes
- Support for wallet generation and album purchases
- Real-time balance checking

## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
