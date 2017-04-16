module.exports = (test) => {
	const sameValues = 1
	const transpile = 1
	const pipe = 1

	const suite = test(
		'function parameters',
		test(
			'default',
			test(
				pipe(() => transpile`(function(defaultA, defaultB) {
					return function(a = defaultA, b = defaultB) {
						return [a, b]
					}
				})`),
				'use default with a missing argument',
				(fn) => {
					const defaultA = 1
					const defaultB = 2
					const a = 3
					const result = fn(defaultA, defaultB)(a)
					return sameValues(result, [a, defaultB])
				},
				'use default with an explicit undefined argument',
				(fn) => {
					const defaultA = 1
					const defaultB = 2
					const b = 4
					const result = fn(defaultA, defaultB)(undefined, b)
					return sameValues(result, [defaultA, b])
				}
			)
		)
	)
	return suite
}
