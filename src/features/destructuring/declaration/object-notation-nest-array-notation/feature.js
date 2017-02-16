expose({
    dependencies: [
        'destructuring/declaration/array-notation',
        'destructuring/declaration/object-notation',
        'destructuring/declaration/object-notation/double-dot-as'
    ],
    code: transpile`(function(value) {
        var {a:[a]} = value;
        return a;
    })`,
    pass: function(fn) {
        var value = 1;
        var result = fn({a: [value]});
        return result === value;
    },
    solution: parent.solution
});
