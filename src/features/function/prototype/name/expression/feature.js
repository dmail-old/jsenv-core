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

// babel peut
'function-prototype-name-var',
'function-prototype-name-method-shorthand',
'function-prototype-name-method-shorthand-lexical-binding'
// babel peut pas
'function-prototype-name-new',
'function-prototype-name-accessor',
'function-prototype-name-method',
'function-prototype-name-method-computed-symbol',
'function-prototype-name-bind', // corejs & babel fail this
