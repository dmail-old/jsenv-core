export function objectIsCoercible(object) {
    if (object === null || typeof object === 'undefined') {
        throw new TypeError('"this" value must not be null or undefined');
    }
}

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || Math.pow(2, 53) - 1;
export function toLength(value) {
    var len = Number(value);
    if (Number.isNaN(len) || len <= 0) {
        return 0;
    }
    if (len > MAX_SAFE_INTEGER) {
        return MAX_SAFE_INTEGER;
    }
    return len;
}

export function defineMethod(/* object, methodName, method */) {

}
