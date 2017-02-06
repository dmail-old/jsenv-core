import CompilableNode from './lib/compilable-node.js';

const Constant = CompilableNode.extend({
    name: 'constant',

    toString() {
        return this.value;
    },

    evalRaw() {
        return this.toString();
    },

    eval() {
        return this.value;
    }
});

export default Constant;
