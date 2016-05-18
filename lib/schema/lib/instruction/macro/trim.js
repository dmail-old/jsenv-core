import MacroInstruction from '../instruction-macro.js';

// short cut for trimleft + trimRight
const Trim = MacroInstruction.register('trim', {
    constructor() {
        let macro = MacroInstruction.create();

        macro.chain(macro.produce('trimLeft'));
        macro.chain(macro.produce('trimRight'));

        return macro;
    }
});

export default Trim;
