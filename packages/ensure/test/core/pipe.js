/*

à faire :
pipe peut être appelé nimporte ou et tout ce qui se trouve entre deux piped assertion
est run en parallèle

*/

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
	}
}
