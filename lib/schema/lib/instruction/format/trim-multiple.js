import FormatInstruction from '../instruction-format.js';

const TrimMultiple = FormatInstruction.register('trimMultiple', {
    format(input) {
        return input.replace(/\s{2,}/g, '');
    }
});

export default TrimMultiple;
