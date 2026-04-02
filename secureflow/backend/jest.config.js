/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/seed.ts',         // data seeding script — not business logic
    '!src/server.ts',       // entry point — just starts the HTTP server
    '!src/config/**',       // DB connection bootstrapping
  ],
  coverageReporters: ['text', 'cobertura', 'lcov'],
  coverageDirectory: 'coverage',
  // jest-junit output path (matches the CI artifact path)
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: '.', outputName: 'junit.xml' }],
  ],
};
