// this.dependencies.push('function-prototype-bind');
this.code = transpile`(function() {
    function foo() {}
    var boundFoo = foo.bind({});
    var boundAnonymous = (function() {}).bind({});
    return [boundFoo, boundAnonymous];
})`;
this.pass = function(fn) {
    var result = fn();
    return (
        result[0].name === "bound foo" &&
        result[1].name === "bound "
    );
};
this.solution = 'none';
