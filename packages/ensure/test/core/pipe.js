/*
possible names
pipe
	+ current name
	- there may be better name ?
give
	+
	-
transform
	+
	-
*/

const {createPromiseResolvedIn} = require('../helpers.js')

module.exports = {
	'piped assertion return value is passed to next assertion'({test, pipe}, assert) {
		let assertionArgs
		const value = {}
		return test(
			pipe(() => value),
			(...args) => {
				assertionArgs = args
			}
		).then(() => {
			assert.equal(assertionArgs[0], value)
		})
	},
	'piped assertion cannot be preceded by normal assertion'({test, pipe}, assert) {
		assert.throws(
			() => test(
				() => {},
				pipe(() => {})
			),
			(e) => e.message === 'piped assertion cannot be preceeded by normal assertion'
		)
	},
	'only one piped assertion allowed per test'({test, pipe}, assert) {
		// this limitation exsist because we want to enforce
		// users to create a new tests every time they want to act
		// on a different value
		// it will enforce a given style and make pipe simpler to reason about

		assert.throws(
			() => test(
				pipe(() => {}),
				pipe(() => {})
			),
			(e) => e.message === 'cannot have more than one piped assertion per test'
		)
	},
	'assertion await for piped assertion to resolve'({test, pipe}, assert) {
		let callOrder = []
		return test(
			pipe(() => createPromiseResolvedIn(50).then(() => {
				callOrder.push('pipe')
			})),
			() => {
				callOrder.push('assertion')
			}
		)().then(
			() => assert.equal(callOrder.join(), 'pipe,assertion')
		)
	},
	// 'assertion await for the previous pipe'(test, assert) {
	// 	let callOrder = []
	// 	return test(
	// 		test.pipe(() => createPromiseResolvedIn(50).then(() => {
	// 			callOrder.push('pipeA')
	// 		})),
	// 		() => {
	// 			callOrder.push('assertionA-start')
	// 			return createPromiseResolvedIn(10).then(() => {
	// 				callOrder.push('assertionA-end')
	// 			})
	// 		},
	// 		test.pipe(() => {
	// 			callOrder.push('pipeB-start')
	// 			return createPromiseResolvedIn(50).then(() => {
	// 				callOrder.push('pipeB-end')
	// 			})
	// 		}),
	// 		() => {
	// 			callOrder.push('assertionB')
	// 		}
	// 	)().then(
	// 		() => assert.deepEqual(
	// 			callOrder,
	// 			[
	// 				'pipeA',
	// 				'assertionA-start',
	// 				'pipeB-start',
	// 				'assertionA-end',
	// 				'pipeB-end',
	// 				'assertionB'
	// 			]
	// 		)
	// 	)
	// }
}
