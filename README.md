# OTC Swap and Marketplace

1. **OTCSwap.sol**: An over-the-counter (OTC) swap contract that enables secure, peer-to-peer token exchanges. Key features include:

   - EIP-712 compliant signatures for swap authorization
   - Swap execution and cancellation functions
   - Reentrancy protection

2. **Marketplace.sol**: A decentralized marketplace contract that allows users to list, buy, and sell items. Key features include:
   - User registration with unique usernames
   - Item listing and purchasing functionality
   - Funds withdrawal for sellers

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```
