import CompilableNode from './lib/compilable-node.js';
import Tokenizer from './lib/tokenizer.js';
import Parser from './lib/parser.js';

import Transformation from './transformation.js';

const Expression = CompilableNode.extend({
    name: 'expression',
    childPrototypes: [],

    populate(syntaxNode) {
        let childPrototype = this.childPrototypes.find(function(childPrototype) {
            return childPrototype.name === syntaxNode.name;
        });
        return childPrototype.compile(syntaxNode);
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

Expression.childPrototypes.push(Variable, Constant);

export default Expression;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
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
    }
};
