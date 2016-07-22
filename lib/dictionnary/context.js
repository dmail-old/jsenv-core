/*
pouvoir définir un filtre particulier avec des custom getPreferenceLevel() & filterMethod()
*/

import proto from 'env/proto';
import * as templateExports from 'env/string-template';

const CompilableNode = templateExports.CompilableNode;
const Tokenizer = templateExports.Tokenizer;
const Parser = templateExports.Parser;

const Parameter = templateExports.Parameter;

const Filter = proto.extend('Filter', {
    name: 'filter',

    constructor() {
        this.args = arguments;
    },

    getPreferenceLevel() {
        return -1;
    },

    filterMethod() {
        return true;
    },

    filter(input) {
        return Boolean(this.filterMethod(input, ...this.args));
    }
});

const Trait = CompilableNode.extend('Trait', {
    name: 'trait',
    parentName: 'context',
    childrenName: 'params',
    childrenMap: {
        parameter: Parameter
    },
    chars: {
        escape: '\\',
        parametrize: ':',
        separate: ',',
        negate: '!'
    },
    isNegated: false,

    filterPrototypes: [Filter],

    populate(syntaxNode) {
        CompilableNode.populate.call(this, syntaxNode);

        if (syntaxNode.isNegated) {
            this.isNegated = true;
        }

        let FilterPrototype = this.filterPrototypes.find(function(TransformerPrototype) {
            return TransformerPrototype.name === this.value;
        }, this);
        if (FilterPrototype === null) {
            throw new Error('missing filter named ' + this.value);
        }

        this.filter = FilterPrototype.create(...this.params.map(function(parameter) {
            return parameter.value;
        }));
    },

    toString() {
        let string = '';

        if (this.isNegated) {
            string += this.chars.negate;
        }
        string += this.value;
        if (this.params.length > 0) {
            string += this.chars.parametrize;
            string += this.params.join(this.chars.separate + ' ');
        }

        return string;
    },

    getPreferenceLevel() {
        return this.filter.getPreferenceLevel();
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
                    parameterNode = syntaxNode.next('parameter');
                } else {
                    parameterNode.value += token.value;
                }
            } else if (token.type === 'parametrize') {
                parameterNode = syntaxNode.next('parameter');
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

const Context = CompilableNode.extend('Context', {
    chars: {
        escape: '\\',
        add: '+'
    },
    childrenName: 'traits',
    childrenMap: {
        trait: Trait
    },
    traits: [], // ensure even the prototype got an empty traits array so that it can be used as if it was instantied

    getPreferenceLevel() {
        return this.traits.reduce(function(previous, trait) {
            previous += trait.getPreferenceLevel();
            return previous;
        }, -1);
    },

    getLevel() {
        return this.traits.length;
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
        var traitNode = syntaxNode.next('trait');

        while (cursor < length) {
            token = escapedTokens[cursor];

            if (token.type === 'add') {
                traitNode = syntaxNode.next('trait');
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
        this.add('Filter', function() {
            var calledWith;
            var calledOn;
            var CustomFilter = Filter.extend({
                filterMethod() {
                    calledWith = arguments;
                    calledOn = this;
                    return 1;
                }
            });
            var customFilter = CustomFilter.create('a');
            var result = customFilter.filter('b');

            assert(calledWith.length === 2);
            assert(calledWith[0] === 'b');
            assert(calledWith[1] === 'a');
            assert(calledOn === customFilter);
            assert(result === true);
        });

        this.add('Trait', function() {
            var trait = Trait.compile('!filter:a');

            assert(trait.isNegated === true);
            assert(trait.filter.args.length === 1);
            assert(trait.filter.args[0] === 'a');
            assert(trait.match() === false);
        });

        this.add('Context', function() {
            var context = Context.compile('filter:a + filter');

            assert(context.traits.length === 2);
            assert(context.traits[0].filter.name === 'filter');
            assert(context.traits[1].filter.name === 'filter');
        });
    }
};
