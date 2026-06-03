import { Request, Response } from 'express';
import * as AuthService from '../services/auth.service';

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, fullName } = req.body;

  if (!email || !password || !fullName) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'email, password and fullName are required',
    });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'password must be at least 8 characters',
    });
    return;
  }

  try {
    const result = await AuthService.register(email, password, fullName);
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: result,
    });
  } catch (err: any) {
    const status = err.message.includes('already registered') ? 409 : 500;
    res.status(status).json({
      success: false,
      message: 'Registration failed',
      error: err.message,
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'email and password are required',
    });
    return;
  }

  try {
    const result = await AuthService.login(email, password);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (err: any) {
    const status = err.message.includes('Invalid') ? 401 : 500;
    res.status(status).json({
      success: false,
      message: 'Login failed',
      error: err.message,
    });
  }
};