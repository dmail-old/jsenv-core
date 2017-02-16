expose(
    'let',
    {
        code: transpile`(function() {
            let {c = c} = {};
            let {c = d, d} = {d: 1};
        })`,
        fail: function(error) {
            return error instanceof Error;
        },
        solution: parent.solution
    }
);
