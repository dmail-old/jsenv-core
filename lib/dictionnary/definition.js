import {
    Variable,
    Constant,
    Expression,
    Template
} from 'env/string-template';

import {
    Trait,
    Context
} from './context.js';

// variable expression may be reference to know variable (they start with '#')
const ReferencableVariable = Variable.extend({
    chars: Object.assign({}, Variable.chars, {
        refer: '#'
    }),
    isReference: false,

    populate(syntaxNode) {
        Variable.populate.call(this, syntaxNode);
        if (syntaxNode.isReference) {
            this.isReference = true;
        }
    },

    toString() {
        var string = '';

        if (this.isReference) {
            string += this.chars.refer;
        }
        string += Variable.toString.call(this);

        return string;
    }
});
ReferencableVariable.compiler = Variable.compiler.extend({
    compile(syntaxNode) {
        let compiledSyntaxNode = Variable.compiler.compile.call(this, syntaxNode);
        if (compiledSyntaxNode.value[0] === ReferencableVariable.chars.refer) {
            compiledSyntaxNode.isReference = true;
            compiledSyntaxNode.value = compiledSyntaxNode.value.slice(1);
        }
        return compiledSyntaxNode;
    }
});

const DictionnaryExpression = Expression.extend({
    childPrototypes: [ReferencableVariable, Constant]
});

const Definition = Template.extend({
    name: 'definition',
    childPrototype: DictionnaryExpression,
    context: Context, // a meaning always have at least a defaultContext always matching

    populate(syntaxNode) {
        Template.populate.call(this, syntaxNode);
        if (syntaxNode.context) {
            this.context = syntaxNode.context;
        }
        // if (syntaxNode.key) {
        //     this.key = syntaxNode.key;
        // }
    },

    getLevel() {
        return this.context.getLevel();
    },

    match(input) {
        return this.context.match(input);
    }
});
Definition.compiler = Template.compiler.extend({
    inputType: ['string', 'object'],

    compile(syntaxNode) {
        var value = syntaxNode.value;

        if (typeof value === 'string') {
            return Template.compiler.compile.call(this, syntaxNode);
        }
        if (typeof value === 'object') {
            var deepestValue = value;
            var context = Context.create();

            while (deepestValue) {
                let firstKey = Object.keys(deepestValue)[0];
                let trait = Trait.compile(firstKey);
                context.appendChild(trait);
                deepestValue = deepestValue[firstKey];
                if (typeof deepestValue !== 'object') {
                    break;
                }
            }

            syntaxNode.context = context;
            syntaxNode.value = deepestValue;

            return this.compile(syntaxNode);
        }
    }
});

export default Definition;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('ReferencableVariable', function() {
            var variable = ReferencableVariable.compile('#name > transform');

            assert(variable.isReference === true);
            assert(variable.value === 'name');
            assert(variable.transformations.length === 1);
        });

        this.add('Definition', function() {
            var definition = Definition.compile('Hello {#name}!');

            assert(definition.expressions[1].name === 'variable');
            assert(ReferencableVariable.isPrototypeOf(definition.expressions[1]));
            assert(definition.match() === true);
            assert(definition.getLevel() === -1);

            this.add('compile object', function() {
                definition = Definition.compile({
                    filter: {
                        filter: 'Hello {name}'
                    }
                });

                assert(definition.context.traits.length === 2);
                assert(definition.context.toString() === 'filter + filter');
            });
        });
    }
};
