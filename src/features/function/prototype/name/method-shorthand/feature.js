this.dependencies.push('shorthand-methods');
this.code = transpile`(function() {
    return {
        foo() {}
    };
})`;
this.pass = function(fn) {
    return fn().foo.name === 'foo';
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-function-name'
};
