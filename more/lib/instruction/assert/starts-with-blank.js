import AssertInstruction from '../instruction-assert.js';

var StartsWithBlank = AssertInstruction.register('startsWithBlank', {
    restriction: 'string',

    assert(input) {
        return /^\s/.test(input);
    }
});

export default StartsWithBlank;
