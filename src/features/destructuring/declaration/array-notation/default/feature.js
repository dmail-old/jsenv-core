expose(
    {
        run: transpile`(function(defaultValues, values) {
            var [a = defaultValues[0], b = defaultValues[1], c = defaultValues[2]] = values;
            return [a, b, c];
        })`,
        pass: function(fn) {
            var defaultA = 1;
            var defaultB = 2;
            var defaultC = 3;
            var a = 4;
            var result = fn(
                [
                    defaultA,
                    defaultB,
                    defaultC
                ],
                [ // eslint-disable-line no-sparse-arrays
                    a,
                    , // eslint-disable-line comma-style
                    undefined
                ]
            );

            return this.sameValues(result, [a, defaultB, defaultC]);
        }
    }
);
