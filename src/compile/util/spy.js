function Call() {
	const self = this
	const data = {}
	let resolve
	const promise = new Promise((res) => {
		resolve = res
	})
	self.then = (fn) => {
		return promise.then(fn)
	}
	self.populate = (...args) => {
		data.thisValue = this
		data.args = args
		data.temporalValue = Date.now()
		resolve(data)
	}

	return self
}
const createCall = () => {
	return new Call()
}

const spy = (fn) => {
	const state = {}
	const calls = []
	let callCount = 0
	state.calls = calls

	const theSpy = function(...args) {
		const thisValue = this
		const call = theSpy.call(callCount)
		callCount++
		let value
		let state

		if (fn && typeof fn === 'function') {
			try {
				value = fn.apply(thisValue, args)
				state = 'returned'
			}
			catch (e) {
				value = e
				state = 'throwed'
			}
			call.state = state
			call.value = value
		}

		call.populate.apply(this, args)
		if (state === 'returned') {
			return value
		}
		if (state === 'throwed') {
			throw value
		}
	}
	theSpy.state = state
	theSpy.call = (index) => {
		if (index in calls) {
			return calls[index]
		}
		const call = createCall()
		calls[index] = call
		return call
	}
	theSpy.firstCall = () => theSpy.call(0)

	return theSpy
}

module.exports = spy
