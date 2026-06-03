if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = '24h';