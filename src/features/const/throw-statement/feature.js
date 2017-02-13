this.code = transpile`(function() {
    if (true) const bar = 1;
})`;
this.fail = function(error) {
    return error.name === 'SyntaxError';
};
this.solution = 'none';
