const ensureThenable = (fn, transform) => {
	return function ensureReturnValueIsThenable() {
		try {
			let returnValue = fn.apply(this, arguments)
			if (transform) {
				returnValue = transform(returnValue)
			}
			if (returnValue && typeof returnValue.then === "function") {
				return returnValue
			}
			return Promise.resolve(returnValue)
		}
		catch (e) {
			return Promise.reject(e)
		}
	}
}
module.exports = ensureThenable
