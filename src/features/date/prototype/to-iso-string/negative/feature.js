expose(
    {
        pass: function(datePrototypeToISOString) {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-iso-string.js
            var value = -5e13 - 1;
            var expectedReturnValue = '0385-07-25T07:06:39.999Z';
            return datePrototypeToISOString.call(value) === expectedReturnValue;
        }
    }
);
