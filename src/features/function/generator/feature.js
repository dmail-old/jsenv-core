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
            config: function(features) {
                var config = {};
                config.generators = jsenv.Iterable.some(features, function(feature) {
                    return feature.match('function/generator');
                });
                config.async = jsenv.Iterable.some(features, function(feature) {
                    return feature.match('function/async');
                });
                config.asyncGenerators = config.async;
                return config;
            }
        }
    }
);
