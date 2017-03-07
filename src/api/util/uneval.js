var primitiveSourcers = {
    'boolean': function(boolean) {
        return boolean.toString();
    },
    'function': function(fn) {
        var source = fn.toString();
        return '(' + source + ')';
    },
    'null': function() {
        return 'null';
    },
    'number': function(number) {
        return number.toString();
    },
    'object': function(object, options) {
        var tagName = getTagName(object);
        if (tagName in compositeSourcers) {
            return compositeSourcers[tagName](object, options);
        }
        return uneval(tagName, options);
    },
    'string': function(string) {
        var source = '"' + quote(string) + '"';
        return source;
    },
    'symbol': function() {
        return '({})';
    },
    'undefined': function() {
        return 'undefined';
    }
};
var compositeSourcers = {
    'Array': function(array, options) {
        var seen = options.seen;
        if (seen) {
            if (seen.indexOf(array) > -1) {
                return options.circular;
            }
            seen.push(array);
        } else {
            options.seen = [array];
            options.circular = '[]';
        }

        var source;
        var i = 0;
        var j = array.length;

        source = '[';
        while (i < j) {
            source += uneval(array[i], options);
            if (i < j - 1) {
                source += ', ';
            }
            i++;
        }
        source += ']';

        return '(' + source + ')';
    },
    'Boolean': function(boolean) {
        var source = 'new Boolean(' + boolean.valueOf() + ')';
        return '(' + source + ')';
    },
    'Date': function(date) {
        var source = 'new Date(' + date.valueOf() + ')';
        return '(' + source + ')';
    },
    'Error': function(error, options) {
        var source = 'new ' + error.name + ' (' + uneval(error.message, options) + ')';
        return '(' + source + ')';
    },
    'RegExp': function(regexp) {
        return regexp.toString();
    },
    'Object': function(object, options) {
        var seen = options.seen;
        if (seen) {
            if (seen.indexOf(object) > -1) {
                return options.circular;
            }
            seen.push(object);
        } else {
            options.seen = [object];
            options.circular = '{}';
        }

        var source;
        var propertyNames = getPropertyNames(object);
        var i = 0;
        var j = propertyNames.length;
        var propertyName;

        source = '{';
        while (i < j) {
            propertyName = propertyNames[i];
            var propertyNameSource = uneval(propertyName, options);
            source += propertyNameSource;
            source += ': ' + uneval(object[propertyName], options);
            if (i < j - 1) {
                source += ', ';
            }
            i++;
        }
        source += '}';

        return '(' + source + ')';
    },
    'String': function(string) {
        var source = 'new String("' + quote(string) + '")';
        return '(' + source + ')';
    },
    'Symbol': function(symbol, options) {
        return primitiveSourcers.symbol(symbol, options);
    }
};

function uneval(value, options) {
    options = options || {};

    var type;
    if (value === null) {
        type = 'null';
    } else if (value === undefined) {
        type = 'undefined';
    } else {
        type = typeof value;
    }
    if (type in primitiveSourcers) {
        return primitiveSourcers[type](value, options);
    }
    throw new Error('uneval did not match ' + value);
}

// https://github.com/joliss/js-string-escape/blob/master/index.js
// http://javascript.crockford.com/remedial.html
function quote(value) {
    var string = String(value);
    var i = 0;
    var j = string.length;
    var escapedString = '';
    while (i < j) {
        var char = string[i];
        var escapedChar;
        if (
            char === '"' ||
            char === '\'' ||
            char === '\\'
        ) {
            escapedChar = '\\' + char;
        } else if (char === '\n') {
            escapedChar = '\\n';
        } else if (char === '\r') {
            escapedChar = '\\r';
        } else if (char === '\u2028') {
            escapedChar = '\\u2028';
        } else if (char === '\u2029') {
            escapedChar = '\\u2029';
        } else {
            escapedChar = char;
        }
        escapedString += escapedChar;
        i++;
    }
    return escapedString;
}

var toString = Object.prototype.toString;
function getTagName(object) {
    var toStringResult = toString.call(object);
    // returns format is '[object ${tagName}]';
    // and we want ${tagName}
    var tagName = toStringResult.slice('[object '.length, -1);
    return tagName;
}

var hasOwnProperty = Object.prototype.hasOwnProperty;
function getPropertyNames(value) {
    var names = [];
    for (var name in value) {
        if (hasOwnProperty.call(value, name)) {
            names.push(name);
        }
    }
    return names;
}

module.exports = uneval;
