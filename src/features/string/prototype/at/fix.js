import {objectIsCoercible, fixProperty} from 'src/features/fix-helpers.js';

// https://github.com/mathiasbynens/String.prototype.at/blob/master/at.js
function at(position) {
    objectIsCoercible(this);
    var string = String(this);
    var size = string.length;
    // `ToInteger`
    var index = position ? Number(position) : 0;
    if (isNaN(index)) { // better `isNaN`
        index = 0;
    }
    // Account for out-of-bounds indices
    // The odd lower bound is because the ToInteger operation is
    // going to round `n` to `0` for `-1 < n <= 0`.
    if (index <= -1 || index >= size) {
        return '';
    }
    // Second half of `ToInteger`
    index |= 0;
    // Get the first code unit and code unit value
    var cuFirst = string.charCodeAt(index);
    var cuSecond;
    var nextIndex = index + 1;
    var len = 1;
    if ( // Check if it’s the start of a surrogate pair.
        cuFirst >= 0xD800 && cuFirst <= 0xDBFF && // high surrogate
        size > nextIndex // there is a next code unit
    ) {
        cuSecond = string.charCodeAt(nextIndex);
        if (cuSecond >= 0xDC00 && cuSecond <= 0xDFFF) { // low surrogate
            len = 2;
        }
    }
    return string.slice(index, index + len);
}

fixProperty(String.prototype, 'at', at)();
