this.code = 'inherit';
this.pass = function(stringIterator) {
    var string = '1234';
    var iterator = stringIterator.call(string);

    return this.sameValues(iterator, string);
};
this.solution = 'inherit';
