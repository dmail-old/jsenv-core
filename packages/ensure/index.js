const test = require('./src/test.js')
const assertions = require('./src/assertions.js')

Object.assign(test, assertions)

module.exports = test
