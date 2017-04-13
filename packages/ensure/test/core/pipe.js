/*
*/

const {createPromiseResolvedIn} = require('../helpers.js')

module.exports = {
	'piped assertion return value is passed to next assertion'(test, assert) {
		let assertionArgs
		const value = {}
		return test(
			test.pipe(() => value),
			(...args) => {
				assertionArgs = args
			}
		).then(() => {
			assert.equal(assertionArgs[0], value)
		})
	},
	// 'assertion await for piped assertion to resolve'(test, assert) {
	// 	let callOrder = []
	// 	return test(
	// 		test.pipe(() => createPromiseResolvedIn(50).then(() => {
	// 			callOrder.push('pipe')
	// 		})),
	// 		() => {
	// 			callOrder.push('assertion')
	// 		}
	// 	)().then(
	// 		() => assert.equal(callOrder.join(), 'pipe,assertion')
	// 	)
	// },
	'assertion await for the previous pipe'(test, assert) {
		let callOrder = []
		return test(
			test.pipe(() => createPromiseResolvedIn(50).then(() => {
				callOrder.push('pipeA')
			})),
			() => {
				callOrder.push('assertionA-start')
				return createPromiseResolvedIn(10).then(() => {
					callOrder.push('assertionA-end')
				})
			},
			test.pipe(() => {
				callOrder.push('pipeB-start')
				return createPromiseResolvedIn(50).then(() => {
					callOrder.push('pipeB-end')
				})
			}),
			() => {
				callOrder.push('assertionB')
			}
		)().then(
			() => assert.deepEqual(
				callOrder,
				[
					'pipeA',
					'assertionA-start',
					'pipeB-start',
					'assertionA-end',
					'pipeB-end',
					'assertionB'
				]
			)
		)
	}
}
