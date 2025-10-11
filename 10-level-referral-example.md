# 10-Level Referral Commission System

## How it Works

When a user invests $10 and earns 100 JRC coins, commissions are distributed across up to 10 levels of referrers.

## Commission Structure

| Level | USDT Rate | JRC Rate | USDT Commission | JRC Commission |
|-------|-----------|----------|-----------------|----------------|
| 1     | 15%       | 20%      | $1.50          | 20 JRC         |
| 2     | 10%       | 15%      | $1.00          | 15 JRC         |
| 3     | 5%        | 10%      | $0.50          | 10 JRC         |
| 4     | 3%        | 8%       | $0.30          | 8 JRC          |
| 5     | 2%        | 6%       | $0.20          | 6 JRC          |
| 6     | 1%        | 4%       | $0.10          | 4 JRC          |
| 7     | 0.5%      | 3%       | $0.05          | 3 JRC          |
| 8     | 0.2%      | 2%       | $0.02          | 2 JRC          |
| 9     | 0.1%      | 1.5%     | $0.01          | 1.5 JRC        |
| 10    | 0.05%     | 1%       | $0.005         | 1 JRC          |

**Total Distributed:** $3.685 USDT + 70.5 JRC coins

## Example Referral Chain

```
User A (Investor: $10 → 100 JRC)
  ↑ referred by
User B (Level 1: Gets $1.50 + 20 JRC)
  ↑ referred by  
User C (Level 2: Gets $1.00 + 15 JRC)
  ↑ referred by
User D (Level 3: Gets $0.50 + 10 JRC)
  ↑ referred by
User E (Level 4: Gets $0.30 + 8 JRC)
  ↑ referred by
User F (Level 5: Gets $0.20 + 6 JRC)
  ↑ referred by
User G (Level 6: Gets $0.10 + 4 JRC)
  ↑ referred by
User H (Level 7: Gets $0.05 + 3 JRC)
  ↑ referred by
User I (Level 8: Gets $0.02 + 2 JRC)
  ↑ referred by
User J (Level 9: Gets $0.01 + 1.5 JRC)
  ↑ referred by
User K (Level 10: Gets $0.005 + 1 JRC)
```

## Implementation Details

### Database Structure
- `profiles.sponsor_id` contains the referrer's `referral_code`
- `referral_commissions` table tracks all commission payments
- Dual commission columns: `usdt_commission` and `jrc_commission`

### Processing Flow
1. User invests $10 → earns 100 JRC
2. System calls `dualReferralService.processDualReferralCommissions()`
3. `getReferralChain()` traverses up to 10 levels of referrers
4. For each level, `payDualCommission()` calculates and pays both USDT and JRC
5. Commissions are added to referrer's `main_wallet_balance` and `total_jarvis_tokens`
6. Transaction records are created for tracking

### Key Features
- ✅ Works for all 10 levels automatically
- ✅ Dual commission (USDT + JRC) at each level
- ✅ Different rates per level
- ✅ Stops if referral chain is shorter than 10 levels
- ✅ Only triggers on staking/investment, not deposits
- ✅ Proper error handling and logging
