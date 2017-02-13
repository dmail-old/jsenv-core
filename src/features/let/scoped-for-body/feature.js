this.code = transpile`(function(iterable) {
    var scopes = [];
    for(let i in iterable) {
        scopes.push(function() {
            return i;
        });
    }
    return scopes;
})`;
this.pass = function(fn) {
    var iterable = [0, 1];
    var scopes = fn(iterable);
    var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
        return scope();
    });
    return this.sameValues(scopeValues, this.collectKeys(iterable));
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-for-of'
};
