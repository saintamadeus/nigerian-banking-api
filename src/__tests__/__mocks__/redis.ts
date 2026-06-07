const redisClient = {
  get: jest.fn().mockResolvedValue(null),
  setEx: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  isOpen: true,
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

export const createClient = jest.fn().mockReturnValue(redisClient);

export async function connectRedis(): Promise<void> {
  // No-op in tests
}

export default redisClient;