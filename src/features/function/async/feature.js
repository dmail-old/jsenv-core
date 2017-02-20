expose(
    'promise',
    'regenerator-runtime', // because babel transpile async to generator
    {
        run: transpile`(async function(value) {
            return value;
        })`,
        pass: function(fn, settle) {
            var value;
            var result = fn(value);
            if (result instanceof Promise === false) {
                return false;
            }
            result.then(function(resolutionValue) {
                settle(resolutionValue === value);
            });
        },
        solution: {
            type: 'babel',
            value: 'transform-async-to-generator'
        }
    }
);
