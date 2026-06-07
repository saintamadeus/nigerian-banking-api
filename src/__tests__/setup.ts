import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

process.env.NODE_ENV = 'test';

export const testPool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
});

async function cleanDatabase() {
  await testPool.query('DELETE FROM transactions');
  await testPool.query('DELETE FROM accounts');
  await testPool.query('DELETE FROM users');
}

beforeAll(async () => {
  await cleanDatabase();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
});