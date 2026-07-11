export type TransactionType = 'credit' | 'debit';

// node-postgres returns DECIMAL/NUMERIC columns as strings, not JS numbers,
// specifically to avoid silent floating-point precision loss on money
// values. These types now reflect that reality instead of lying about it —
// callers that need to do arithmetic should parse through Decimal.js
// (see account.service.ts), not `+`.
export interface Transaction {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: string;
  balance_before: string;
  balance_after: string;
  description?: string;
  created_at: Date;
}

export interface Account {
  id: string;
  account_number: string;
  account_name: string;
  balance: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  created_at: Date;
}

export interface AuthPayload {
  userId: string;
  email: string;
}