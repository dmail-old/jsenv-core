import Instruction from './instruction.js';

const AssertInstruction = Instruction.extend('AssertInstruction', {
    /*
    forceReplaceEval: false,
    forceBeforeEval: false,
    force: undefined,
    forceNot: undefined,

    getForceMethod() {
        let forceMethod;

        if (this.negated) {
            forceMethod = this.forceNot;
        } else {
            forceMethod = this.force;
        }

        return forceMethod;
    },
    */

    run(mutation) {
        // let requiredMetas = this.metas;

        // if (requiredMetas) {
        //     let args = arguments;
        //     let metas = this.inputMeta;

        //     Object.keys(requiredMetas).forEach(function(metaName) {
        //         if (metaName in metas) {
        //             throw new Error('input meta ' + metaName + ' already exists');
        //         }

        //         metas[metaName] = requiredMetas[metaName].apply(this, args);
        //     }, this);
        // }

        let output = this.assert(mutation.input.value);
        // should we check output is a boolean ?

        console.log('assert', this.stringify(), 'on', mutation.input.value, '->', output);

        mutation.eval(output);

        return output;
    }
});

export default AssertInstruction;
