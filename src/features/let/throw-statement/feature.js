this.code = transpile`(function() {
    if (true) let result = 1;
})`;
this.fail = function(error) {
    return error.name === 'SyntaxError';
};
this.solution = 'none';
