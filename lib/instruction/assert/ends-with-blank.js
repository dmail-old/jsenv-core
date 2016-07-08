import AssertInstruction from '../instruction-assert.js';

var EndsWithBlank = AssertInstruction.register('endsWithBlank', {
    restriction: 'string',

    assert(input) {
        return /\s$/.test(input);
    }
});

export default EndsWithBlank;

export const test = {
    modules: ['node/assert'],

    suite(assert) {
        this.add("core", function() {
            assert(/\s$/.test("foo "));
            assert(/\s$/.test("foo  "));
            assert(/\s$/.test("foo") === false);
        });
    }
};
