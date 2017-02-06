import CompilableNode from './lib/compilable-node.js';

const Parameter = CompilableNode.extend({
    name: 'parameter',

    toString() {
        return this.value;
    }
});
Parameter.registerCompiler({
    compile(syntaxNode) {
        syntaxNode.value = syntaxNode.value.trim();
        return syntaxNode;
    }
});

export default Parameter;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('core', function() {
            var input = ' test {} \\ ';
            var parameter = Parameter.compile(input);

            // parameter value is === input, there is no special compile logic
            // the only difference is that input is trimmed

            assert(parameter.value === input.trim());
        });
    }
};
