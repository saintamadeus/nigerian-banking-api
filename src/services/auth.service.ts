import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/jwt';
import { User, AuthPayload } from '../types';

export async function register(
  email: string,
  password: string,
  fullName: string
): Promise<{ user: Omit<User, 'password_hash'>; token: string }> {
  const existing = await query(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );

  if (existing.rows.length > 0) {
    throw new Error('Email already registered');
  }

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const result = await query(
    `INSERT INTO users (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, full_name, created_at`,
    [email, passwordHash, fullName]
  );

  const user = result.rows[0];

  const payload: AuthPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return { user, token };
}

export async function login(
  email: string,
  password: string
): Promise<{ user: Omit<User, 'password_hash'>; token: string }> {
  const result = await query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = result.rows[0];
  const passwordMatch = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatch) {
    throw new Error('Invalid email or password');
  }

  const payload: AuthPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return {
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      created_at: user.created_at,
    },
    token,
  };
}