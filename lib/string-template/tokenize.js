import Tokenizer from './lib/tokenizer.js';

var tokenizerConfig = {
    escape: '\\',
    whitespace: [' ', '\t', '\r', '\n', '\f'],
    refer: '#',
    open: '{',
    close: '}',
    transform: '>',
    parametrize: ':',
    separate: ','
};
var tokenizer = Tokenizer.create(tokenizerConfig);
var tokenize = tokenizer.tokenize.bind(tokenizer);
tokenize.config = tokenizerConfig;

export default tokenize;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('basic test', function() {
            var tokens = tokenize("before{name}after");

            assert.deepEqual(tokens, [
                {type: 'name', value: 'before'},
                {type: 'open', value: '{'},
                {type: 'name', value: 'name'},
                {type: 'close', value: '}'},
                {type: 'name', value: 'after'}
            ]);
        });

        this.add('escaping', function() {
            var oneEscapeTokens = tokenize("\{name}");
            assert.deepEqual(oneEscapeTokens, [
                {type: 'open', value: '{'},
                {type: 'name', value: 'name'},
                {type: 'close', value: '}'}
            ]);

            var twoEscapeTokens = tokenize("\\{name}");
            assert.deepEqual(twoEscapeTokens, [
                {type: 'escape', value: '\\'},
                {type: 'open', value: '{'},
                {type: 'name', value: 'name'},
                {type: 'close', value: '}'}
            ]);

            var threeEscapeTokens = tokenize("\\\{name}");
            assert.deepEqual(threeEscapeTokens, [
                {type: 'escape', value: '\\'},
                {type: 'open', value: '{'},
                {type: 'name', value: 'name'},
                {type: 'close', value: '}'}
            ]);

            var fourEscapeTokens = tokenize("\\\\{name}");
            assert.deepEqual(fourEscapeTokens, [
                {type: 'escape', value: '\\'},
                {type: 'escape', value: '\\'},
                {type: 'open', value: '{'},
                {type: 'name', value: 'name'},
                {type: 'close', value: '}'}
            ]);
        });

        this.add('more complex test', function() {
            var tokens = tokenize(" \tbefore #{ property > yolo:1,2 > swag} ");

            assert.deepEqual(tokens, [
                {type: 'whitespace', value: ' '},
                {type: 'whitespace', value: '\t'},
                {type: 'name', value: 'before'},
                {type: 'whitespace', value: ' '},
                {type: 'refer', value: '#'},
                {type: 'open', value: '{'},
                {type: 'whitespace', value: ' '},
                {type: 'name', value: 'property'},
                {type: 'whitespace', value: ' '},
                {type: 'transform', value: '>'},
                {type: 'whitespace', value: ' '},
                {type: 'name', value: 'yolo'},
                {type: 'parametrize', value: ':'},
                {type: 'name', value: '1'},
                {type: 'separate', value: ','},
                {type: 'name', value: '2'},
                {type: 'whitespace', value: ' '},
                {type: 'transform', value: '>'},
                {type: 'whitespace', value: ' '},
                {type: 'name', value: 'swag'},
                {type: 'close', value: '}'},
                {type: 'whitespace', value: ' '}
            ]);
        });
    }
};
