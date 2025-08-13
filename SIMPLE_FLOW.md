# HitMachine - System Flow

## Legal Entities

### Nano LLC (Wyoming - Referral Marketing Company)
* Owns: Jobs Contract
* Business: User acquisition and referral marketing
* Revenue: Earns commissions from Album Sales LLC
* Jurisdiction: Wyoming LLC

### Album Sales LLC (Wyoming - E-commerce Company)
* Owns: Store Contract  
* Business: Sells digital albums
* Obligation: Pays referral commissions to Nano LLC per agreement
* Jurisdiction: Wyoming LLC

## Simple Flow Diagram

```mermaid
flowchart TB
    subgraph NanoCompany[Nano LLC - Referral Company]
        NanoWallet[Nano Wallet]
        JobsContract[Jobs Contract]
    end
    
    subgraph AlbumCompany[Album Sales LLC]
        StoreContract[Store Contract]
    end
    
    Worker[Worker/User]
    
    NanoWallet -->|1. Initial 32 USDC funding| JobsContract
    NanoWallet -->|2. payForJob| JobsContract
    JobsContract -->|3. Pays 32 USDC| Worker
    Worker -->|4. buyAlbums 32 USDC| StoreContract
    StoreContract -.->|5. Revenue accumulates| StoreContract
    NanoWallet -->|6. claimReferralCommissions| StoreContract
    StoreContract -->|7. Sends 32 USDC| JobsContract
    JobsContract -.->|8. Ready for next cycle| NanoWallet
    
    style NanoWallet fill:#ffebee
    style JobsContract fill:#e3f2fd
    style Worker fill:#fff3e0
    style StoreContract fill:#f3e5f5
```

## How It Works

### 1️⃣ **Bootstrap** (One-time)
* Nano company funds Jobs contract with initial USDC
* This provides starting capital for user acquisition

### 2️⃣ **User Acquisition**
```solidity
Jobs.payForJob(workerAddress)
```
* Nano calls this to pay workers 32 USDC
* Workers create and fund user wallets

### 3️⃣ **Album Purchase**
```solidity
Store.buyAlbums()
```
* Users (workers) call this with their 32 USDC
* Automatically purchases 4 albums (at 8 USDC each)
* Revenue accumulates in Store contract

### 4️⃣ **Commission Claim**
```solidity
Store.claimReferralCommissions(jobsAddress, amount)
```
* Nano claims earned commissions from Store
* Directs them to Jobs contract
* Jobs contract now has funds for more workers

### 5️⃣ **Cycle Continues** ♻️

The circular flow:

* Nano LLC pays worker from Jobs contract (32 USDC)
* Worker buys 4 albums from Store (32 USDC = 4 albums @ $8 each)
* Nano LLC claims commission from Store (32 USDC)
* Commission goes back to Jobs contract
* Jobs contract can now pay another worker
* **Circle complete - cycle repeats!**

After initial funding, the system runs on commissions - no additional capital needed!

## Key Points

* 32 USDC = Standard amount throughout the system
* Two Companies: Nano (referral) and Store (sales) with legal agreement
* Self-Sustaining: After initial funding, commissions fund future operations
* Simple Flow: Just 3 main contract calls in the cycle

## Contract Methods

### Jobs Contract
* `payForJob(address worker)` - Pays 32 USDC to worker

### Store Contract  
* `buyAlbums()` - Purchases albums with available USDC
* `claimReferralCommissions(address destination, uint256 amount)` - Nano claims commissions

## Roles

* Nano: Has `JOB_PAYER_ROLE` in Jobs, `COMMISSION_CLAIMER_ROLE` in Store
* Store Admin: Separate entity, manages Store contract
* Users: No special roles, just call `buyAlbums()`