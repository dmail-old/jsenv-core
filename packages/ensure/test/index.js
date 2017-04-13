const assert = require('assert')
const test = require('../index.js')

const names = [
	'api'
]
names.reduce((memo, filename) => {
	return memo.then(() => {
		// eslint-disable-next-line import/no-dynamic-require
		const fileExports = require(`./${filename}.js`)

		return Object.keys(fileExports).reduce((acc, name) => {
			return acc.then(() => {
				return fileExports[name](test, assert)
			}).catch((reason) => {
				if (reason && reason.name === 'AssertionError') {
					reason.message = `${name} failed: ${reason.message}`
				}
				return Promise.reject(reason)
			})
		}, Promise.resolve())
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
