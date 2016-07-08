import FormatInstruction from '../instruction-format.js';

const Truncate = FormatInstruction.register('truncate', {
    constructorSignature: [
        {type: 'number'},
        {name: 'char', type: 'string', default: ''}
    ],

    format(input) {
        let size = this.args[0];
        let char = this.args[1];
        let length = input.length;
        let charLength = char.length;

        if (length > size) {
            input = input.slice(0, size - charLength) + char;
        }

        return input;
    }
});

export default Truncate;
