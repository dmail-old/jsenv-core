function none(reason) {
    return {
        type: 'none',
        reason: reason
    };
}
export {none};

function polyfill(object, propertyName, value) {
    return {
        type: 'inline',
        value: function() {
            object[propertyName] = value;
        }
    };
}
export {polyfill};

const objectPropertyIsEnumerable = Object.prototype.propertyIsEnumerable;
function isEnumerable(object, key) {
    return objectPropertyIsEnumerable.call(object, key);
}
export {isEnumerable};

const objectHasOwnProperty = Object.prototype.hasOwnProperty;
function hasOwnProperty(object, key) {
    return objectHasOwnProperty.call(object, key);
}
export {hasOwnProperty};

const objectToString = Object.prototype.toString;
const objectTagPrefixLength = '[object '.length;
function getTag(value) {
    return objectToString.call(value).slice(objectTagPrefixLength, -1);
}
export {getTag};

function isObject(value) {
    if (typeof value === 'object') {
        return value !== null;
    }
    return typeof value === 'function';
}

function isPrimitive(value) {
    return !isObject(value);
}

function isCallable(value) {
    return typeof value === 'function';
}

function assertObject(value) {
    if (!isObject(value)) {
        throw new TypeError(value + ' is not an object!');
    }
}
export {assertObject};

function objectIsCoercible(object) {
    if (object === null || typeof object === 'undefined') {
        throw new TypeError('"this" value must not be null or undefined');
    }
}
export {objectIsCoercible};

// https://github.com/ljharb/es-to-primitive/blob/master/es5.js
function toPrimitive(object, hint) {
    var actualHint;
    if (hint) {
        actualHint = hint;
    } else if (getTag(object) === 'Date') {
        actualHint = String;
    } else {
        actualHint = Number;
    }

    if (actualHint === String || actualHint === Number) {
        var methods = actualHint === String ? ['toString', 'valueOf'] : ['valueOf', 'toString'];
        var value;
        var i = 0;
        var j = methods.length;
        while (i < j) {
            var methodName = methods[i];
            var method = object[methodName];
            if (isCallable(method)) {
                value = method.call(object);
                if (isPrimitive(value)) {
                    return value;
                }
            }
            i++;
        }
        throw new TypeError('No default value');
    }
    throw new TypeError('invalid [[DefaultValue]] hint supplied');
}
export {toPrimitive};

function toObject(value) {
    objectIsCoercible(value);
    return Object(value);
}
export {toObject};

const toIterable = (function() {
    if (Object('z').propertyIsEnumerable(0)) {
        return Object;
    }
    return function(arg) {
        return getTag(arg) === 'String' ? arg.split('') : Object(arg);
    };
})();
export {toIterable};

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || Math.pow(2, 53) - 1;
function toLength(value) {
    var len = Number(value);
    if (Number.isNaN(len) || len <= 0) {
        return 0;
    }
    if (len > MAX_SAFE_INTEGER) {
        return MAX_SAFE_INTEGER;
    }
    return len;
}
export {toLength};

const shared = {};
function getSharedStore(name) {
    let store;
    if (name in shared) {
        store = shared[name];
    } else {
        store = {};
        shared[name] = store;
    }
    return store;
}

let sharedKeyId = 0;
const sharedKeySalt = Math.random();
function generateUniqueKey(name) {
    sharedKeyId++;

    let uniqueKey = 'Symbol(';
    if (name) {
        uniqueKey += name;
    }
    uniqueKey += ')_';
    uniqueKey += (sharedKeyId + sharedKeySalt).toString(36);
    return uniqueKey;
}

function getSharedKey(name) {
    const keysStore = getSharedStore('keys');
    let key;
    if (name in keysStore) {
        key = keysStore[name];
    } else {
        key = generateUniqueKey(name);
        keysStore[name] = key;
    }
    return key;
}
export {getSharedKey};

const nonEnumerableKeys = [
    'constructor',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    'toString',
    'valueOf'
];
export {nonEnumerableKeys};

function defineMethod(/* object, methodName, method */) {

}
export {defineMethod};

// function getImplementation(feature) {
//     // ça pose problème si l'implementation native est problématique ça...
//     // sinon faudrais un moyen de lancer le test en synchrone mais c'est pas forcément possible
//     // en gros je vois aucune solution viable
//     // donc je suggère l'orqu'on polyfill de toujour utiliser le fallback
//     const target = feature.compile();
//     if (target.reached) {
//         return target.value;
//     }
//     if (feature.solution.type === 'inline') {
//         return feature.solution.value;
//     }
//     throw new Error('no implementation found');
// }
