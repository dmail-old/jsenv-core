// import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

function createDefaultComparer(expected, strict) {
    if (expected !== null) {
        var equalsHook = expected.equals;
        if (typeof equalsHook === 'function') {
            return function(actual) {
                return equalsHook.call(expected, actual);
            };
        }
    }

    if (strict) {
        return function(actual) {
            return actual === expected;
        };
    }
    return function(actual) {
        return actual == expected;  // eslint-disable-line eqeqeq
    };
}

const Equals = AssertInstruction.register('equals', {
    constructorSignature: [
        {name: 'expected', type: 'any'},
        {name: 'strict', default: true},
        {name: 'comparer', type: 'function', autoValue: createDefaultComparer}
    ],

    assert(actual) {
        return this.args[2](actual);
    }
});

Equals.i18n.addTranslation(Equals.name, {
    en: "{name} must be equal to {expected}",
    "en+not": "{name} must not be equal to {expected}"
});
// we must also have the 'strict' argument explained in the message
// and 'must match equals method of Buffer' when there is an equals hook

export default Equals;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('equal is strict by default', function() {
            let strictEqualsTrue = Equals.create(true);
            assert.equal(strictEqualsTrue.eval(true), true);
            assert.equal(strictEqualsTrue.eval(1), false);

            let looseEqualsTrue = Equals.create(true, false);
            assert.equal(looseEqualsTrue.eval(1), true);

            let customEquals = Equals.create(new Buffer('a'));
            assert.equal(customEquals.eval(new Buffer('a')), true);
            assert.equal(customEquals.eval(new Buffer('b')), false);
        });
    }
};
