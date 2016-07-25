import proto from 'env/proto';
import {
    Tokenizer,
    Parser,
    CompilableNode,
    Parameter,
    PrototypeSet
} from 'env/string-template';

const Filter = proto.extend('Filter', {
    name: 'filter',
    trait: null,

    constructor() {
        this.args = arguments;
    },

    getLevel() {
        return -1;
    },

    filterMethod() {
        return true;
    },

    filter(input) {
        return Boolean(this.filterMethod(input, ...this.args));
    }
});

const FilterPrototypeSet = PrototypeSet.extend('FilterPrototypeSet', {
    prototype: Filter
});

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

    filterPrototypeSet: FilterPrototypeSet.create(Filter),

    populate(syntaxNode) {
        CompilableNode.populate.call(this, syntaxNode);

        if (syntaxNode.isNegated) {
            this.isNegated = true;
        }

        let args = this.parameters.map(function(parameter) {
            return parameter.value;
        });
        this.filter = this.filterPrototypeSet.generateByName(syntaxNode.value, ...args);
        this.filter.trait = this;
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

export {Filter, Trait};
export default Trait;

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
    }
};
