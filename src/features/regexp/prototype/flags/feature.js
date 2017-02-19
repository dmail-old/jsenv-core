// https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.flags.js
expose(
    {
        pass: function() {
            return /./g.flags === 'g';
        },
        solution: {
            type: 'corejs',
            value: 'es6.regexp.flags'
        }
    }
);
