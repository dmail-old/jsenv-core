import FormatInstruction from '../instruction-format.js';

const TrimLeft = FormatInstruction.register('trimLeft', {
    format(input) {
        return input.replace(/^\s+/g, '');
    }
});

export default TrimLeft;
