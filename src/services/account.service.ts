import Decimal from 'decimal.js';
import { query, getClient } from '../config/database';
import redisClient from '../config/redis';
import { Account, Transaction } from '../types';
import { publishTransactionEvent } from '../config/kafka';

function generateAccountNumber(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

function accountCacheKey(accountId: string): string {
  return `account:${accountId}`;
}

// Safely read from Redis. If Redis is down, returns null and logs the error.
// The caller falls through to the database — no crash, no 500.
async function cacheGet(key: string): Promise<string | null> {
  try {
    return await redisClient.get(key);
  } catch (err) {
    console.error('[Cache] GET failed, bypassing cache:', err);
    return null;
  }
}

// Safely write to Redis. If Redis is down, we log and move on.
// A failed cache write is not a failed request.
async function cacheSet(key: string, ttl: number, value: string): Promise<void> {
  try {
    await redisClient.setEx(key, ttl, value);
  } catch (err) {
    console.error('[Cache] SET failed, bypassing cache:', err);
  }
}

// Safely delete from Redis. Critical: this must never throw inside a transaction.
// If Redis is down after a successful COMMIT, the transaction still succeeded.
// We log the failure and move on — the next read will simply hit the database.
async function cacheDel(key: string): Promise<void> {
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error('[Cache] DEL failed, cache may be stale for key:', key, err);
  }
}

const MAX_ACCOUNT_NUMBER_ATTEMPTS = 5;
const POSTGRES_UNIQUE_VIOLATION = '23505';

export async function createAccount(
  accountName: string,
  userId: string
): Promise<Account> {
  for (let attempt = 1; attempt <= MAX_ACCOUNT_NUMBER_ATTEMPTS; attempt++) {
    const accountNumber = generateAccountNumber();

    try {
      const result = await query(
        `INSERT INTO accounts (account_number, account_name, balance, user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [accountNumber, accountName, 0.00, userId]
      );

      return result.rows[0];
    } catch (err: any) {
      // account_number has a UNIQUE constraint. A collision on a random
      // 10-digit number is rare but not impossible — retry with a fresh
      // number instead of failing the request outright.
      const isAccountNumberCollision =
        err?.code === POSTGRES_UNIQUE_VIOLATION &&
        err?.constraint?.includes('account_number');

      if (!isAccountNumberCollision) {
        throw err;
      }

      if (attempt === MAX_ACCOUNT_NUMBER_ATTEMPTS) {
        throw new Error('Could not generate a unique account number, please try again');
      }
      // otherwise loop and retry with a new number
    }
  }

  // Unreachable, but keeps TypeScript's control-flow analysis happy.
  throw new Error('Could not generate a unique account number, please try again');
}

export async function getAccount(
  id: string,
  userId: string
): Promise<Account | null> {
  const cacheKey = accountCacheKey(id);

  // 1. Try Redis — failure returns null, not a crash
  const cached = await cacheGet(cacheKey);
  if (cached) {
    const account: Account = JSON.parse(cached);
    if (account.user_id !== userId) return null;
    return account;
  }

  // 2. Cache miss or Redis down — query the database
  const result = await query(
    `SELECT * FROM accounts WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  const account = result.rows[0] || null;

  // 3. Try to cache — failure is logged, not thrown
  if (account) {
    await cacheSet(cacheKey, 300, JSON.stringify(account));
  }

  return account;
}

export async function getUserAccounts(userId: string): Promise<Account[]> {
  const result = await query(
    `SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

export async function processTransaction(
  accountId: string,
  userId: string,
  type: 'credit' | 'debit',
  amount: number,
  description?: string,
  idempotencyKey?: string
): Promise<{ account: Account; transaction: Transaction; replayed: boolean }> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const accountResult = await client.query(
      `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [accountId, userId]
    );

    if (accountResult.rows.length === 0) {
      throw new Error('Account not found');
    }

    const account = accountResult.rows[0];

    // Idempotency check. The FOR UPDATE lock above already serializes
    // concurrent requests against this same account, so by the time a
    // retried request gets here, an earlier request using the same key
    // (if any) has already committed and is visible to this query.
    // A unique index on (account_id, idempotency_key) backs this up as a
    // defense-in-depth guard against races this lock doesn't cover.
    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT * FROM transactions WHERE account_id = $1 AND idempotency_key = $2`,
        [accountId, idempotencyKey]
      );

      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          account,
          transaction: existing.rows[0],
          replayed: true,
        };
      }
    }

    // account.balance comes back from Postgres as a string (e.g. "150.00").
    // Parsing it with parseFloat and doing native JS arithmetic on money is
    // how you get 0.1 + 0.2 = 0.30000000000000004 style drift creeping into
    // account balances over thousands of transactions. Decimal.js does
    // exact base-10 arithmetic instead.
    const balanceBefore = new Decimal(account.balance);
    const amountDecimal = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    if (type === 'debit' && balanceBefore.lessThan(amountDecimal)) {
      throw new Error('Insufficient funds');
    }

    const balanceAfter =
      type === 'credit'
        ? balanceBefore.plus(amountDecimal)
        : balanceBefore.minus(amountDecimal);

    // Pass fixed-precision strings to pg, not JS numbers — this preserves
    // exact decimal precision all the way into the DECIMAL(15,2) column.
    const balanceAfterStr = balanceAfter.toFixed(2);
    const balanceBeforeStr = balanceBefore.toFixed(2);
    const amountStr = amountDecimal.toFixed(2);

    const updatedAccount = await client.query(
      `UPDATE accounts
       SET balance = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [balanceAfterStr, accountId, userId]
    );

    const transactionResult = await client.query(
      `INSERT INTO transactions
         (account_id, type, amount, balance_before, balance_after, description, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [accountId, type, amountStr, balanceBeforeStr, balanceAfterStr, description || null, idempotencyKey || null]
    );

    await client.query('COMMIT');

    // Cache invalidation — wrapped safely. Redis down here must NOT
    // cause the API to report a failed transaction. The DB already committed.
    await cacheDel(accountCacheKey(accountId));

    // Publish Kafka event — wrapped safely in publishTransactionEvent.
    // Kafka failure must never cause the API to report a failed transaction.
    const tx = transactionResult.rows[0];
    const acc = updatedAccount.rows[0];
    await publishTransactionEvent({
      transactionId: tx.id,
      accountId: acc.id,
      accountNumber: acc.account_number,
      accountName: acc.account_name,
      type: tx.type,
      amount: tx.amount,
      balanceBefore: tx.balance_before,
      balanceAfter: tx.balance_after,
      description: tx.description || '',
    });

    return {
      account: acc,
      transaction: tx,
      replayed: false,
    };
  } catch (err: any) {
    await client.query('ROLLBACK');

    // Defense-in-depth: if the FOR UPDATE serialization above was somehow
    // bypassed (e.g. a future code path uses a different connection) and
    // two requests with the same idempotency key both reach the INSERT,
    // the unique index catches it here rather than double-applying funds.
    if (err?.code === '23505' && err?.constraint?.includes('idempotency_key')) {
      throw new Error('Duplicate transaction request (idempotency key already used)');
    }

    throw err;
  } finally {
    client.release();
  }
}

export async function getTransactionHistory(
  accountId: string,
  userId: string
): Promise<Transaction[]> {
  const result = await query(
    `SELECT t.* FROM transactions t
     INNER JOIN accounts a ON t.account_id = a.id
     WHERE t.account_id = $1 AND a.user_id = $2
     ORDER BY t.created_at DESC`,
    [accountId, userId]
  );

  return result.rows;
}