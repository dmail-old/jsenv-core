this.code = transpile`(function() {
    return {
        get foo() {},
        set foo(x) {}
    };
})`;
this.pass = function(fn) {
    var result = fn();
    var descriptor = Object.getOwnPropertyDescriptor(result, 'foo');

    return (
        descriptor.get.name === 'get foo' &&
        descriptor.set.name === 'set foo'
    );
};
this.solution = 'none';
