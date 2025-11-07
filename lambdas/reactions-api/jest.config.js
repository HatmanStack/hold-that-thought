module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'index.js',
    '!test/**'
  ],
  testMatch: [
    '**/test/**/*.test.js'
  ]
};
