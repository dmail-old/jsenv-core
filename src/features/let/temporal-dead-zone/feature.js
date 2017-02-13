this.code = transpile`(function(value) {
    var result;
    function fn() {
        result = foo;
    }
    let foo = value;
    fn();
    return result;
})`;
this.pass = function(fn) {
    var value = 10;
    var result = fn(value);
    return result === value;
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-for-of'
};
