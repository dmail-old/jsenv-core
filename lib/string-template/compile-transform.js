// reference is a specific behaviour for dictionnary, so reason to see this here
// so all relative properties will move do dictionnary
// refer: '#'
//  isReference: false
// if (this.isReference) {
//     string += tokenizeConfig.reference;
// }
// var isReference = Boolean(node.meta && node.meta.refer);
// refer token at the beginning are ignored and set a meta property
// if (token.type === 'refer' && variableCursor === astCursor) {
//     variableNode.meta = {refer: true};
//     variableCursor++;
//     continue;
// }
// variableExpression.isReference = isReference;

import proto from 'env/proto';
import Item from 'env/item';

import Tokenizer from './lib/tokenizer.js';
import Parser from './lib/parser.js';
import Compiler from './lib/compiler.js';

let VariableExpression;

var expressionTokenizerConfig = {
    escape: '\\',
    whitespace: [' ', '\t', '\r', '\n', '\f'],
    transform: '>'
};
var tokenizeExpression = Tokenizer.createTokenize(expressionTokenizerConfig);
var parseExpression = Parser.createParse(function(tokens, expressionNode, cursor) {
    var length = tokens.length;
    var token;
    var transformNode;

    while (cursor < length) {
        token = tokens[cursor];

        // ignore white space in transform node
        if (token.type === 'whitespace') {
            cursor++;
            continue;
        }

        // parse transform child
        if (token.type === 'transform') {
            transformNode = expressionNode.next('transform');
            cursor++;
            continue;
        }

        if (transformNode) {
            transformNode.value += token.value;
        } else {
            expressionNode.value += token.value;
        }
        cursor++;
    }
});
var compileExpression = function(input) {
    return parseExpression(tokenizeExpression(input));
};

var transformerTokenizerConfig = {
    parametrize: ':',
    whitespace: [' ', '\t', '\r', '\n', '\f'],
    separate: ','
};
var tokenizeTransformer = Tokenizer.createTokenize(transformerTokenizerConfig);
var parseTransformer = Parser.createParse(function(tokens, transformNode, cursor) {
    var length = tokens.length;
    var token;
    var paramNode;

    while (cursor < length) {
        token = tokens[cursor];

        // ignore white space
        if (token.type === 'whitespace') {
            cursor++;
            continue;
        }

        if (token.type === 'parametrize') {
            paramNode = transformNode.next('param');
            cursor++;
            continue;
        }

        if (paramNode) {
            if (token.type === 'separate') {
                paramNode = transformNode.next('param');
                cursor++;
                continue;
            }

            paramNode.value += token.value;
        } else {
            transformNode.value += token.value;
        }
        cursor++;
    }
});
var compileTransformer = function(input) {
    return parseTransformer(tokenizeTransformer(input));
};

const Transformer = proto.extend('Transformer', {
    expression: undefined, // a transform belong to an expression
    name: undefined,
    params: [],

    constructor(params) {
        if (params) {
            this.params = this.params.slice();
            this.params.push(...params);
        }
    },

    toString() {
        let string = '';

        string += this.name;
        if (this.params.length > 0) {
            string += transformerTokenizerConfig.parametrize;
            string += this.params.join(transformerTokenizerConfig.separate + ' ');
        }

        return string;
    },

    assignExpression(expression) {
        var transformer = Item.clone(this);
        transformer.expression = expression;
        return transformer;
    },

    createArgs(value) {
        let args = [value, ...this.params];
        return args;
    },

    transform(input) {
        return input;
    },

    eval(value) {
        return this.transform.apply(this, this.createArgs(value));
    }
});

const TransformableVariableExpression = VariableExpression.extend({
    transformers: [],

    constructor() {
        VariableExpression.constructor.apply(this, arguments);
        this.transformers = [];
    },

    toString() {
        let string = '';

        string += tokenizeConfig.open;
        string += this.value;
        if (this.transformers.length) {
            string += transformerTokenizerConfig.transform;
            string += this.transformers.join(' ' + transformerTokenizerConfig.transform + ' ');
        }
        string += tokenizeConfig.close;

        return string;
    },

    eval(input) {
        let output = VariableExpression.eval.call(this, input);
        return this.transform(output);
    },

    transform(input) {
        var output;
        var transformedInput = this.transformers.reduce(function(previousTransformedInput, transformer) {
            return transformer.eval(previousTransformedInput);
        }, input);

        // if ('transformer' in options) {
        //     let compilationTransformer = options.transformer;
        //     let compilationTransformerBind = options.transformerBind;
        //     var transformedOutput = compilationTransformer.call(
        //         compilationTransformerBind,
        //         transformedInput,
        //         this,
        //         options
        //     );

        //     output = transformedOutput;
        // } else {
        output = transformedInput;
        // }

        return output;
    }
});

const TransformCompiler = Compiler.extend({
    registeredTransformers: [],

    constructor() {
        Compiler.constructor.call(this);
        this.registeredTransformers = [];
    },

    createVariableExpressionFromNode(expressionNode) {
        var compiledExpressionNode = compileExpression(expressionNode.value);
        var transformableVariableExpression = TransformableVariableExpression.create(compiledExpressionNode.value);
        var transformers = compiledExpressionNode.children.map(function(transformNode) {
            // we should use part.name to be able to find the corresponding transformer method
            let compiledTransformNode = compileTransformer(transformNode.value);
            let transformerParams = compiledTransformNode.children.map(function(paramNode) {
                return paramNode.value;
            });
            let transformer = Transformer.create(transformerParams);
            return transformer;
        }).map(function(transformer) {
            return transformer.assignExpression(transformableVariableExpression);
        });

        transformableVariableExpression.transformers = transformers;

        return transformableVariableExpression;
    },

    transformer() {
        if (arguments.length !== 2) {
            throw new Error('Compiler.transformer expect two arguments');
        }

        let firstArg = arguments[0];
        if (typeof firstArg !== 'string') {
            throw new TypeError('Compiler.transformer first argument must be a string');
        }
        let secondArg = arguments[1];
        let transformer;
        if (typeof secondArg === 'function') {
            transformer = Transformer.extend({
                name: firstArg,
                transform: secondArg
            });
        } else if (typeof secondArg === 'string') {
            // là en fait on va pars
            let transformNode = compileTransformer(secondArg);
            let Transformer = this.getTransformer(transformNode.value);

            // the transformer must exists else we throw
            let transformerParams = transformNode.children.map(function(paramNode) {
                return paramNode.value;
            });

            transformer = Transformer.create(transformerParams);
            transformer.name = firstArg;
        } else {
            throw new TypeError('registerTransformer second argument must be a function or a string');
        }

        this.registeredTransformers.push(transformer);
    }
});

export default TransformCompiler;
