expose(
    'symbol/iterator',
    'regenerator',
    {
        code: transpile`(function * generator(value) {
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
            config: function(entries) {
                var config = {};
                config.generators = jsenv.Iterable.some(entries, function(entry) {
                    return entry.feature.match('function/generator');
                });
                config.async = jsenv.Iterable.some(entries, function(entry) {
                    return entry.feature.match('function/async');
                });
                config.asyncGenerators = config.async;
                return config;
            }
        }
    }
);
