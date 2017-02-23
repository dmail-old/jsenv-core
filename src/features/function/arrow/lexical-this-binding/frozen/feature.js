expose(
    {
        pass: function(fn) {
            var value = 1;
            var arrow = fn.call(value);
            var callResult = arrow.call(2);
            var applyResult = arrow.apply(3);
            var bindResult = arrow.bind(4)();
            return (
                callResult === value &&
                applyResult === value &&
                bindResult === value
            );
        }
    }
);
