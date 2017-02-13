this.code = transpile`function() {
    var result = {
        a: function() {},
        b: function c() {};
    };
    result.d = function() {};
    return result;
})`;
this.pass = function(fn) {
    var result = fn();
    return (
        result.a.name === 'a' &&
        result.b.name === 'c' &&
        result.d.name === ''
    );
};
this.solution = 'none';
