expose(
    {
        code: parent.code,
        pass: function(datePrototypeToString) {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-string.js
            return datePrototypeToString.call(NaN) === 'Invalid Date';
        },
        solution: {
            type: 'corejs',
            value: 'es6.date.to-string'
        }
    }
);
