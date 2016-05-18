import pad from '../../util/pad.js';

import FormatInstruction from '../instruction-format.js';

const Pad = FormatInstruction.register('pad', {
    constructorSignature: [
        {type: 'number'},
        {name: 'char', type: 'string', default: ' '}
    ],
    restriction: 'string',

    format(input) {
        let size = this.args[0];
        let char = this.args[1];

        return pad(input, size, char, 'both');
    }
});

export default Pad;
