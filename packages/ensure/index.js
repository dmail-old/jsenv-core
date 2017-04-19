const test = require('./src/test.js')
const spy = require('./src/spy.js')
const assertions = require('./src/assertions.js')

exports.default = test
exports.test = test
exports.spy = spy
Object.assign(exports, assertions)
