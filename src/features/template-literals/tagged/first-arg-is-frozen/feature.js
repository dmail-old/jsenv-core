expose(
    'object/is-frozen',
    {
        pass: function(fn) {
            var parts;
            function tag() {
                parts = arguments[0];
            }
            fn(tag);

            return (
                Object.isFrozen(parts) &&
                Object.isFrozen(parts.raw)
            );
        }
    }
);
