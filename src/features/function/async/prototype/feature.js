expose(
    {
        code: parent.code,
        pass: function(fn) {
            return fn.hasOwnProperty('prototype') === false;
        },
        solution: parent.solution
    }
);
