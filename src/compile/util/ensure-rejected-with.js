const ensureRejectedWith = (thenable, fn) => {
	return thenable.then(
		(value) => {
			throw new Error(`expected to reject but resolved with ${value}`)
		},
		(e) => {
			if (fn(e)) {
				return
			}
			throw new Error(`rejected with unexpected value ${e}`)
		}
	)
}

module.exports = ensureRejectedWith
