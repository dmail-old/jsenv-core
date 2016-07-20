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

import proto from 'env/proto';

import CompilableNode from './lib/compilable-node.js';
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

const Transformer = proto.extend('Transformer', {
    name: 'transform',

    constructor() {
        this.args = arguments;
    },

    transformMethod(input) {
        return input;
    },

    transform(input) {
        return this.transformMethod(input, ...this.args);
    }
});

var transformationChars = {
    escape: '\\',
    parametrize: ':',
    separate: ','
};
var Transformation = CompilableNode.create('transformation', {
    nodeProperties: {
        name: 'transformation',
        parentName: 'expression',
        childrenName: 'params',

        transformerPrototypes: [Transformer],

        // params: [],
        // constructor(params) {
        //     if (params) {
        //         this.params = this.params.slice();
        //         this.params.push(...params);
        //     }
        // },

        populate(compiledSyntaxNode) {
            this.super.populate.call(this, compiledSyntaxNode);

            let TransformerPrototype = this.transformerPrototypes.find(function(TransformerPrototype) {
                return TransformerPrototype.name === this.value;
            }, this);
            if (TransformerPrototype === null) {
                throw new Error('missing transformed named ' + this.value);
            }

            this.transformer = TransformerPrototype.create(...this.params.map(function(parameter) {
                return parameter.value;
            }));
        },

        toString() {
            let string = '';

            string += this.value;
            if (this.params.length > 0) {
                string += transformationChars.parametrize;
                string += this.params.join(transformationChars.separate + ' ');
            }

            return string;
        },

        eval(value) {
            return this.transformer.transform(value);
        }
    },

    childrenMap: {
        parameter: Parameter
    },

    createTransformer(name, transformMethod) {
        let TransformerPrototype = Transformer.extend({
            name: name,
            transformMethod: transformMethod
        });

        return TransformerPrototype;
    },

    registerTransformer(TransformerPrototype) {
        this.CompiledNodePrototype.transformerPrototypes.push(TransformerPrototype);
    },

    unregisterTransformer(TransformerPrototype) {
        var list = this.CompiledNodePrototype.transformerPrototypes;
        list.splice(list.indexOf(TransformerPrototype), 1);
    },

    tokenize: Tokenizer.createTokenize({
        escape: transformationChars.escape,
        parametrize: transformationChars.parametrize,
        separate: transformationChars.separate
    }),

    transform(syntaxNode) {
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

var variableChars = {
    transform: '>',
    escape: '\\'
};
var Variable = CompilableNode.create('variable', {
    chars: variableChars,

    nodeProperties: {
        name: 'variable',
        parentName: 'template',
        childrenName: 'transformations',

        toString() {
            let string = '';

            string += this.value;
            if (this.transformations.length) {
                string += ' ' + variableChars.transform + ' ';
                string += this.transformations.join(' ' + variableChars.transform + ' ');
            }

            return string;
        },

        transform(input) {
            var output;
            var transformedInput = this.transformations.reduce(function(previousTransformedInput, transformation) {
                return transformation.eval(previousTransformedInput);
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

        createRawOutput() {
            return {
                evaluated: false,
                value: this.evalRaw()
            };
        },

        createEvaluatedOutput(value) {
            return {
                evaluated: true,
                value: this.transform(value)
            };
        },

        eval(input) {
            let evaluationOutput;

            if (input === null) {
                evaluationOutput = this.createRawOutput();
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
                        evaluationOutput = this.createEvaluatedOutput(input[index]);
                    } else {
                        evaluationOutput = this.createRawOutput();
                    }
                } else {
                    var propertyName = this.value;

                    if (propertyName in input) {
                        evaluationOutput = this.createEvaluatedOutput(input[propertyName]);
                    } else {
                        evaluationOutput = this.createRawOutput();
                    }
                }
            } else {
                throw new TypeError(
                    'Expression.eval first argument must be null, an object or a function (' + input + 'given)'
                );
            }

            this.lastEvaluationOutput = evaluationOutput;

            return evaluationOutput.value;
        }
    },

    childrenMap: {
        transformation: Transformation
    },

    tokenize: Tokenizer.createTokenize({
        escape: variableChars.escape,
        transform: variableChars.transform
    }),

    transform(syntaxNode) {
        var tokens = this.tokenize(syntaxNode.value);
        var escapedTokens = Parser.escapeTokens(tokens);
        var cursor = 0;
        var length = escapedTokens.length;
        var token;
        var transformationNode;

        syntaxNode.value = '';

        while (cursor < length) {
            token = escapedTokens[cursor];

            // parse transform child
            if (token.type === 'transform') {
                transformationNode = syntaxNode.next('transformation');
                cursor++;
                continue;
            }

            if (transformationNode) {
                transformationNode.value += token.value;
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

var templateChars = {
    escape: '\\',
    open: '{',
    close: '}'
};
var Template = CompilableNode.create('template', {
    chars: templateChars,

    nodeProperties: {
        name: 'template',
        // parentName: 'compiler', // there is no parent to a template
        childrenName: 'expressions',

        toString() {
            return this.expressions.reduce(function(previous, expression) {
                var expressionString = expression.toString();

                if (expression.name === 'variable') {
                    expressionString = templateChars.open + expressionString + templateChars.close;
                }

                return previous + expressionString;
            }, '');
        },

        eval(input) {
            return this.expressions.map(function(expression) {
                var evalValue = expression.eval(input);

                if (expression.name === 'variable') {
                    if (expression.lastEvaluationOutput.evaluated === false) {
                        evalValue = templateChars.open + evalValue + templateChars.close;
                    }
                }

                return evalValue;
            }).join('');
        }
    },

    childrenMap: {
        variable: Variable,
        constant: Constant
    },

    tokenize: Tokenizer.createTokenize({
        escape: templateChars.escape,
        open: templateChars.open,
        close: templateChars.close
    }),

    transform(syntaxNode) {
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

export {Parameter, Transformation, Variable, Constant, Template};
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

        this.add('Transformation', function() {
            var calledOn;
            var calledWith;
            var transformer = Transformation.createTransformer('transformerName', function() {
                calledOn = this;
                calledWith = arguments;
                return true;
            });
            Transformation.registerTransformer(transformer);

            var compile = Transformation.compile.bind(Transformation);
            var input = ' transformerName : a , b';
            var transformation = compile(input);

            assert(transformation.value === 'transformerName');
            assert(transformation.params.length === 2);
            assert(transformation.params[0].value === 'a');
            assert(transformation.params[1].value === 'b');
            assert(transformer.isPrototypeOf(transformation.transformer));
            assert(transformation.transformer.args.length === 2);

            this.add('eval', function() {
                var transformedInput = transformation.eval(10);

                assert(transformedInput === true);
                assert(calledWith.length === 3);
                assert(calledWith[0] === 10);
                assert(calledWith[1] === 'a');
                assert(calledWith[2] === 'b');
                assert(calledOn === transformation.transformer);
            });

            Transformation.unregisterTransformer(transformer);
        });

        this.add('Variable', function() {
            var compile = Variable.compile.bind(Variable);
            var input = ' variableName > transform > transform : a';
            var variable = compile(input);

            assert(variable.value === 'variableName');
            assert(variable.transformations.length === 2);
            assert(variable.transformations[0].value === 'transform');
            assert(variable.transformations[1].value === 'transform');

            this.add('eval on null', function() {
                var output = variable.eval(null);
                // console.log(output);
                assert(output === 'variableName > transform > transform:a');
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

            var output;
            template = compile('hello {name}, your age is {age}');
            this.add('eval', function() {
                output = template.eval({name: 'dam'});
                assert(output === 'hello dam, your age is {age}');

                output = template.eval(['dam', 10]);
                assert(output === 'hello dam, your age is 10');

                output = template.eval(null);
                assert(output === 'hello {name}, your age is {age}');
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
