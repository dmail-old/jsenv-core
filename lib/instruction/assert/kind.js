import proto from 'proto';

import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

var Kind = AssertInstruction.register('kind', {
    constructorSignature: signatures.oneString,

    assert(input) {
        let expectedKind = this.args[0];

        return proto.isOfKind(input, expectedKind);
    }
});

export default Kind;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
