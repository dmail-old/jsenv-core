this.code = 'inherit';
this.pass = function(stringIterator) {
    var astralString = '𠮷𠮶';
    var iterator = stringIterator.call(astralString);

    return this.sameValues(iterator, astralString);
}
this.solution = 'inherit';
