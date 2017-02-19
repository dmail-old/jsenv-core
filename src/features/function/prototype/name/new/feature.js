expose(
    {
        code: transpile`(function() {
            return new Function();
        })`,
        pass: function(fn) {
            return fn().name === 'anonymous';
        },
        solution: 'none'
    }
);
