expose(
    {
        run: transpile`(async function() {
            await;
        })`,
        fail: function(error) {
            return error.name === 'SyntaxError';
        }
    }
);
