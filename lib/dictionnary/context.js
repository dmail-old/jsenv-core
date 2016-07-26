/*
pouvoir définir un filtre particulier avec des custom getPreferenceLevel() & filterMethod()
*/

import {
    Tokenizer,
    Parser,
    CompilableNode
} from 'env/string-template';

import Trait from './trait.js';

// on ici on a un exemple, les filtre ne doivent pas être enregistré sur Context, enfin ils peuvent
// mais idéalement on les enregistre sur un context particulier et pas l'objet Context global utilisé partout
// pour cette raison chaque instance de Context doit avoir un model Trait spécifique qui à lui-même une liste de filterPrototypes unique

const Context = CompilableNode.extend({
    name: 'context',
    chars: {
        escape: '\\',
        add: '+'
    },
    childPrototype: Trait,
    traits: [], // ensure even the prototype got an empty traits array so that it can be used as if it was instantied

    toString() {
        let string = '';

        string += this.traits.join(' ' + this.chars.add + ' ');

        return string;
    },

    getLevel() {
        return this.traits.reduce(function(previous, trait) {
            previous += trait.getLevel();
            return previous;
        }, -1);
    },

    registerFilter(filterName, filterMethod) {
        return Trait.filterPrototypeSet.register({name: filterName}, {filterMethod: filterMethod});
    },

    unregisterFilter(nameOrPrototype) {
        if (typeof nameOrPrototype === 'string') {
            return Trait.filterPrototypeSet.removeByName(nameOrPrototype);
        }
        return Trait.filterPrototypeSet.remove(nameOrPrototype);
    },

    match(input) {
        // console.log('does', this.trait.traits[0], 'match', compileOptions.preferences);
        // console.log(this.trait.traits[0].match(compileOptions));
        return this.traits.every(function(trait) {
            return trait.match(input);
        });
    }
});
Context.registerCompiler({
    tokenize: Tokenizer.createTokenize({
        escape: Context.chars.escape,
        add: Context.chars.add
    }),

    compile(syntaxNode) {
        var tokens = this.tokenize(syntaxNode.value);
        var escapedTokens = Parser.escapeTokens(tokens);
        var cursor = 0;
        var length = escapedTokens.length;
        var token;
        var traitNode = syntaxNode.next();

        while (cursor < length) {
            token = escapedTokens[cursor];

            if (token.type === 'add') {
                traitNode = syntaxNode.next();
                cursor++;
                continue;
            }

            traitNode.value += token.value;
            cursor++;
        }

        return syntaxNode;
    }
});

export default Context;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('Context', function() {
            var genderFilter = Context.registerFilter('gender', function(input, value) {
                return input.gender === value;
            });
            var youngFilter = Context.registerFilter('age-below', function(input, value) {
                return input.age < value;
            });
            var context = Context.compile('gender:man + age-below:20');

            assert(context.traits.length === 2);
            assert(context.traits[0].filter.name === 'gender');
            assert(context.traits[1].filter.name === 'age-below');
            assert(context.match({gender: 'man', age: 30}) === false);
            assert(context.match({gender: 'woman', age: 10}) === false);
            assert(context.match({gender: 'man', age: 10}) === true);

            Context.unregisterFilter(genderFilter);
            Context.unregisterFilter(youngFilter);
        });
    }
};
