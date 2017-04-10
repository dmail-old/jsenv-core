const ensureRejected = (thenable) => {
	return thenable.then(
		(value) => {
			throw new Error(`expected to reject but resolved with ${value}`)
		},
		(e) => e
	)
}

module.exports = ensureRejected
