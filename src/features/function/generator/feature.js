expose(
    'symbol/iterator',
    'regenerator-runtime',
    {
        run: transpile`(function * generator(value) {
            yield value;
        })`,
        pass: function(fn) {
            var value = 1;
            var iterator = fn(value);
            return this.sameValues(iterator, [value]);
        },
        solution: {
            type: 'babel',
            value: 'transform-regenerator',
            config: function(solutions) {
                var config = {};
                config.generators = true;
                config.async = jsenv.Iterable.some(solutions, function(solution) {
                    return solution.value === 'transform-async-to-generator';
                });
                config.asyncGenerators = config.async;
                return config;
            }
        }
    }
);
