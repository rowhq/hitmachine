# REFERRAL COMMISSION AGREEMENT

**EFFECTIVE DATE**: [DATE]

**BETWEEN**:

**Album Sales LLC** ("Company")  
A Wyoming Limited Liability Company  
Address: [Company Address]  
Registered Agent: [Registered Agent Name & Address]  
Tax ID: [EIN]

**AND**

**Nano LLC** ("Referral Partner")  
A Wyoming Limited Liability Company  
Address: [Referral Partner Address]  
Registered Agent: [Registered Agent Name & Address]  
Tax ID: [EIN]

## RECITALS

WHEREAS, Company operates a digital album sales platform on the Sophon blockchain network through smart contract address [Store Contract Address] ("Store Contract");

WHEREAS, Referral Partner operates a user acquisition and referral marketing business through smart contract address [Jobs Contract Address] ("Jobs Contract");

WHEREAS, Company desires to engage Referral Partner to provide user acquisition services and pay commissions for successful referrals;

WHEREAS, both parties wish to establish a transparent, blockchain-enforced commission structure;

NOW, THEREFORE, in consideration of the mutual covenants and agreements contained herein, the parties agree as follows:

## 1. DEFINITIONS

1.1 **"Album"** means digital music albums sold through the Store Contract at a price of 8 USDC per album.

1.2 **"Referred User"** means any user acquired through Referral Partner's marketing efforts who purchases Albums.

1.3 **"Commission"** means the percentage of revenue from Album sales payable to Referral Partner.

1.4 **"Smart Contract Implementation"** means the on-chain execution of this agreement through the Store and Jobs contracts.

## 2. REFERRAL SERVICES

2.1 **Scope of Services**: Referral Partner shall:
- Identify and acquire potential customers for Company's Albums
- Fund user wallets to enable Album purchases
- Maintain the Jobs Contract for user acquisition operations
- Comply with all applicable marketing and advertising laws

2.2 **Independent Contractor Status**: Referral Partner is an independent contractor, not an employee, partner, or joint venturer of Company.

## 3. PROMOTIONAL COMMISSION STRUCTURE

3.1 **Tiered Commission Schedule**:

The parties agree to the following promotional commission structure based on cumulative commissions claimed:

| Cumulative Claimed | Commission Rate | Revenue Range |
|-------------------|-----------------|---------------|
| $0 - $50M | 100% | First $50 million |
| $50M - $60M | 90% | Next $10 million |
| $60M - $70M | 80% | Next $10 million |
| $70M - $80M | 70% | Next $10 million |
| $80M - $90M | 60% | Next $10 million |
| $90M - $100M | 50% | Next $10 million |
| $100M - $110M | 40% | Next $10 million |
| $110M - $120M | 30% | Next $10 million |
| $120M - $130M | 20% | Next $10 million |
| $130M - $140M | 10% | Next $10 million |
| Above $140M | 0% | No further commission |

3.2 **Rationale**: This promotional structure incentivizes aggressive early user acquisition while ensuring Company profitability at scale.

3.3 **Smart Contract Enforcement**: The commission structure is programmatically enforced through the Store Contract's `getCurrentCommissionRate()` function.

## 4. COMMISSION PAYMENT

4.1 **Claiming Process**: 
- Referral Partner may claim commissions by calling `claimReferralCommissions()` on the Store Contract
- Only the wallet address with `COMMISSION_CLAIMER_ROLE` may claim commissions
- Commissions are calculated based on the current tier at time of claim

4.2 **Payment Currency**: All commissions are paid in USDC on the Sophon network.

4.3 **No Minimum Threshold**: Commissions may be claimed at any time without minimum threshold.

4.4 **Destination Flexibility**: Referral Partner may direct commission payments to any address, including the Jobs Contract.

## 5. ROLES AND PERMISSIONS

5.1 **Store Contract Roles**:
- Company maintains `ADMIN_ROLE` and operational control
- Referral Partner is granted `COMMISSION_CLAIMER_ROLE`

5.2 **Jobs Contract Roles**:
- Referral Partner maintains full control and all administrative roles
- Company has no roles or permissions in Jobs Contract

5.3 **Role Modifications**: Any changes to roles require mutual written consent.

## 6. TRACKING AND REPORTING

6.1 **On-Chain Transparency**: All transactions are publicly verifiable on the Sophon blockchain.

6.2 **Metrics Tracked**:
- Total revenue (`totalRevenue` in Store Contract)
- Total commissions claimed (`totalCommissionsClaimed` in Store Contract)
- Current commission rate (`getCurrentCommissionRate()` function)

6.3 **Audit Rights**: Both parties have the right to audit blockchain records at any time.

## 7. TERM AND TERMINATION

7.1 **Term**: This Agreement commences on the Effective Date and continues until:
- Total commissions claimed reach $140 million, OR
- Terminated by mutual written consent

7.2 **Effect of Termination**: 
- Referral Partner retains the right to claim accrued commissions
- Smart contract permissions must be revoked through on-chain transactions

7.3 **Survival**: Sections 8 (Confidentiality), 9 (Intellectual Property), and 11 (Indemnification) survive termination.

## 8. CONFIDENTIALITY

8.1 Each party shall maintain the confidentiality of the other party's proprietary information.

8.2 This obligation does not apply to information that is:
- Publicly available
- Already known to the receiving party
- Required to be disclosed by law

## 9. INTELLECTUAL PROPERTY

9.1 **Company IP**: All Album content and Store Contract code remain Company's property.

9.2 **Referral Partner IP**: Jobs Contract code and user acquisition methods remain Referral Partner's property.

9.3 **License Grant**: Each party grants the other a limited license to use its trademarks solely for performing this Agreement.

## 10. REPRESENTATIONS AND WARRANTIES

Each party represents and warrants that:
- It has full authority to enter this Agreement
- It will comply with all applicable laws
- It will not infringe any third-party rights
- It maintains appropriate licenses for its operations

## 11. INDEMNIFICATION

11.1 Each party shall indemnify and hold harmless the other party from claims arising from:
- Its breach of this Agreement
- Its negligence or willful misconduct
- Its violation of applicable laws

## 12. LIMITATION OF LIABILITY

12.1 Neither party shall be liable for indirect, incidental, or consequential damages.

12.2 Each party's maximum liability shall not exceed the total commissions paid in the 12 months preceding the claim.

## 13. DISPUTE RESOLUTION

13.1 **Negotiation**: Parties shall first attempt to resolve disputes through good faith negotiation.

13.2 **Arbitration**: Unresolved disputes shall be submitted to binding arbitration under JAMS rules.

13.3 **Venue**: Arbitration shall occur in Wyoming or via remote proceedings.

13.4 **Smart Contract Disputes**: Code execution on-chain is final and binding.

## 14. GENERAL PROVISIONS

14.1 **Entire Agreement**: This Agreement constitutes the entire agreement between the parties.

14.2 **Amendment**: Modifications must be in writing and signed by both parties.

14.3 **Governing Law**: This Agreement is governed by Wyoming law.

14.4 **Severability**: Invalid provisions shall be severed without affecting remaining terms.

14.5 **Force Majeure**: Neither party is liable for delays due to circumstances beyond its control.

14.6 **Notices**: All notices shall be sent to the addresses listed above.

14.7 **Blockchain Supremacy**: In case of conflict between this document and smart contract execution, the smart contract code governs technical implementation while this agreement governs legal intent.

## SIGNATURES

**ALBUM SALES LLC**

By: _________________________  
Name: [Name]  
Title: [Title]  
Date: _____________

**NANO LLC**

By: _________________________  
Name: [Name]  
Title: [Title]  
Date: _____________

---

## EXHIBIT A: SMART CONTRACT ADDRESSES

Store Contract: [Address]  
Jobs Contract: [Address]  
USDC Token: 0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F  
Network: Sophon (Chain ID: 50104)

## EXHIBIT B: COMMISSION CALCULATION EXAMPLE

If total commissions claimed = $55M and current balance = $1M:
- Current tier: 90% (in the $50M-$60M range)
- Claimable amount: $1M × 90% = $900,000
- Remaining for Company: $100,000