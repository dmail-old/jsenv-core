const createAssertionError = ({code, message, detail}) => {
	const error = new Error()
	error.code = code
	error.name = 'AssertionError'
	error.message = message
	error.detail = detail
	return error
}

module.exports = createAssertionError
