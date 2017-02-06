import AssertInstruction from '../instruction-assert.js';

const IncludesMultipleBlank = AssertInstruction.register('includesMultipleBlank', {
    restriction: 'string',

    assert(input) {
        return /\s{2,}/.test(input);
    }
});

export default IncludesMultipleBlank;
