import Instruction from './instruction.js';

const AssertInstruction = Instruction.extend('AssertInstruction', {
    getSkippedOutput() {
        return true;
    },

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

    run(input) {
        /*
        let forceOption = this.compileOptions.force;
        let force;
        let forceReplaceEval;
        let forceBeforeEval;

        if (forceOption) {
            force = this.getForceMethod();
            forceReplaceEval = this.forceReplaceEval;
            forceBeforeEval = this.forceBeforeEval;

            if (force) {
                if (forceReplaceEval || forceBeforeEval) {
                    input = force.call(this, input);
                    this.transform(input);
                }

                if (forceReplaceEval) {
                    return true;
                }
            }
        }
        */

        let requiredMetas = this.metas;

        if (requiredMetas) {
            let args = arguments;
            let metas = this.inputMeta;

            Object.keys(requiredMetas).forEach(function(metaName) {
                if (metaName in metas) {
                    throw new Error('input meta ' + metaName + ' already exists');
                }

                metas[metaName] = requiredMetas[metaName].apply(this, args);
            }, this);
        }

        let output = this.assert(input);
        // we should check output is a boolean

        console.log('assert', this.stringify(), 'on', input, '->', output);

        /*
        if (output === false && force && !forceBeforeEval) {
            force.call(this, input);
            this.transform(input);
            return true;
        }
        */

        return output;
    }
});

export default AssertInstruction;
