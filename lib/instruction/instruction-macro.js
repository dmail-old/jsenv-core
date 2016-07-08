import {InstructionList, AllOf, AnyOf, OneOf} from './instruction-list.js';

import './assert/index.js';

const MacroInstruction = InstructionList.extend('MacroInstruction', {
    chain(instruction) {
        this.add(instruction, 'chain');
        return this;
    },

    and(instruction) {
        this.add(instruction, 'and');
        return this;
    },

    or(instruction) {
        this.add(instruction, 'or');
        return this;
    },

    allOf(...instructions) {
        return this.and(AllOf.create.apply(AllOf, instructions));
    },

    anyOf(...instructions) {
        return this.and(AnyOf.create.apply(AnyOf, instructions));
    },

    oneOf(...instructions) {
        return this.and(OneOf.create.apply(OneOf, instructions));
    }
});

export default MacroInstruction;
