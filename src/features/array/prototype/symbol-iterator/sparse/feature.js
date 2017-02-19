expose(
    {
        pass: function(arrayIterator) {
            var sparseArray = [,,]; // eslint-disable-line no-sparse-arrays, comma-spacing
            var iterator = arrayIterator.call(sparseArray);

            return this.sameValues(iterator, sparseArray);
        }
    }
);
