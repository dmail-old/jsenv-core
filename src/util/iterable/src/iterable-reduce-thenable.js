function reduceIterableToThenable(iterable, initialValue, condition, bind) {
    if ((Symbol.iterator in iterable) === false) {
        throw new TypeError(iterable + ' is not iterable');
    }

    var initialPromise = Promise.resolve(initialValue);
    var iterator = iterable[Symbol.iterator]();
    var next;

    function nextThenable(value) {
        if (condition && condition.call(bind, value)) {
            return value;
        }

        next = iterator.next(value);

        if (next.done) {
            return value;
        }
        return Promise.resolve(next.value).then(nextThenable);
    }

    return initialPromise.then(nextThenable);
}

export default reduceIterableToThenable;
