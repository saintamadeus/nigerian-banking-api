export type TransactionType = 'credit' | 'debit';

export interface Transaction {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  description?: string;
  created_at: Date;
}

export interface Account {
  id: string;
  account_number: string;
  account_name: string;
  balance: number;
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