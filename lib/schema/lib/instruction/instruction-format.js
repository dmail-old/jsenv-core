import Instruction from './instruction.js';

const FormatInstruction = Instruction.extend('FormatInstruction', {
    run(input) {
        let output = this.format(input);

        this.transform(output);

        console.log('format', this.stringify(), 'on', input, '->', output);

        return output;
    },

    toBoolean() {
        return true;
    }
});

export default FormatInstruction;
