function memoize(fn, store) {
    if (typeof fn !== 'function') {
        throw new TypeError('memoize first arg must be a function');
    }

    function memoizedFn() {
        var bind = this;
        var args = arguments;
        var result;

        var data = store.read(bind, args);
        if (data.valid) {
            result = data.value;
        } else {
            result = fn.apply(bind, args);
            store.write(result, bind, args);
        }

        return result;
    }

    return memoizedFn;
}

function memoizeAsync(fn, store) {
    if (typeof fn !== 'function') {
        throw new TypeError('memoizeAsync first arg must be a function');
    }

    function memoizedAsyncFn() {
        var bind = this;
        var args = arguments;
        return Promise.resolve(store.read(bind, args)).then(function(data) {
            if (data.valid) {
                return data.value;
            }
            return Promise.resolve(fn.apply(bind, args)).then(function(value) {
                // even if store.write is async we ignore if it fails
                // and we don't wait before returning the value
                Promise.resolve(store.write(value, bind, args)).catch(function(e) {
                    console.warn('error while storing value', e);
                }).then(function() {
                    return value;
                });
                return value;
            });
        });
    }

    return memoizedAsyncFn;
}

memoize.async = memoizeAsync;

module.exports = memoize;
