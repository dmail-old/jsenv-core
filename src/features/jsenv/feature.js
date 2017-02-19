expose(
    {
        code: function() {
            return jsenv;
        },
        pass: function(jsenv) {
            return typeof jsenv === 'object';
        },
        solution: 'none'
    }
);
