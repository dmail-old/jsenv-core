import compose from '@jsenv/compose';

var FilteredIterator = compose('FilteredIterator', {
    constructor(iterator, filter, bind, kind) {
        if (typeof filter !== 'function') {
            throw new TypeError('filter must be a function');
        }

        this.iteratedObject = iterator;
        this.iterationKind = kind || 'key+value';
        this.result = {
            done: false,
            value: undefined
        };
        this.nextIndex = 0;
        this.filter = filter;
        this.bind = bind;
    },

    createResult(value, done) {
        this.result.value = value;
        this.result.done = done;
        return this.result;
    },

    next() {
        var filter;
        var bind;
        var kind;
        var iterator;
        var next;
        var value;

        filter = this.filter;
        bind = this.bind;
        kind = this.iterationKind;
        iterator = this.iteratedObject;
        next = iterator.next();

        while (next.done === false) {
            value = next.value;

            if (filter.call(bind, value)) {
                this.nextIndex++;

                if (kind === 'value') {
                    return this.createResult(value, false);
                }

                if (kind === 'key') {
                    return this.createResult(this.nextIndex, false);
                }

                return this.createResult([this.nextIndex, value], false);
            }

            next = iterator.next();
        }

        return this.createResult(undefined, true);
    }
});

var FilteredIterable = compose('FilteredIterable', {
    iterable: null,
    filter: null,
    bind: null,

    constructor(iterable, filter, bind) {
        if ((Symbol.iterator in iterable) === false) {
            throw new Error('filteredIterable first argument must be iterable');
        }
        this.iterable = iterable;
        this.filter = filter;
        this.bind = bind;
    },

    count() {
        return Array.from(this).length;
    },

    [Symbol.iterator]() {
        return FilteredIterator.create(this.iterable[Symbol.iterator](), this.filter, this.bind, 'value');
    }
});

function filterIterable(iterable, fn, bind) {
    return FilteredIterable.create(iterable, fn, bind);
}

export default filterIterable;
