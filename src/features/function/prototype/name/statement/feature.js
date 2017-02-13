this.code = transpile`(function() {
    return [
        function foo() {},
        (function() {})
    ];
})`;
this.pass = function(fn) {
    var result = fn();

    return (
        result[0].name === 'foo' &&
        result[1].name === ''
    );
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-function-name'
};
