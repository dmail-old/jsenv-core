expose(
    {
        run: function() {
            return new Function( // eslint-disable-line no-new-func
                '{a}',
                'return a;'
            );
        },
        pass: function(fn) {
            var value = 1;
            var result = fn({a: value});
            return result === value;
        },
        solution: 'none'
    }
);
