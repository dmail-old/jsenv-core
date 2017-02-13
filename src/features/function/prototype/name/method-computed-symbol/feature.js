this.dependsOn('symbol', 'computed-properties');
this.code = transpile`(function() {
    var first = Symbol('foo');
    var second = Symbol();
    return {
        first: first,
        second: second,
        [first]: function() {},
        [second]: function() {}
    };
})`;
this.pass = function(fn) {
    var result = fn();

    return (
        result[result.first].name === '[foo]' &&
        result[result.second].name === ''
    );
};
this.solution = 'none';
