expose(
    {
        pass: function(fn) {
            return fn.hasOwnProperty('prototype') === false;
        }
    }
);
