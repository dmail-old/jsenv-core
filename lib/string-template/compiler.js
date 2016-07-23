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
const Transformation = CompilableNode.extend({
    name: 'transformation',
    childPrototype: Parameter,
    chars: {
        escape: '\\',
        parametrize: ':',
        separate: ','
    },

    transformerPrototypes: [Transformer],

    createTransformer(name, transformMethod) {
        let TransformerPrototype = Transformer.extend({
            name: name,
            transformMethod: transformMethod
        });

        return TransformerPrototype;
    },

    registerTransformer(TransformerPrototype) {
        this.transformerPrototypes.push(TransformerPrototype);
    },

    unregisterTransformer(TransformerPrototype) {
        var list = this.transformerPrototypes;
        list.splice(list.indexOf(TransformerPrototype), 1);
    },

    // params: [],
    // constructor(params) {
    //     if (params) {
    //         this.params = this.params.slice();
    //         this.params.push(...params);
    //     }
    // },

    populate(syntaxNode) {
        CompilableNode.populate.call(this, syntaxNode);

        let TransformerPrototype = this.transformerPrototypes.find(function(TransformerPrototype) {
            return TransformerPrototype.name === this.value;
        }, this);
        if (!TransformerPrototype) {
            throw new Error('missing transformed named ' + this.value);
        }

        this.transformer = TransformerPrototype.create(...this.parameters.map(function(parameter) {
            return parameter.value;
        }));
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

// we need that, depending on the type of the syntaxNode we can return a different node (variable or constant)
const Expression = CompilableNode.extend({
    name: 'expression',

    constructor(syntaxNode) {
        /* eslint-disable no-use-before-define */
        if (syntaxNode.name === 'variable') {
            return Variable.compile(syntaxNode);
        }
        return Constant.compile(syntaxNode);
    }
});

const Variable = CompilableNode.extend({
    name: 'variable',
    childPrototype: Transformation,
    chars: {
        transform: '>',
        escape: '\\'
    },

    toString() {
        let string = '';

        string += this.value;
        if (this.transformations.length) {
            string += ' ' + this.chars.transform + ' ';
            string += this.transformations.join(' ' + this.chars.transform + ' ');
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
});
Variable.registerCompiler({
    tokenize: Tokenizer.createTokenize({
        escape: Variable.chars.escape,
        transform: Variable.chars.transform
    }),

    compile(syntaxNode) {
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
                transformationNode = syntaxNode.next();
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

const Template = CompilableNode.extend({
    name: 'template',
    childPrototype: Expression,
    chars: {
        escape: '\\',
        open: '{',
        close: '}'
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

export {CompilableNode, Tokenizer, Parser};
export {Parameter, Transformation, Variable, Constant, Template};
export default Template;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('Parameter', function() {
            var input = ' test {} \\ ';
            var parameter = Parameter.compile(input);

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

            var input = ' transformerName : a , b';
            var transformation = Transformation.compile(input);

            assert(transformation.value === 'transformerName');
            assert(transformation.parameters.length === 2);
            assert(transformation.parameters[0].value === 'a');
            assert(transformation.parameters[1].value === 'b');
            assert(transformation.parameters[0].transformation === transformation);
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
            var input = ' variableName > transform > transform : a';
            var variable = Variable.compile(input);

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
