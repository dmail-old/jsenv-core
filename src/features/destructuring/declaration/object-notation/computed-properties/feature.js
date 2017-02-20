expose(
    'computed-properties',
    {
        run: transpile`(function(name, value) {
            var {[name]: a} = value;
            return a;
        })`,
        pass: function(fn) {
            var name = 'a';
            var value = 1;
            var object = {};
            object[name] = value;
            var result = fn(name, object);
            return result === value;
        }
    }
);
