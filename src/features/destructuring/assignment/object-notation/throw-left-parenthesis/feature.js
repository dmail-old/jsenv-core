this.code = transpile`(function(value) {
    var a;
    ({a}) = value;
})`;
this.fail = function(error) {
    return error instanceof SyntaxError;
};
this.solution = 'inherit';
