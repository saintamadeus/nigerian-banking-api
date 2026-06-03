import { query, getClient } from '../config/database';
import redisClient from '../config/redis';
import { Account, Transaction } from '../types';

function generateAccountNumber(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

function accountCacheKey(accountId: string): string {
  return `account:${accountId}`;
}

export async function createAccount(
  accountName: string,
  userId: string
): Promise<Account> {
  const accountNumber = generateAccountNumber();

  const result = await query(
    `INSERT INTO accounts (account_number, account_name, balance, user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [accountNumber, accountName, 0.00, userId]
  );

  return result.rows[0];
}

export async function getAccount(
  id: string,
  userId: string
): Promise<Account | null> {
  const cacheKey = accountCacheKey(id);

  // 1. Check Redis first
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    const account: Account = JSON.parse(cached);
    // Ownership check on cached data — never skip this
    if (account.user_id !== userId) return null;
    return account;
  }

  // 2. Cache miss — query the database
  const result = await query(
    `SELECT * FROM accounts WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  const account = result.rows[0] || null;

  // 3. Store in Redis with 5 minute TTL
  if (account) {
    await redisClient.setEx(cacheKey, 300, JSON.stringify(account));
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
  description?: string
): Promise<{ account: Account; transaction: Transaction }> {
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
    const balanceBefore = parseFloat(account.balance);

    if (type === 'debit' && balanceBefore < amount) {
      throw new Error('Insufficient funds');
    }

    const balanceAfter =
      type === 'credit'
        ? balanceBefore + amount
        : balanceBefore - amount;

    const updatedAccount = await client.query(
      `UPDATE accounts
       SET balance = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [balanceAfter, accountId, userId]
    );

    const transactionResult = await client.query(
      `INSERT INTO transactions
         (account_id, type, amount, balance_before, balance_after, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [accountId, type, amount, balanceBefore, balanceAfter, description || null]
    );

    await client.query('COMMIT');

    // Invalidate cache — balance changed, stale data is dangerous in banking
    await redisClient.del(accountCacheKey(accountId));

    return {
      account: updatedAccount.rows[0],
      transaction: transactionResult.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
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