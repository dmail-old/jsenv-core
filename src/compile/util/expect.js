// https://github.com/dmail/system-test/tree/157fd90bc2267cc999fac630f831abc74e360f75/lib/old
// https://github.com/dmail/assert/blob/e1c004b4b71a5e5f482ed283f10172bd27b92d76/lib/assertions.js#L17

const assert = require('assert')
const spy = require('./spy.js')

const willReject = (thenable) => {
	return thenable.then(
		(value) => {
			throw new Error(`expected to reject but resolved with ${value}`)
		},
		(e) => e
	)
}
const willResolve = (thenable) => {
	return thenable.then(
		(value) => value,
		(e) => {
			throw new Error(`expected to resolve but rejected with: ${e}`)
		}
	)
}

const expect = {
	equal: assert.equal,
	willReject,
	willResolve,
	// willTimeout,
	// willSettleBefore,

	spy,
	called: (spy) => {
		const firstCall = spy.firstCall()
		assert(firstCall !== null)
		return firstCall
	},
	// returned: (spy) {},
	// throwed: (spy) {},
	// calledInThatOrder: (...spies) {},
	// willBeCalled: (spy) {}
	// composite expectations
	// Im not very fan of thoose but they are so handy
	calledWith: (spy, ...args) => {
		const firstCall = expect.called(spy)
		assert.deepEqual(firstCall.args, args)
	},
	calledOn: (spy, thisValue) => {
		const firstCall = expect.called(spy)
		assert.equal(firstCall.thisValue, thisValue)
	},
}

module.exports = expect
