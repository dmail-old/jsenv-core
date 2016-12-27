import proto from 'env/proto';

var ConditionalIterator = proto.extend({
    constructor(iterable, condition, bind) {
        if (typeof condition !== 'function') {
            throw new TypeError('condition must be a function');
        }
        if ((Symbol.iterator in iterable) === false) {
            throw new TypeError('not iterable', iterable);
        }

        this.iterable = iterable;
        this.iterator = iterable[Symbol.iterator]();
        this.condition = condition;
        this.bind = bind;
        this.index = 0;
        this.done = false;
    },

    next() {
        if (this.done === true) {
            return {
                done: true,
                value: undefined
            };
        }

        var next = this.iterator.next();

        if (next.done === false) {
            if (this.condition.call(this.bind, next.value)) {
                this.done = true;
            }
        }

        return next;
    },

    toString() {
        return '[object Mapped Iterator]';
    }
});

var ConditionalIterable = proto.extend({
    iterable: null,
    condition: null,
    bind: null,

    constructor(iterable, condition, bind) {
        this.iterable = iterable;
        this.condition = condition;
        this.bind = bind;
    },

    toString() {
        return '[object Break Iterable]';
    },

    [Symbol.iterator]() {
        return ConditionalIterator.create(this.iterable, this.condition, this.bind);
    }
});

function breakIterableWhenValueMatch(iterable, fn, bind) {
    return ConditionalIterable.create(iterable, fn, bind);
}

export default breakIterableWhenValueMatch;
