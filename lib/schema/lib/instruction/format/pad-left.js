import pad from '../../util/pad.js';

import FormatInstruction from '../instruction-format.js';

/*
function ensurePadCharLengthIsBelowExpectedMinLength(padChar) {
    let length = padChar.length;
    let aboveLength = this.args[0];

    if (length === 0) {
        return 'pad char length must not be empty';
    } else if (length >= aboveLength) {
        return 'pad char length must be below ' + aboveLength;
    }
}
*/

const PadLeft = FormatInstruction.register('padLeft', {
    constructorSignature: [
        {type: 'number'},
        {name: 'char', type: 'string', default: ' '}
    ],
    restriction: 'string',

    format(input) {
        let size = this.args[0];
        let char = this.args[1];

        return pad(input, size, char, 'left');
    }
});

export default PadLeft;
