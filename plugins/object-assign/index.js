(function() {
    function mapProperties(args, fn) {
        var object = args[0];
        var i = 1;
        var j = args.length;
        var owner;
        var keys;
        var n;
        var m;

        for (;i < j; i++) {
            owner = args[i];
            if (Object(owner) !== owner) {
                continue;
            }
            keys = Object.keys(owner);
            n = 0;
            m = keys.length;

            for (;n < m; n++) {
                fn(object, keys[n], owner);
            }
        }

        return object;
    }

    if (!Object.assign) {
        Object.assign = function() {
            return mapProperties(arguments, function(object, key, owner) {
                object[key] = owner[key];
            });
        };
    }
})();
