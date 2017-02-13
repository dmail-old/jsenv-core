this.code = transpile`(function() {
    return new Function();
})`;
this.pass = function(fn) {
    return fn().name === 'anonymous';
};
this.solution = 'none';
