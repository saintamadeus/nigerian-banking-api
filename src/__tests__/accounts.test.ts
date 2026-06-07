import request from 'supertest';
import app from '../index';

const timestamp = Date.now();

async function registerAndLogin(suffix: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: `account_${suffix}_${timestamp}@example.com`,
      password: 'password123',
      fullName: 'Account User',
    });
  return res.body.data.token;
}

describe('POST /api/accounts', () => {
  it('should create an account for authenticated user', async () => {
    const token = await registerAndLogin('1');

    const res = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountName: 'My Savings' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.account_number).toBeDefined();
    expect(res.body.data.balance).toBe('0.00');
  });

  it('should reject account creation without a token', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ accountName: 'My Savings' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/accounts/:id', () => {
  it('should return account details for owner', async () => {
    const token = await registerAndLogin('2');

    const createRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountName: 'My Savings' });

    const accountId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(accountId);
  });

  it('should reject access to another users account', async () => {
    const token1 = await registerAndLogin('3');

    const createRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token1}`)
      .send({ accountName: 'User1 Account' });

    const accountId = createRes.body.data.id;

    const token2Res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `attacker_${timestamp}@example.com`,
        password: 'password123',
        fullName: 'Attacker',
      });
    const token2 = token2Res.body.data.token;

    const res = await request(app)
      .get(`/api/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/accounts/:id/transaction', () => {
  it('should credit an account and update balance', async () => {
    const token = await registerAndLogin('4');

    const createRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountName: 'My Savings' });

    const accountId = createRes.body.data.id;

    const res = await request(app)
      .post(`/api/accounts/${accountId}/transaction`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'credit', amount: 5000, description: 'Salary' });

    expect(res.status).toBe(200);
    expect(res.body.data.account.balance).toBe('5000.00');
    expect(res.body.data.transaction.type).toBe('credit');
  });

  it('should reject a debit that exceeds balance', async () => {
    const token = await registerAndLogin('5');

    const createRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountName: 'My Savings' });

    const accountId = createRes.body.data.id;

    const res = await request(app)
      .post(`/api/accounts/${accountId}/transaction`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'debit', amount: 1000, description: 'Withdrawal' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});