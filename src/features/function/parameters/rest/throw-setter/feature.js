this.code = transpile`(function() {
    return {
        set e(...args) {}
    };
})`;
this.fail = function(error) {
    return error instanceof Error;
};
this.solution = 'none';
