expose(
    {
        code: transpile`(function * generator() {
            yield 1;
            yield 2;
        })`,
        pass: function(generatorFn) {
            var generator = generatorFn();
            var value = 10;
            generator.next();
            var entry = generator.return(value);
            var lastEntry = generator.next();
            return (
                entry.done === true &&
                entry.value === value &&
                lastEntry.done === true &&
                lastEntry.value === undefined
            );
        },
        solution: parent.solution
    }
);
