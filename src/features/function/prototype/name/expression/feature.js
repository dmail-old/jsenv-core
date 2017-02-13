this.code = 'inherit';
this.pass = function() {
    return (
        (function foo() {}).name === 'foo' &&
        (function() {}).name === ''
    );
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-function-name'
};
