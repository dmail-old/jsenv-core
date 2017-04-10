const assert = require('assert')
const spy = require('./spy.js')
const rejected = require('./ensure-rejected.js')

const expect = {
	spy,
	equal: assert.equal,
	rejected,
	called: (spy) => {
		const firstCall = spy.firstCall()
		assert(firstCall !== null)
		return firstCall
	},
	calledWith: (spy, ...args) => {
		const firstCall = expect.called(spy)
		assert.deepEqual(firstCall.args, args)
	},
	calledOn: (spy, thisValue) => {
		const firstCall = expect.called(spy)
		assert.equal(firstCall.thisValue, thisValue)
	}
}

module.exports = expect
