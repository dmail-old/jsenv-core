function memoizeAsync(fn, store) {
    if (typeof fn !== 'function') {
        throw new TypeError('memoizeAsync first arg must be a function');
    }

    function memoizedFn() {
        var bind = this;
        var args = arguments;
        return store.read().then(function(data) {
            if (data.valid) {
                return data.value;
            }
            return Promise.resolve(fn.apply(bind, args)).then(function(value) {
                // even if store.write is async we ignore if it fails
                // and we don't wait before returning the value
                store.write(value).catch(function(e) {
                    console.warn('error while storing value', e);
                });
                return value;
            });
        });
    }

    return memoizedFn;
}

function memoize() {

}

memoize.async = memoizeAsync;

module.exports = memoize;
