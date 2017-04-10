const spy = (fn) => {
	const state = {}
	const calls = []
	state.calls = calls

	const call = (thisValue, args) => {
		const theCall = {
			thisValue,
			args,
		}
		return theCall
	}

	const theSpy = function(...args) {
		const thisValue = this
		const theCall = call(thisValue, args)
		state.calls.push(theCall)

		if (fn && typeof fn === 'function') {
			let value
			let state
			try {
				value = fn.apply(thisValue, args)
				state = 'returned'
			}
			catch (e) {
				value = e
				state = 'throwed'
			}
			theCall.state = state
			theCall.value = value

			if (state === 'returned') {
				return value
			}
			throw value
		}
	}
	theSpy.state = state
	theSpy.firstCall = () => state.calls[0]

	return theSpy
}

module.exports = spy
