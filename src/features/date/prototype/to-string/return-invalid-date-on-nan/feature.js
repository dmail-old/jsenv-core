this.code = 'inherit';
this.pass = function(datePrototypeToString) {
    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-string.js
    return datePrototypeToString.call(NaN) === 'Invalid Date';
};
this.solution = {
    type: 'polyfill',
    location: 'corejs://es6.date.to-string'
};
