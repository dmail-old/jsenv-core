import MacroInstruction from '../instruction-macro.js';

const HasSideBlank = MacroInstruction.register('hasSideBlank', {
    constructor() {
        let macro = MacroInstruction.create();

        macro.chain(macro.produce('startsWithBlank'));
        macro.chain(macro.produce('endsWithBlank'));

        return macro;
    }
});

export default HasSideBlank;
