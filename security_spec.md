# Firestore Security Specification - Indian Money Code

## 1. Data Invariants
- All financial data (transactions, budgets, goals, etc.) belongs to a specific user.
- A user can only access their own data.
- Transactions must have a valid type (income/expense), amount, and category.
- Budgets must have non-negative allocation and spent values.
- IDs must be alphanumeric strings to prevent resource poisoning.

## 2. The Dirty Dozen Payloads (Rejection Targets)
1. **The Identity Thief**: Creating a transaction in another user's path.
2. **The Shadow Field**: Adding `isVerified: true` to a budget.
3. **The Resource Poisoner**: Using a 2KB string as a transaction ID.
4. **The Negative Wallet**: Adding a transaction with a negative amount.
5. **The Type Bypasser**: Setting `transactionType` to `loot`.
6. **The Unverified Leak**: Reading user profiles without being the owner.
7. **The Bulk Scraper**: Running a list query without a `where userId == auth.uid` filter equivalent check.
8. **The Timestamp Faker**: Providing a manual `createdAt` string instead of ServerValue.
9. **The Zero-Spend Bypass**: Updating budget `spent` without owning the budget.
10. **The ID Injector**: Using `../../system/config` as a document ID.
11. **The Shadow Admin**: Trying to update a user document to add `role: 'admin'`.
12. **The Terminal State Break**: Modifying a locked/terminal record (if any were present).

## 3. Test Invariants
- `test_unauthenticated_denied`: All access denied for non-signed-in users.
- `test_cross_user_denied`: User A cannot read User B's transactions.
- `test_invalid_schema_denied`: Transactions missing mandatory fields must be rejected.
- `test_id_size_limits`: IDs longer than 128 chars must be rejected.
