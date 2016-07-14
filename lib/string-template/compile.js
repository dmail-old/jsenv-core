import proto from 'env/proto';
import Item from 'env/item';

import tokenize from './tokenize.js';
import parse from './parse.js';

let tokenizeConfig = tokenize.config;

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
            string += tokenizeConfig.parametrize + this.params.join(tokenizeConfig.separate + ' ');
        }

        return string;
    },

    assignExpression(expression) {
        var transformer = Item.clone(this);
        transformer.expression = expression;
        return transformer;
    },

    fromNode(node) {
        // we should use part.name to be able to find the corresponding transformer method
        // let's ignore this for now
        return Transformer.create(node.children.map(function(nodeChild) {
            return nodeChild.value;
        }));
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

const Expression = proto.extend('Expression', {
    template: undefined, // an expression belongs to a template
    value: undefined,

    constructor(value) {
        this.value = value;
    },

    evalRaw() {
        return this.toString();
    },

    assignTemplate(template) {
        var expression = Item.clone(this);
        expression.template = template;
        return expression;
    }
});

const ConstantExpression = Expression.extend({
    toString() {
        return this.value;
    },

    fromNode(node) {
        return ConstantExpression.create(node.value);
    },

    eval() {
        return this.value;
    }
});

const VariableExpression = Expression.extend({
    isReference: false,
    transformers: [],

    constructor(value) {
        Expression.constructor.call(this, value);
        this.transformers = [];
    },

    fromNode(node) {
        var variableExpression = VariableExpression.create(node.value);
        var transformers = node.children.map(function(partChild) {
            return Transformer.fromPart(partChild);
        }).map(function(transformer) {
            return transformer.assignExpression(variableExpression);
        });

        variableExpression.transformers = transformers;

        return variableExpression;
    },

    toString() {
        let string = '';

        string += tokenizeConfig.open;
        if (this.isReference) {
            string += tokenizeConfig.reference;
        }
        string += this.value;
        if (this.transformers.length) {
            string += tokenizeConfig.transform + this.transformers.join(' ' + tokenizeConfig.transform + ' ');
        }
        string += tokenizeConfig.close;

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

    eval(input) {
        // let scope = options.scope;
        let output;

        if (input === null) {
            output = this.evalRaw();
        } else if (typeof input === 'object' || typeof input === 'function') {
            if (input instanceof Array) {
                var variableExpressions = this.template.expressions.filter(function(expression) {
                    return VariableExpression.isPrototypeOf(expression);
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

const StringTemplate = proto.extend('StringTemplate', {
    constructor(expressions = []) {
        this.expressions = expressions.map(function(expression) {
            return expression.assignTemplate(this);
        }, this);
    },

    eval(input) {
        return this.expressions.map(function(expression) {
            return expression.eval(input);
        }).join('');
    }
});

function createExpressionFromNode(node) {
    if (node.name === 'constant') {
        return ConstantExpression.fromNode(node);
    }
    if (node.name === 'variable') {
        return VariableExpression.fromNode(node);
    }

    throw new Error('unexpected node.name');
}

function compile(input) {
    var tokens = tokenize(input);
    var ast = parse(tokens);
    var expressions = ast.children.map(function(astChildNode) {
        return createExpressionFromNode(astChildNode);
    });
    var stringTemplate = StringTemplate.create(expressions);

    return stringTemplate;
}

// il faut encore tester les transformers qui on en plus un comportement spécial puisque
// il faut maintenir une liste de transformeurs par leur nom pour pouvoir les instancier
// chaque fois qu'ils sont utilisé dans une expression

export default compile;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('compile()', function() {
            var compiled = compile('before{name}after');

            assert(compiled.expressions.length === 3);
            assert(compiled.expressions[0].value === 'before');
            assert(compiled.expressions[1].value === 'name');
            assert(compiled.expressions[2].value === 'after');
        });

        this.add('eval() on null', function() {
            var source = 'hello {name} !';
            var template = compile(source);
            var output = template.eval(null);

            assert(output === source);
        });

        this.add('eval() on object', function() {
            var source = 'hello {name}, your age is {age}';
            var template = compile(source);
            var output = template.eval({name: 'dam'});

            assert(output === 'hello dam, your age is {age}');
        });

        this.add('eval() on function', function() {
            var source = '{name}';
            var template = compile(source);
            var output = template.eval(function test() {});
            // function are considered as object having properties used to produce the output

            assert(output === 'test');
        });

        this.add('eval() on array', function() {
            var source = '{first} {second} {third}';
            var template = compile(source);
            var input = ['a', 'b'];
            var output = template.eval(input);

            assert(output === 'a b {third}');
        });

        this.add('eval() on undefined & string (any non null primitive)', function() {
            var source = '{first}';
            var template = compile(source);

            // undefined
            assert.throws(
                function() {
                    template.compile(undefined);
                },
                function(e) {
                    return e.name === 'TypeError';
                }
            );
            // string
            assert.throws(
                function() {
                    template.compile('yo');
                },
                function(e) {
                    return e.name === 'TypeError';
                }
            );
        });
    }
};
