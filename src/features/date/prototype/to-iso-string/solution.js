Date.prototype.toISOString = (function() { // eslint-disable-line no-extend-native
    function lz(num) {
        return num > 9 ? num : '0' + num;
    }

    var getTime = Date.prototype.getTime;

    return function toISOString() { // eslint-disable-line no-unused-expressions
        if (!isFinite(getTime.call(this))) {
            throw new RangeError('Invalid time value');
        }
        var d = this;
        var y = d.getUTCFullYear();
        var m = d.getUTCMilliseconds();
        var s = y < 0 ? '-' : y > 9999 ? '+' : ''; // eslint-disable-line no-nested-ternary
        var result = '';
        result += s;
        result += ('00000' + Math.abs(y)).slice(s ? -6 : -4);
        result += '-' + lz(d.getUTCMonth() + 1) + '-' + lz(d.getUTCDate());
        result += 'T' + lz(d.getUTCHours()) + ':' + lz(d.getUTCMinutes());
        result += ':' + lz(d.getUTCSeconds()) + '.' + (m > 99 ? m : '0' + lz(m)) + 'Z';
        return result;
    };
})();
