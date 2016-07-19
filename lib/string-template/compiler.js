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

// whitespace: [' ', '\t', '\r', '\n', '\f'],

// import proto from 'env/proto';

import CompilableNode from './lib/compiler.js';
import Tokenizer from './lib/tokenizer.js';
import Parser from './lib/parser.js';

var Parameter = CompilableNode.create('parameter', {
    nodeProperties: {
        name: 'parameter',
        parentName: 'transformer',

        toString() {
            return this.value;
        }
    },

    transform(syntaxNode) {
        syntaxNode.value = syntaxNode.value.trim();
        return syntaxNode;
    }
});

var Transformer = CompilableNode.create('transformer', {
    nodeProperties: {
        name: 'transformer',
        parentName: 'expression',
        childrenName: 'params',

        // params: [],
        // constructor(params) {
        //     if (params) {
        //         this.params = this.params.slice();
        //         this.params.push(...params);
        //     }
        // },

        toString() {
            let string = '';

            string += this.value;
            if (this.params.length > 0) {
                string += ':';
                string += this.params.join(', ');
            }

            return string;
        },

        createArgs(value) {
            let params = this.params.map(function(parameter) {
                return parameter.value;
            });
            let args = [value, ...params];
            return args;
        },

        transform(input) {
            return input;
        },

        eval(value) {
            return this.transform.apply(this, this.createArgs(value));
        }
    },

    childrenMap: {
        parameter: Parameter
    },

    transform(syntaxNode) {
        var tokens = Tokenizer.createTokenize({
            escape: '\\',
            parametrize: ':',
            separate: ','
        })(syntaxNode.value);

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
                    parameterNode = syntaxNode.next('parameter');
                } else {
                    parameterNode.value += token.value;
                }
            } else if (token.type === 'parametrize') {
                parameterNode = syntaxNode.next('parameter');
            } else {
                syntaxNode.value += token.value;
            }
            cursor++;
        }

        syntaxNode.value = syntaxNode.value.trim();

        return syntaxNode;
    }
});

// var transformerPrototypes = {};
// transformerPrototypes.add = function(name, transformMethod) {
//     var transformerPrototype = Transformer.extend({
//         transform: transformMethod
//     });
//     this[name] = transformerPrototype;
//     return transformerPrototype;
// };

// transformCompiler.createObject = function(node) {
//     // it's the node name that is used to create a transformer, not the transformer prototype
//     var transformerName = node.value.trim();

//     if (transformerName in transformerPrototypes) {
//         return transformerPrototypes[transformerName].create(node.children);
//     }
//     return Transformer.create();
// };

var Variable = CompilableNode.create('variable', {
    nodeProperties: {
        name: 'variable',
        parentName: 'template',
        childrenName: 'transformers',

        toString() {
            let string = '';

            string += '{';
            string += this.value;
            if (this.transformers.length) {
                string += ' > ';
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
                    if (!this.template) {
                        throw new Error(
                            'Variable.eval must not be called with an array when not assigned to a template'
                        );
                    }

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
    },

    childrenMap: {
        transformer: Transformer
    },

    transform(syntaxNode) {
        var tokens = Tokenizer.createTokenize({
            escape: '\\',
            transform: '>'
        })(syntaxNode.value);

        var escapedTokens = Parser.escapeTokens(tokens);
        var cursor = 0;
        var length = escapedTokens.length;
        var token;
        var transformNode;

        syntaxNode.value = '';

        while (cursor < length) {
            token = escapedTokens[cursor];

            // parse transform child
            if (token.type === 'transform') {
                transformNode = syntaxNode.next('transformer');
                cursor++;
                continue;
            }

            if (transformNode) {
                transformNode.value += token.value;
            } else {
                syntaxNode.value += token.value;
            }
            cursor++;
        }

        syntaxNode.value = syntaxNode.value.trim();

        return syntaxNode;
    }
});

var Constant = CompilableNode.create('constant', {
    nodeProperties: {
        name: 'constant',
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
    }
});

var Template = CompilableNode.create('template', {
    nodeProperties: {
        name: 'template',
        // parentName: 'compiler', // there is no parent to a template
        childrenName: 'expressions',

        eval(input) {
            return this.expressions.map(function(expression) {
                return expression.eval(input);
            }).join('');
        }
    },

    childrenMap: {
        variable: Variable,
        constant: Constant
    },

    transform(syntaxNode) {
        var tokens = Tokenizer.createTokenize({
            escape: '\\',
            open: '{',
            close: '}'
        })(syntaxNode.value);

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

export {Parameter, Transformer, Variable, Constant, Template};
export default Template;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('Parameter', function() {
            var compile = Parameter.compile.bind(Parameter);
            var input = ' test {} \\ ';
            var parameter = compile(input);

            // parameter value is === input, there is no special compile logic
            // the only difference is that input is trimmed

            assert(parameter.value === input.trim());
        });

        this.add('Transformer', function() {
            // var calledOn;
            // var calledWith;
            // var TransformerName = transformerPrototypes.add('transformerName', function() {
            //     calledOn = this;
            //     calledWith = arguments;
            //     return true;
            // });

            // var compile = Transformer.compile.bind(Transformer);
            // var input = ' transformerName : a , b';
            // var transformer = compile(input);

            // assert(transformer.value === 'transformerName');
            // assert(transformer.params.length === 2);
            // assert(transformer.params[0].value === 'a');
            // assert(transformer.params[1].value === 'b');
            // assert(transformer.params[0].transformer === transformer);

            // this.add('transform', function() {
            //     var transformedInput = transformer.eval(10);

            //     assert(transformedInput === true);
            //     assert(calledWith.length === 3);
            //     assert(calledWith[0] === 10);
            //     assert(calledWith[1] === 'a');
            //     assert(calledWith[2] === 'b');
            //     assert(TransformerName.isPrototypeOf(calledOn));
            // });
        });

        this.add('Variable', function() {
            var compile = Variable.compile.bind(Variable);
            var input = ' variableName > transformerA > transformerB : a';
            var variable = compile(input);

            assert(variable.value === 'variableName');
            assert(variable.transformers.length === 2);
            assert(variable.transformers[0].value === 'transformerA');
            assert(variable.transformers[1].value === 'transformerB');
            assert(variable.transformers[1].params.length === 1);

            this.add('eval on null', function() {
                var output = variable.eval(null);
                // console.log(output);
                assert(output === '{variableName > transformerA > transformerB:a}');
            });

            this.add('eval on object', function() {
                var output = variable.eval({variableName: 'test'});
                assert(output === 'test');
            });

            this.add('eval on function', function() {
                var fn = function() {};
                fn.variableName = 'ok';
                var output = variable.eval(fn);
                assert(output === 'ok');
            });

            this.add('eval on array', function() {
                assert.throws(function() {
                    variable.eval([]);
                }, function(e) {
                    return e.name === 'Error';
                });
            });

            this.add('eval on primitives + undefined', function() {
                [undefined, 10, true, 'test'].forEach(function(value) {
                    assert.throws(function() {
                        variable.eval(value);
                    }, function(e) {
                        return e.name === 'TypeError';
                    });
                });
            });

            this.add('transform', function() {
                // how the value is transformed by the variable transformers?
            });
        });

        this.add('Template', function() {
            var compile = Template.compile.bind(Template);
            var input = ' before {variable > transform : 1} after ';
            var template = compile(input);

            assert(template.expressions.length === 3);
            assert(template.expressions[0].value === ' before ');
            assert(template.expressions[1].value === 'variable');
            assert(template.expressions[2].value === ' after ');

            assert(template.parent === null);
            assert(template.expressions[0].template === template);
            assert('parent' in template.expressions[0] === false);

            this.add('eval', function() {
                template = compile('hello {name}, your age is {age}');

                var output = template.eval({name: 'dam'});
                assert(output === 'hello dam, your age is {age}');

                output = template.eval(['dam', 10]);
                assert(output === 'hello dam, your age is 10');
            });
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
