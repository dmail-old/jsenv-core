import CompilableNode from './lib/compilable-node.js';
import Tokenizer from './lib/tokenizer.js';
import Parser from './lib/parser.js';

import Expression from './expression.js';

const Template = CompilableNode.extend({
    name: 'template',
    childPrototype: Expression,
    chars: {
        escape: '\\',
        open: '{',
        close: '}'
    },

    constructor() {
        CompilableNode.constructor.apply(this, arguments);
        // each expression must inherit from the template transformerStorage instead of using its own
        // it allow something a bit overkill but each expression / transformation have its own transformerStorage
        // '{name > uppercase > uppercase}' can have one transformer per 'uppercase' occurence
        // {name > uppercase} {age > uppercase}' can have one transformer per 'uppercase' occurence
        // of course the basic behaviour is to register transformer on a template.transformerStorage
        this.transformerPrototypeStorage = this.transformerPrototypeStorage.branch();
    },

    get transformerPrototypeStorage() {
        return this.childPrototype.transformerPrototypeStorage;
    },

    set transformerPrototypeStorage(value) {
        this.childPrototype.transformerPrototypeStorage = value;
    },

    toString() {
        return this.expressions.reduce(function(previous, expression) {
            var expressionString = expression.toString();

            if (expression.name === 'variable') {
                expressionString = this.chars.open + expressionString + this.chars.close;
            }

            return previous + expressionString;
        }.bind(this), '');
    },

    eval(input) {
        return this.expressions.map(function(expression) {
            var evalValue = expression.eval(input);

            if (expression.name === 'variable') {
                if (expression.lastEvaluationOutput.evaluated === false) {
                    evalValue = this.chars.open + evalValue + this.chars.close;
                }
            }

            return evalValue;
        }, this).join('');
    }
});
Template.registerCompiler({
    tokenize: Tokenizer.createTokenize({
        escape: Template.chars.escape,
        open: Template.chars.open,
        close: Template.chars.close
    }),

    compile(syntaxNode) {
        var tokens = this.tokenize(syntaxNode.value);
        var escapedTokens = Parser.escapeTokens(tokens);
        var cursor = 0;
        var length = escapedTokens.length;
        var token;
        var expressionNode;

        while (cursor < length) {
            token = escapedTokens[cursor];

            if (expressionNode) {
                if (expressionNode.name === 'variable') {
                    if (token.type === 'close') {
                        expressionNode = null; // close the variableNode
                    } else {
                        expressionNode.value += token.value;
                    }
                } else if (expressionNode.name === 'constant') {
                    if (token.type === 'open') {
                        expressionNode = syntaxNode.next('variable');
                    } else {
                        expressionNode.value += token.value;
                    }
                }
            } else if (token.type === 'open') {
                expressionNode = syntaxNode.next('variable');
            } else {
                expressionNode = syntaxNode.next('constant');
                expressionNode.value = token.value;
            }

            cursor++;
        }

        return syntaxNode;
    }
});

export default Template;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('core', function() {
            var input = ' before {variable > transform : 1} after ';
            var template = Template.compile(input);

            assert(template.expressions.length === 3);
            assert(template.expressions[0].value === ' before ');
            assert(template.expressions[1].value === 'variable');
            assert(template.expressions[2].value === ' after ');

            // assert(template.parent === null);
            assert(template.expressions[0].template === template);
            assert('parent' in template.expressions[0] === false);

            var output;
            template = Template.compile('hello {name}, your age is {age}');
            this.add('eval', function() {
                output = template.eval({name: 'dam'});
                assert(output === 'hello dam, your age is {age}');

                output = template.eval(['dam', 10]);
                assert(output === 'hello dam, your age is 10');

                output = template.eval(null);
                assert(output === 'hello {name}, your age is {age}');
            });
        });

        this.add('transformerstorage', function() {
            let template = Template.create();

            // global transformer
            Template.transformerPrototypeStorage.register('round', function(value) {
                return Math.round(value);
            });
            // specific transformer
            template.transformerPrototypeStorage.register('uppercase', function(value) {
                return value.toUpperCase();
            });

            assert(Template.transformerPrototypeStorage.has('round') === true);
            assert(template.transformerPrototypeStorage.has('round') === true);
            assert(Template.transformerPrototypeStorage.has('uppercase') === false);
            assert(template.transformerPrototypeStorage.has('uppercase') === true);

            template.compile('Hello {name > uppercase}, your age is {age > round}');
            let output = template.eval({name: 'dam', age: 20.4});

            assert(output === 'Hello DAM, your age is 20');
        });
    }
};

// var compiledExpressionNode = compileExpression(expressionNode.value);
//         var transformableVariableExpression = TransformableVariableExpression.create(compiledExpressionNode.value);
//         var transformers = compiledExpressionNode.children.map(function(transformNode) {
//             // we should use part.name to be able to find the corresponding transformer method
//             let compiledTransformNode = compileTransformer(transformNode.value);
//             let transformerParams = compiledTransformNode.children.map(function(paramNode) {
//                 return paramNode.value;
//             });
//             let transformer = Transformer.create(transformerParams);
//             return transformer;
//         }).map(function(transformer) {
//             return transformer.assignExpression(transformableVariableExpression);
//         });

//         transformableVariableExpression.transformers = transformers;

//         return transformableVariableExpression;

// const TransformCompiler = Compiler.extend({
//     registeredTransformers: [],

//     constructor() {
//         Compiler.constructor.apply(this, arguments);
//         this.registeredTransformers = [];
//     }
//     transformer() {
//         if (arguments.length !== 2) {
//             throw new Error('Compiler.transformer expect two arguments');
//         }

//         let firstArg = arguments[0];
//         if (typeof firstArg !== 'string') {
//             throw new TypeError('Compiler.transformer first argument must be a string');
//         }
//         let secondArg = arguments[1];
//         let transformer;
//         if (typeof secondArg === 'function') {
//             transformer = Transformer.extend({
//                 name: firstArg,
//                 transform: secondArg
//             });
//         } else if (typeof secondArg === 'string') {
//             // là en fait on va pars
//             let transformNode = compileTransformer(secondArg);
//             let Transformer = this.getTransformer(transformNode.value);

//             // the transformer must exists else we throw
//             let transformerParams = transformNode.children.map(function(paramNode) {
//                 return paramNode.value;
//             });

//             transformer = Transformer.create(transformerParams);
//             transformer.name = firstArg;
//         } else {
//             throw new TypeError('registerTransformer second argument must be a function or a string');
//         }

//         this.registeredTransformers.push(transformer);
//     }
// });
