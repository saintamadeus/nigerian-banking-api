import request from 'supertest';
import app from '../index';

const timestamp = Date.now();

describe('POST /api/auth/register', () => {
  it('should register a new user and return a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `register1_${timestamp}@example.com`,
        password: 'password123',
        fullName: 'Test User',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('should reject registration with a duplicate email', async () => {
    const email = `duplicate_${timestamp}@example.com`;

    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', fullName: 'Test User' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', fullName: 'Test User' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should reject registration with missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `missing_${timestamp}@example.com` });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  it('should login with valid credentials and return a token', async () => {
    const email = `login_${timestamp}@example.com`;

    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', fullName: 'Login User' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('should reject login with wrong password', async () => {
    const email = `wrongpass_${timestamp}@example.com`;

    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', fullName: 'Wrong Pass User' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});