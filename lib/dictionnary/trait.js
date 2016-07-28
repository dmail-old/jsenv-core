import {Tokenizer, Parser, CompilableNode, Parameter} from 'env/string-template';

import FilterPrototypeStorage from './filter-prototype-storage.js';

const Trait = CompilableNode.extend('Trait', {
    name: 'trait',
    childPrototype: Parameter,
    chars: {
        escape: '\\',
        parametrize: ':',
        separate: ',',
        negate: '!'
    },
    isNegated: false,
    filterPrototypeStorage: FilterPrototypeStorage,

    constructor() {
        CompilableNode.constructor.apply(this, arguments);
        this.filterPrototypeStorage = this.filterPrototypeStorage.create();
    },

    populate(syntaxNode) {
        CompilableNode.populate.call(this, syntaxNode);

        if (syntaxNode.isNegated) {
            this.isNegated = true;
        }

        let args = this.parameters.map(function(parameter) {
            return parameter.value;
        });
        this.filter = this.filterPrototypeStorage.generateByName(syntaxNode.value, ...args);
        this.filter.trait = this;

        return this;
    },

    toString() {
        let string = '';

        if (this.isNegated) {
            string += this.chars.negate;
        }
        string += this.value;
        if (this.parameters.length > 0) {
            string += this.chars.parametrize;
            string += this.parameters.join(this.chars.separate + ' ');
        }

        return string;
    },

    getLevel() {
        return this.filter.getLevel();
    },

    match(value) {
        return this.filter.filter(value) !== this.isNegated;
    }
});
Trait.registerCompiler({
    tokenize: Tokenizer.createTokenize({
        negate: Trait.chars.negate,
        escape: Trait.chars.escape,
        parametrize: Trait.chars.parametrize,
        separate: Trait.chars.separate
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
            } else if (token.type === 'negate' && syntaxNode.value.trim() === '') {
                syntaxNode.isNegated = true;
            } else {
                syntaxNode.value += token.value;
            }
            cursor++;
        }

        syntaxNode.value = syntaxNode.value.trim();

        return syntaxNode;
    }
});

export default Trait;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('compile', function() {
            var trait = Trait.compile('!filter:a');

            assert(trait.isNegated === true);
            assert(trait.filter.args.length === 1);
            assert(trait.filter.args[0] === 'a');
            assert(trait.match() === false);
        });

        this.add('a filter may belong to a specifi trait only', function() {
            let trait = Trait.create();
            let ageBelowFilter = trait.filterPrototypeStorage.register({
                name: 'age-below',
                filterMethod(input, value) {
                    return input.age < value;
                }
            });

            assert(Trait.filterPrototypeStorage.has('age-below') === false);
            assert(trait.filterPrototypeStorage.get('age-below') === ageBelowFilter);

            trait.compile('age-below:20');
            assert(trait.filter.name === 'age-below');
            assert(trait.filter.args[0] === '20');
            assert(trait.match({age: 21}) === false);
            assert(trait.match({age: 19}) === true);
        });
    }
};
