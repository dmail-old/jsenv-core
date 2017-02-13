this.code = transpile`(function({a}) {})`;
this.pass = function(fn) {
    return fn.length === 1;
};
this.solution = 'inherit';
