import env from 'env';
import SortedArray from 'env/array-sorted';
// import proto from 'env/proto';
import {CompilableNode} from 'env/string-template';

import Definition from './definition.js';

// entry must have its own transformerStorage & filterStorage

const Entry = CompilableNode.extend({
    name: 'entry',
    definitions: [],
    childPrototype: Definition,

    createDefinitionComparer() {
        return SortedArray.createComparer(
            function(definition) {
                return definition.getLevel();
            }
        ).compare;
    },

    match(input) {
        return this.definitions.filter(function(definition) {
            return definition.match(input);
        }, this);
    },

    best(input) {
        let bestMatch = this.definitions.sort(this.createDefinitionComparer()).find(function(definition) {
            return definition.match(input);
        });

        return bestMatch;
    },

    eval(input) {
        let bestDefinition = this.best(input);

        if (!bestDefinition) {
            env.warn('no definition for entry', this.name);
            return this.name;
        }

        return bestDefinition.eval(input);
    }
});
Entry.registerCompiler({
    compile(syntaxNode) {
        var value = syntaxNode.value;

        if (typeof value === 'object') {
            var firstKey = Object.keys(value)[0];
            var definitionValue = value[firstKey];

            syntaxNode.name = firstKey;

            if (typeof definitionValue === 'string') {
                let definitionSyntaxNode = syntaxNode.next();
                definitionSyntaxNode.value = definitionValue;

                syntaxNode.value = '';
                return syntaxNode;
            }

            if (typeof definitionValue === 'object') {
                Object.keys(definitionValue).forEach(function(key) {
                    let definitionSyntaxNode = syntaxNode.next();

                    definitionSyntaxNode.value = {
                        [key]: definitionValue[key]
                    };
                });

                syntaxNode.value = '';
                return syntaxNode;
            }
        }
    }
});

export default Entry;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('compile string', function() {
            let entry = Entry.compile({greetings: 'Hello'});

            assert(entry.name === 'greetings');
            assert(entry.definitions.length === 1);
            assert(entry.definitions[0].value === 'Hello');
            assert(entry.definitions[0].context.toString() === '');
        });

        this.add('compile object', function() {
            var entry = Entry.compile({
                greetings: {
                    'filter:a': 'Bonjour',
                    'filter:b': 'Hello',
                    'filter:c': {
                        filter: 'Hallo'
                    }
                }
            });

            assert(entry.name === 'greetings');
            assert(entry.definitions.length === 3);
            assert(entry.definitions[0].context.toString() === 'filter:a');
            assert(entry.definitions[2].context.toString() === 'filter:c + filter');
            assert(entry.definitions[2].toString() === 'Hallo');
        });
    }
};
