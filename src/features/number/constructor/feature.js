// https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.number.constructor.js#L46
expose(
    {
        pass: function(Number) {
            return (
                Number(' 0o1') &&
                Number('0b1') &&
                !Number('+0x1')
            );
        },
        solution: {
            type: 'corejs',
            value: 'es6.number.constructor'
        }
    }
);
