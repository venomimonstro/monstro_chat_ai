module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@webzaytsev/yookassa-ts-sdk|@scure/base|@noble/hashes|@otplib)/)',
  ],
  moduleNameMapper: {
    '^@webzaytsev/yookassa-ts-sdk$': '<rootDir>/../__mocks__/yookassa-sdk.ts',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
