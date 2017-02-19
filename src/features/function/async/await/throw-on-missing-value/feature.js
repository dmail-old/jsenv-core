expose(
    {
        code: transpile`(async function() {
            await;
        })`,
        fail: function(error) {
            return error.name === 'SyntaxError';
        },
        solution: parent.solution
    }
);
