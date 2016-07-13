import proto from 'env/proto';
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
        var transformer = this.extend();
        transformer.expression = expression;
        return transformer;
    },

    fromPart(part) {
        // we should use part.name to be able to find the corresponding transformer method
        // let's ignore this for now
        return Transformer.create(part.children.map(function(partChild) {
            return partChild.value;
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

    evalRaw() {
        return this.toString();
    },

    assignTemplate(template) {
        var expression = this.extend();
        expression.template = template;
        return expression;
    }
});

const ConstantExpression = Expression.extend({
    constructor(value) {
        this.value = value;
    },

    toString() {
        return this.value;
    },

    fromPart(part) {
        return ConstantExpression.create(part.value);
    },

    eval() {
        return this.value;
    }
});

const VariableExpression = Expression.extend({
    propertyName: undefined,
    isReference: false,
    transformers: [],

    constructor() {
        this.transformers = [];
    },

    fromPart(part) {
        var variableExpression = VariableExpression.create();
        var transformers = part.children.map(function(partChild) {
            return Transformer.fromPart(partChild);
        }).map(function(transformer) {
            return transformer.assignExpression(variableExpression);
        });

        variableExpression.propertyName = part.value;
        variableExpression.transformers = transformers;

        return variableExpression;
    },

    toString() {
        let string = '';

        string += tokenizeConfig.open;
        if (this.isReference) {
            string += tokenizeConfig.reference;
        }
        string += this.propertyName;
        if (this.transformers.length) {
            string += tokenizeConfig.transform + this.transformers.join(' ' + tokenizeConfig.transform + ' ');
        }
        string += tokenizeConfig.close;

        return string;
    },

    transform(input, options) {
        var output;
        var transformedInput = this.transformers.reduce(function(previousTransformedInput, transformer) {
            return transformer.eval(previousTransformedInput);
        }, input);

        if ('transformer' in options) {
            let compilationTransformer = options.transformer;
            let compilationTransformerBind = options.transformerBind;
            var transformedOutput = compilationTransformer.call(
                compilationTransformerBind,
                transformedInput,
                this,
                options
            );

            output = transformedOutput;
        } else {
            output = transformedInput;
        }

        return output;
    },

    eval(options) {
        let scope = options.scope;
        let output;

        if (scope === null) {
            output = this.evalRaw();
        } else if (scope instanceof Array) {
            var index = this.template.expressions.indexOf(this);
            if (index in scope) {
                output = scope[index];
            } else {
                output = this.evalRaw();
            }
        } else if (typeof scope === 'string') {
            throw new TypeError('string cannot be used as scope');
        } else if (scope === undefined) {
            throw new TypeError('undefined cannot be used as scope');
        } else if (typeof scope === 'object' || typeof scope === 'function') {
            var propertyName = this.propertyName;

            if (propertyName in scope) {
                output = scope[propertyName];
            } else {
                output = this.evalRaw();
            }
        } else {
            throw new TypeError('scope must be null, an object, an array or a function');
        }

        return this.transform(output, options);
    }
});

const StringTemplate = proto.extend('StringTemplate', {
    constructor(expressions) {
        this.expressions = expressions.map(function(expression) {
            return expression.assignTemplate(this);
        }, this);
    },

    exec() {
        return this.expressions.map(function(expression) {
            return expression.eval();
        });
    }
});

function createExpressionFromPart(part) {
    if (part.name === 'constant') {
        return ConstantExpression.fromPart(part);
    }
    if (part.name === 'variable') {
        return VariableExpression.fromPart(part);
    }

    throw new Error('unexpected part.name');
}

function compile(input) {
    var tokens = tokenize(input);
    var parts = parse(tokens);
    var expressions = parts.forEach(function(part) {
        return createExpressionFromPart(part);
    });
    var stringTemplate = StringTemplate.create(expressions);

    return stringTemplate;
}

export default compile;
