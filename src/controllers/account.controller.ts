import { Request, Response } from 'express';
import * as AccountService from '../services/account.service';
import { AuthRequest } from '../middleware/auth';

export const createAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  const { accountName } = req.body;
  const userId = req.user!.userId;

  if (!accountName || typeof accountName !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'accountName is required and must be a string',
    });
    return;
  }

  try {
    const account = await AccountService.createAccount(accountName, userId);
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: account,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: err.message,
    });
  }
};

export const getUserAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  try {
    const accounts = await AccountService.getUserAccounts(userId);
    res.status(200).json({
      success: true,
      message: 'Accounts retrieved successfully',
      data: accounts,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve accounts',
      error: err.message,
    });
  }
};

export const getAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;

  try {
    const account = await AccountService.getAccount(id, userId);

    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Account retrieved successfully',
      data: account,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve account',
      error: err.message,
    });
  }
};

export const processTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const { type, amount, description } = req.body;

  if (!type || !amount) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'type and amount are required',
    });
    return;
  }

  if (type !== 'credit' && type !== 'debit') {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'type must be credit or debit',
    });
    return;
  }

  if (typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'amount must be a positive number',
    });
    return;
  }

  try {
    const result = await AccountService.processTransaction(id, userId, type, amount, description);
    res.status(200).json({
      success: true,
      message: 'Transaction processed successfully',
      data: result,
    });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404
      : err.message.includes('Insufficient') ? 400
      : 500;

    res.status(status).json({
      success: false,
      message: 'Transaction failed',
      error: err.message,
    });
  }
};

export const getTransactionHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;

  try {
    const transactions = await AccountService.getTransactionHistory(id, userId);
    res.status(200).json({
      success: true,
      message: 'Transaction history retrieved successfully',
      data: transactions,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction history',
      error: err.message,
    });
  }
};