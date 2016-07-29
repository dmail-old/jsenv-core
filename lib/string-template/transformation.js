// import proto from 'env/proto';

// i have the impression that no matter how I turn things everything should have an extended version of the previous object to prevent mutation
// in short it means that doing proto.extend should auto extend proto to prevent direct object mutation and sharing
// and .create should also loop on properties and extend every prototype based object or maybe .create() them?
// you would not be able to share object amongst instance, so it would be more like elm
// you can share basic object, but prototyped one would always be extended version so that you can safely modify them
// to be tested but sounds interesting

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
    transformerPrototypeStorage: TransformerPrototypeStorage.branch(),

    constructor() {
        CompilableNode.constructor.apply(this, arguments);
        this.transformerPrototypeStorage = this.transformerPrototypeStorage.branch();
    },

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
            let transformerPrototype = transformation.transformerPrototypeStorage.register(
                'transformerName',
                function() {
                    calledOn = this;
                    calledWith = arguments;
                    return 'foo';
                }
            );

            transformation.compile(input);

            assert(transformation.value === 'transformerName');
            assert(transformation.parameters.length === 2);
            assert(transformation.parameters[0].value === 'a');
            assert(transformation.parameters[1].value === 'b');
            assert(transformation.parameters[0].transformation === transformation);
            assert(transformerPrototype.isPrototypeOf(transformation.transformer));
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

            transformation.transformerPrototypeStorage.remove(transformerPrototype);
        });
    }
};
