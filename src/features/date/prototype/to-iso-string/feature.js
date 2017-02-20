expose(
    {
        run: feature.runStandard(parent, 'toISOString'),
        solution: {
            type: 'inline',
            value: toISOString
        }
    }
);

var getTime = Date.prototype.getTime;
function toISOString() { // eslint-disable-line no-unused-expressions
    if (!isFinite(getTime.call(this))) {
        throw new RangeError('Invalid time value');
    }
    var d = this;
    var y = d.getUTCFullYear();
    var m = d.getUTCMilliseconds();

    var result;
    if (y < 0) {
        result = '-';
    } else if (y > 9999) {
        result = '+';
    } else {
        result = '';
    }
    result += ('00000' + Math.abs(y)).slice(result === '' ? -4 : -6);
    result += '-' + lz(d.getUTCMonth() + 1) + '-' + lz(d.getUTCDate());
    result += 'T' + lz(d.getUTCHours()) + ':' + lz(d.getUTCMinutes());
    result += ':' + lz(d.getUTCSeconds()) + '.' + (m > 99 ? m : '0' + lz(m)) + 'Z';

    return result;
}
function lz(num) {
    return num > 9 ? num : '0' + num;
}
