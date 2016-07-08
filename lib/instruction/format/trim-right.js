import FormatInstruction from '../instruction-format.js';

/*
function ensureTruncateCharLengthIsBelowExpectedMinLength(truncateChar) {
    let length = truncateChar.lenght;
    let belowLength = this.args[0];

    if (length >= belowLength) {
        return 'truncate char length must be below ' + belowLength;
    }
}
*/

const TrimRight = FormatInstruction.register('trimRight', {
    format(input) {
        return input.replace(/\s+$/, '');
    }
});

export default TrimRight;
