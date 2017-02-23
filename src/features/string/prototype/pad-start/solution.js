feature.polyfill(padStart);

// https://github.com/tc39/proposal-string-pad-start-end/blob/master/polyfill.js
var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || Math.pow(2, 53) - 1;
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
function padStart(maxLength, fillString) {
    var object = this;
    if (object === null || typeof object === 'undefined') {
        throw new TypeError('"this" value must not be null or undefined');
    }

    var string = String(object);
    var intMaxLength = toLength(maxLength);
    var stringLength = toLength(string.length);
    if (intMaxLength <= stringLength) {
        return string;
    }
    var filler = typeof fillString === 'undefined' ? ' ' : String(fillString);
    if (filler === '') {
        return string;
    }
    var fillLen = intMaxLength - stringLength;
    while (filler.length < fillLen) {
        var fLen = filler.length;
        var remainingCodeUnits = fillLen - fLen;
        if (fLen > remainingCodeUnits) {
            filler += filler.slice(0, remainingCodeUnits);
        } else {
            filler += filler;
        }
    }
    var truncatedStringFiller = filler.slice(0, fillLen);
    return truncatedStringFiller + string;
}
