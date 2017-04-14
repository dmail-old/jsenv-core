const assert = require('assert')
const test = require('../index.js')

const ensure = {
	test,
}

const asyncSerie = (array, fn) => {
	return array.reduce((acc, value) => {
		return acc.then(() => fn(value))
	}, Promise.resolve())
}

const names = [
	'core/api'
]
asyncSerie(names, (filename) => {
	// eslint-disable-next-line import/no-dynamic-require
	const fileExports = require(`./${filename}.js`)

	return asyncSerie(Object.keys(fileExports), (name) => {
		return new Promise((resolve) => {
			resolve(fileExports[name](ensure, assert))
		}).catch((reason) => {
			if (reason && reason.name === 'AssertionError') {
				reason.message = `${name} failed: ${reason.message}`
				console.log('failed', reason.message)
			}
			return Promise.reject(reason)
		})
	})
}).then(
	() => {
		console.log('all test passed')
	},
	(e) => {
		setTimeout(() => {
			throw e
		})
	}
)
