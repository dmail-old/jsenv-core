expose(
    {
        pass: function(stringIterator) {
            var string = '1234';
            var iterator = stringIterator.call(string);

            return this.sameValues(iterator, string);
        }
    }
);

