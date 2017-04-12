const assert = require('assert')
const test = require('../ensure.js')

const names = [
	'api'
]
names.reduce((memo, filename) => {
	return memo.then(() => {
		// eslint-disable-next-line import/no-dynamic-require
		const fn = require(`./${filename}.js`)

		return fn(test, assert)
	})
}, Promise.resolve()).then(
	() => {
		console.log('all test passed')
	},
	(e) => {
		setTimeout(() => {
			throw e
		})
	}
)
