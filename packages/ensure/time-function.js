// https://github.com/braveg1rl/performance-now/blob/master/src/performance-now.coffee
const hrtime = process.hrtime
const getNanoSeconds = () => {
	const hourtime = hrtime()
	return hourtime[0] * 1e9 + hourtime[1]
}
const getOffset = () => {
	const moduleLoadTime = getNanoSeconds()
	const upTime = process.uptime() * 1e9
	return moduleLoadTime - upTime
}
const offset = getOffset()
const now = () => {
	const ns = getNanoSeconds()
	const diff = ns - offset
	return diff / 1e6
}

const timeFunction = (fn, {add = 0} = {}) => {
	if (typeof fn !== 'function') {
		throw new TypeError('timeFunction first arg must be a function')
	}

	return (...args) => {
		const before = now()
		try {
			const returnValue = fn.apply(this, args)

			if (returnValue) {
				const then = returnValue.then
				if (typeof then === 'function') {
					return then.call(
						returnValue,
						(value) => {
							return {
								duration: add + (now() - before),
								value
							}
						},
						(reason) => {
							return Promise.reject({
								duration: add + (now() - before),
								value: reason
							})
						}
					)
				}
			}

			return Promise.resolve({
				duration: add + (now() - before),
				value: returnValue
			})
		}
		catch (e) {
			return Promise.reject({
				duration: add + (now() - before),
				value: e
			})
		}
	}
}
module.exports = timeFunction
// timeFunctionSync would be cool too
