function convertStringToArray(string) {
	var result = []
	var i = 0
	var j = string.length
	while (i < j) {
		var char = string[i]

		if (i < j - 1) {
			var charCode = string.charCodeAt(i)

			// fix astral plain strings
			if (charCode >= 55296 && charCode <= 56319) {
				i++
				result.push(char + string[i])
			}
			else {
				result.push(char)
			}
		}
		else {
			result.push(char)
		}
		i++
	}
	return result
}
function consumeIterator(iterator) {
	var values = []
	var next = iterator.next()
	while (next.done === false) {
		values.push(next.value)
		next = iterator.next()
	}
	return values
}
function sameValues(a, b) {
	if (typeof a === 'string') {
		a = convertStringToArray(a)
	}
	else if (typeof a === 'object' && typeof a.next === 'function') {
		a = consumeIterator(a)
	}
	if (typeof b === 'string') {
		b = convertStringToArray(b)
	}
	else if (typeof b === 'object' && typeof b.next === 'function') {
		b = consumeIterator(b)
	}

	// console.log('compare', a, 'and', b);

	if (a.length !== b.length) {
		return false
	}
	var i = a.length
	while (i--) {
		if (a[i] !== b[i]) {
			return false
		}
	}
	return true
}
module.exports = sameValues
