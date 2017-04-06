const ensureThenable = (fn) => {
    return function ensureReturnValueIsThenable() {
        try {
            const returnValue = fn.apply(this, arguments)
            if (returnValue && typeof returnValue.then === 'function') {
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
