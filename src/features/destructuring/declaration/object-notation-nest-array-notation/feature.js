this.dependencies.push(
    'destructuring-declaration-array',
    'destructuring-declaration-object',
    'destructuring-declaration-object-double-dot-as'
);
this.code = transpile`(function(value) {
    var {a:[a]} = value;
    return a;
})`;
this.pass = function(fn) {
    var value = 1;
    var result = fn({a: [value]});
    return result === value;
};
this.solution = 'inherit';
