// import proto from 'env/proto';

import Compiler from './lib/compiler.js';
import Tokenizer from './lib/tokenizer.js';
import Parser from './lib/parser.js';

var parameterCompiler = Compiler.create('parameter');
parameterCompiler.registerGeneratedPrototype('parameter', {
    transformValue(value) {
        return value.trim();
    }
});

var transformCompiler = Compiler.create('transform', function(transformNode) {
    var tokens = Tokenizer.createTokenize({
        escape: '\\',
        parametrize: ':',
        separate: ','
    })(transformNode.value);

    var escapedTokens = Parser.escapeTokens(tokens);
    var cursor = 0;
    var length = escapedTokens.length;
    var token;
    var parameterNode;

    transformNode.value = '';

    while (cursor < length) {
        token = escapedTokens[cursor];

        if (parameterNode) {
            if (token.type === 'separate') {
                parameterNode = transformNode.next('parameter');
            } else {
                parameterNode.value += token.value;
            }
        } else if (token.type === 'parametrize') {
            parameterNode = transformNode.next('parameter');
        } else {
            transformNode.value += token.value;
        }
        cursor++;
    }

    return transformNode;
});
transformCompiler.registerGeneratedPrototype('transformer', {
    parentName: 'expression',
    childrenName: 'params',
    childrenMap: {
        parameter: parameterCompiler
    },
    transformValue(value) {
        return value.trim();
    },

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
            string += this.compileHooks.tokenize.detectors.parametrize;
            string += this.params.join(', ');
        }

        return string;
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

var variableCompiler = Compiler.create('variable', function(variableNode) {
    var tokens = Tokenizer.createTokenize({
        escape: '\\',
        transform: '>'
    })(variableNode.value);

    var escapedTokens = Parser.escapeTokens(tokens);
    var cursor = 0;
    var length = escapedTokens.length;
    var token;
    var transformNode;

    variableNode.value = '';

    while (cursor < length) {
        token = escapedTokens[cursor];

        // parse transform child
        if (token.type === 'transform') {
            transformNode = variableNode.next('transform');
            cursor++;
            continue;
        }

        if (transformNode) {
            transformNode.value += token.value;
        } else {
            variableNode.value += token.value;
        }
        cursor++;
    }

    return variableNode;
});
variableCompiler.registerGeneratedPrototype('variable', {
    parentName: 'template',
    childrenName: 'transformers',
    childrenMap: {
        transformer: transformCompiler
    },
    transformValue(value) {
        return value.trim();
    },

    transformers: [],
    toString() {
        let string = '';

        string += '{';
        string += this.value;
        if (this.transformers.length) {
            string += '>';
            string += this.transformers.join(' > ');
        }
        string += '}';

        return string;
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
    },

    evalRaw() {
        return this.toString();
    },

    eval(input) {
        let output;

        if (input === null) {
            output = this.evalRaw();
        } else if (typeof input === 'object' || typeof input === 'function') {
            if (input instanceof Array) {
                var variableExpressions = this.template.expressions.filter(function(expression) {
                    return expression.name === 'variable';
                });
                var index = variableExpressions.indexOf(this);

                if (index in input) {
                    output = input[index];
                } else {
                    output = this.evalRaw();
                }
            } else {
                var propertyName = this.value;

                if (propertyName in input) {
                    output = input[propertyName];
                } else {
                    output = this.evalRaw();
                }
            }
        } else {
            throw new TypeError(
                'Expression.eval first argument must be null, an object or a function (' + input + 'given)'
            );
        }

        return this.transform(output);
    }
});

var constantCompiler = Compiler.create('constant');
var Constant = constantCompiler.registerGeneratedPrototype('constant', {
    parentName: 'template',

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

var templateCompiler = Compiler.create('template', function(templateNode) {
    var tokens = Tokenizer.createTokenize({
        escape: '\\',
        open: '{',
        close: '}'
    })(templateNode.value);

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
                    expressionNode = templateNode.next('variable');
                } else {
                    expressionNode.value += token.value;
                }
            }
        } else if (token.type === 'open') {
            expressionNode = templateNode.next('variable');
        } else {
            expressionNode = templateNode.next('constant');
            expressionNode.value = token.value;
        }

        cursor++;
    }

    return templateNode;
});
templateCompiler.registerGeneratedPrototype('Template', {
    parentName: 'compiler',
    childrenName: 'expressions',
    childrenMap: {
        variable: variableCompiler,
        constant: constantCompiler
    },

    eval(input) {
        return this.expressions.map(function(expression) {
            return expression.eval(input);
        }).join('');
    }
});

var compile = templateCompiler.compile.bind(templateCompiler);

export default null;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('compile()', function() {
            var compiled = compile('before{name}after');

            assert(compiled.expressions.length === 3);
            assert(compiled.expressions[0].value === 'before');
            assert(compiled.expressions[1].value === 'name');
            assert(compiled.expressions[2].value === 'after');

            assert(Constant.isPrototypeOf(compiled.expressions[0]));
        });

        this.add('eval() on null', function() {
            var source = 'hello {name} !';
            var template = compile(source);
            var output = template.eval(null);

            assert(output === source);
        });

        // this.add('eval() on object', function() {
        //     var source = 'hello {name}, your age is {age}';
        //     var template = compile(source);
        //     var output = template.eval({name: 'dam'});

        //     assert(output === 'hello dam, your age is {age}');
        // });

        // this.add('eval() on function', function() {
        //     var source = '{name}';
        //     var template = compile(source);
        //     var output = template.eval(function test() {});
        //     // function are considered as object having properties used to produce the output

        //     assert(output === 'test');
        // });

        // this.add('eval() on array', function() {
        //     var source = '{first} {second} {third}';
        //     var template = compile(source);
        //     var input = ['a', 'b'];
        //     var output = template.eval(input);

        //     assert(output === 'a b {third}');
        // });

        // this.add('eval() on undefined & string (any non null primitive)', function() {
        //     var source = '{first}';
        //     var template = compile(source);

        //     // undefined
        //     assert.throws(
        //         function() {
        //             template.compile(undefined);
        //         },
        //         function(e) {
        //             return e.name === 'TypeError';
        //         }
        //     );
        //     // string
        //     assert.throws(
        //         function() {
        //             template.compile('yo');
        //         },
        //         function(e) {
        //             return e.name === 'TypeError';
        //         }
        //     );
        // });
    }
};

// transformer: {
//             transform(variableNode) {
//                 variableNode.children = variableNode.children.map(function(transformNode) {
//                     return compileTransformer(transformNode.value);
//                 });
//                 return variableNode;
//             }
//         }

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
