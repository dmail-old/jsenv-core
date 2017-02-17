// https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-json.js
expose(
    {
        code: parent.code,
        pass: function(datePrototypeToJSON) {
            return datePrototypeToJSON.call(NaN) === null;
        },
        solution: parent.solution

    }
);
