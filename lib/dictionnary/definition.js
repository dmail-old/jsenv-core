import {Template} from 'env/string-template';

import Trait from './trait.js';
import Context from './context.js';
import Expression from './expression.js';

const Definition = Template.extend({
    name: 'definition',
    childPrototype: Expression,
    context: Context, // a meaning always have at least a defaultContext always matching

    constructor() {
        Template.constructor.apply(this, arguments);
        this.context = this.context.create();
    },

    populate(syntaxNode) {
        Template.populate.call(this, syntaxNode);
        if (syntaxNode.context) {
            this.context = syntaxNode.context;
        }
        // if (syntaxNode.key) {
        //     this.key = syntaxNode.key;
        // }
        return this;
    },

    getLevel() {
        return this.context.getLevel();
    },

    match(input) {
        return this.context.match(input);
    }
});
Definition.compiler = Template.compiler.extend({
    compile(syntaxNode) {
        var value = syntaxNode.value;

        if (typeof value === 'string') {
            return Template.compiler.compile.call(this, syntaxNode);
        }
        if (typeof value === 'object') {
            var deepestValue = value;
            // the code below is not acceptable, it should not instantiate directly Trait
            // the syntaxNode must remain a syntaxNode instantiation belongs to an other phase
            // instead of Trait.compile(firstKey) something like Trait.compileAsSyntaxNodeChild(syntaxNode, firstKey)
            var context = Context.create();

            while (deepestValue) {
                let firstKey = Object.keys(deepestValue)[0];
                if (firstKey.length) {
                    let trait = Trait.compile(firstKey);
                    context.appendChild(trait);
                }
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
        this.add('compile reference', function() {
            var definition = Definition.compile('Hello {#name}!');

            assert(definition.expressions[1].name === 'variable');
            assert(definition.expressions[1].isReference === true);
            assert(definition.match() === true);
            assert(definition.getLevel() === -1);
        });

        this.add('compile object', function() {
            let definition = Definition.compile({
                filter: {
                    filter: 'Hello {name}'
                }
            });

            assert(definition.context.traits.length === 2);
            assert(definition.context.toString() === 'filter + filter');
        });
        this.add('compile empty object key', function() {
            let definition = Definition.compile({
                filter: {
                    '': 'Hello'
                }
            });

            assert(definition.context.traits.length === 1);
        });
    }
};
