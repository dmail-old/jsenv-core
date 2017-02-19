expose(
    {
        code: transpile`(function * generator(spy) {
            spy.value = yield 0 ? true : false;
        })`,
        pass: function(generatorFn) {
            var spy = {};
            var generator = generatorFn(spy);
            generator.next();
            generator.next(true);
            return spy.value === true;
        },
        solution: parent.solution
    }
);
