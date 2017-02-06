// http://stackoverflow.com/questions/1068834/object-comparison-in-javascript

function areEquivalent(x, y, xValues = [], yValues = []) {
    // remember that NaN === NaN returns false
    // and isNaN(undefined) returns true
    if (isNaN(x) && isNaN(y) && typeof x === 'number' && typeof y === 'number') {
        return true;
    }

    // Compare primitives and functions.
    // Check if both arguments link to the same object.
    // Especially useful on step when comparing prototypes
    if (x === y) {
        return true;
    }

    // Works in case when functions are created in constructor.
    // Comparing dates is a common scenario. Another built-ins?
    // We can even handle functions passed across iframes
    if ((typeof x === 'function' && typeof y === 'function') ||
    (x instanceof Date && y instanceof Date) ||
    (x instanceof RegExp && y instanceof RegExp) ||
    (x instanceof String && y instanceof String) ||
    (x instanceof Number && y instanceof Number)) {
        return x.toString() === y.toString();
    }

    // At last checking prototypes as good a we can
    if (!(x instanceof Object && y instanceof Object)) {
        return false;
    }

    if (x.isPrototypeOf(y) || y.isPrototypeOf(x)) {
        return false;
    }

    if (x.constructor !== y.constructor) {
        return false;
    }

    if (x.prototype !== y.prototype) {
        return false;
    }

    // Check for infinitive linking loops
    if (xValues.indexOf(x) > -1) {
        return false;
    }
    if (yValues.indexOf(y) > -1) {
        return false;
    }

    var key;
    // Quick checking of one object beeing a subset of another.
    for (key in y) {
        if (y.hasOwnProperty(key) !== x.hasOwnProperty(key)) {
            return false;
        }
    }

    for (key in x) {
        if (y.hasOwnProperty(key) !== x.hasOwnProperty(key)) {
            return false;
        }

        var xValue = x[key];
        var yValue = y[key];
        var xType = typeof xValue;
        var yType = typeof yValue;

        if (xType !== yType) {
            return false;
        }

        if (xType === 'object' || xType === 'function') {
            xValues.push(x);
            yValues.push(y);

            if (!areEquivalent(xValue, yValue, xValues, yValues)) {
                return false;
            }

            xValues.pop();
            xValues.pop();
        }

        return xValue === yValue;
    }

    return true;
}

export default areEquivalent;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        function assertEquivalent(a, b) {
            assert.equal(areEquivalent(a, b), true);
        }

        function assertDifferent(a, b) {
            assert.equal(areEquivalent(a, b), false);
        }

        this.add("equivalence", function() {
            assertEquivalent({}, {});
            assertEquivalent({foo: 'bar'}, {foo: 'bar'});
            assertEquivalent([0, 1], [0, 1]);

            assertEquivalent(new Map(), new Map());

            var a = new Map();
            a.set('foo', 'bar');
            var b = new Map();
            b.set('foo', 'bar');

            assertEquivalent(a, b);
        });

        this.add("difference", function() {
            assertDifferent([1], {0: 1});
            assertDifferent(null, undefined);
            assertDifferent(/1234/, /asdf/);
            assertDifferent(new Date(1234), 1234);
            assertDifferent(undefined, 'number');

            assertDifferent({foo: 'bar'}, {foo: 'bar', bar: undefined});

            var a = new Map();
            a.set('foo', 'bar');
            var b = new Map();
            b.set('foo', 'bat');
            assertDifferent(a, b);
        }).skip('map are not different atm');

        this.add("prototype", function() {
            var A = {foo: 'bar'};
            var a = Object.create(A);
            var b = {foo: 'bar'};

            assertDifferent(a, b);
        });

        this.add("cyclic structure", function() {
            var a = {};
            var b = {};
            a.a = a;
            a.b = b;
            b.b = b; // cyclic structure
            b.a = a;

            assertEquivalent(a, b);

            var c = {};
            var d = {};
            c.c = c;
            d.c = 'foo';
            assertDifferent(c, d);
        });
    }
};
