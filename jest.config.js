module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  forceExit: true,
  clearMocks: true,
  moduleNameMapper: {
    '.*/config/redis$': '<rootDir>/src/__tests__/__mocks__/redis.ts',
  },
};