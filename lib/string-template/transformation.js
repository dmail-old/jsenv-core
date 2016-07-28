// import proto from 'env/proto';

import CompilableNode from './lib/compilable-node.js';
import Tokenizer from './lib/tokenizer.js';
import Parser from './lib/parser.js';

import Parameter from './parameter.js';
import TransformerPrototypeStorage from './transformer-prototype-storage.js';

const Transformation = CompilableNode.extend({
    name: 'transformation',
    childPrototype: Parameter,
    chars: {
        escape: '\\',
        parametrize: ':',
        separate: ','
    },
    transformerPrototypeStorage: TransformerPrototypeStorage,

    populate(syntaxNode) {
        CompilableNode.populate.call(this, syntaxNode);

        let args = this.parameters.map(function(parameter) {
            return parameter.value;
        });
        this.transformer = this.transformerPrototypeStorage.generateByName(syntaxNode.value, ...args);

        return this;
    },

    toString() {
        let string = '';

        string += this.value;
        if (this.parameters.length > 0) {
            string += this.chars.parametrize;
            string += this.parameters.join(this.chars.separate + ' ');
        }

        return string;
    },

    eval(value) {
        return this.transformer.transform(value);
    }
});
Transformation.registerCompiler({
    tokenize: Tokenizer.createTokenize({
        escape: Transformation.chars.escape,
        parametrize: Transformation.chars.parametrize,
        separate: Transformation.chars.separate
    }),

    compile(syntaxNode) {
        var tokens = this.tokenize(syntaxNode.value);
        var escapedTokens = Parser.escapeTokens(tokens);
        var cursor = 0;
        var length = escapedTokens.length;
        var token;
        var parameterNode;

        syntaxNode.value = '';

        while (cursor < length) {
            token = escapedTokens[cursor];

            if (parameterNode) {
                if (token.type === 'separate') {
                    parameterNode = syntaxNode.next();
                } else {
                    parameterNode.value += token.value;
                }
            } else if (token.type === 'parametrize') {
                parameterNode = syntaxNode.next();
            } else {
                syntaxNode.value += token.value;
            }
            cursor++;
        }

        syntaxNode.value = syntaxNode.value.trim();

        return syntaxNode;
    }
});

export default Transformation;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('Transformation', function() {
            var input = ' transformerName : a , b';
            var transformation = Transformation.create();
            var calledOn;
            var calledWith;
            let transformer = transformation.transformerStorage.register('transformerName', function() {
                calledOn = this;
                calledWith = arguments;
                return 'foo';
            });

            transformation.compile(input);

            assert(transformation.value === 'transformerName');
            assert(transformation.parameters.length === 2);
            assert(transformation.parameters[0].value === 'a');
            assert(transformation.parameters[1].value === 'b');
            assert(transformation.parameters[0].transformation === transformation);
            assert(transformer.isPrototypeOf(transformation.transformer));
            assert(transformation.transformer.args.length === 2);

            this.add('eval', function() {
                var transformedInput = transformation.eval(10);

                assert(transformedInput === 'foo');
                assert(calledWith.length === 3);
                assert(calledWith[0] === 10);
                assert(calledWith[1] === 'a');
                assert(calledWith[2] === 'b');
                assert(calledOn === transformation.transformer);
            });

            transformation.transformerStorage.remove(transformer);
        });
    }
};
