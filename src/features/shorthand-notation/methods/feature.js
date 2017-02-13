this.code = transpile`(function() {
    return {
        y() {}
    };
})`;
this.pass = function(fn) {
    var result = fn();
    return typeof result.y === 'function';
};
this.solution = 'inherit';
