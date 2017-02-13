// https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-json.js
this.code = 'inherit';
this.pass = function(datePrototypeToJSON) {
    return datePrototypeToJSON.call(NaN) === null;
};
this.solution = 'inherit';
