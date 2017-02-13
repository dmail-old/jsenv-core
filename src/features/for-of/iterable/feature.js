this.dependencies.push('symbol-iterator');
this.code = 'inherit';
this.pass = function(fn) {
    var data = [1, 2, 3];
    var iterable = this.createIterableObject(data);
    var result = fn(iterable);
    return this.sameValues(result, data);
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-for-of'
};
