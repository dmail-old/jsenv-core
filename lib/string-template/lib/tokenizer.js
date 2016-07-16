import proto from 'env/proto';

const TokenDetector = proto.extend('TokenDetector', {
    constructor(type) {
        this.type = type;
    },

    read() {
        throw new Error('TokenDetector.read() not implemented');
    },

    generate(input, index) {
        var value = this.read(input, index);

        if (value) {
            return {
                type: this.type,
                value: value
            };
        }
        return null;
    }
});

const CharTokenDetector = TokenDetector.extend('CharTokenDetector', {
    constructor(type, char) {
        TokenDetector.constructor.call(this, type);
        this.char = char;
    },

    read(input, inputIndex) {
        if (this.char === input[inputIndex]) {
            return this.char;
        }
        return '';
    }
});

const CharSequenceTokenDetector = TokenDetector.extend('CharSequenceTokenDetector', {
    constructor(type, charSequence) {
        TokenDetector.constructor.call(this, type);
        this.charSequence = charSequence;
    },

    read(input, inputIndex) {
        var charSequence = this.charSequence;
        var charSequenceLength = charSequence.length;
        var inputLength = input.length;

        if (inputIndex + charSequenceLength > inputLength) {
            return '';
        }

        var value = '';
        var index = 0;
        while (inputIndex < inputLength) {
            var inputChar = input[inputIndex];
            var sequenceChar = charSequence[index];

            if (inputChar === sequenceChar) {
                value += inputChar;
                inputIndex++;
                index++;

                // end of the charSequence
                if (index === charSequenceLength) {
                    break;
                }
            } else {
                value = '';
                break;
            }
        }

        return value;
    }
});

const OneOfCharTokenDetector = TokenDetector.extend('OneOfCharTokenDetector', {
    constructor(type, charList) {
        TokenDetector.constructor.call(this, type);
        this.charList = charList;
    },

    read(input, inputIndex) {
        var inputChar = input[inputIndex];
        var charList = this.charList;
        var i = charList.length;
        var value;

        while (i--) {
            if (charList[i] === inputChar) {
                value = inputChar;
                break;
            }
        }

        return value;
    }
});

function createDetectors(detectors) {
    return Object.keys(detectors).map(function(detectorType) {
        var detectorValue = detectors[detectorType];

        if (typeof detectorValue === 'string') {
            if (detectorValue.length === 1) {
                return CharTokenDetector.create(detectorType, detectorValue);
            }
            return CharSequenceTokenDetector.create(detectorType, detectorValue);
        }
        if (detectorValue instanceof Array) {
            return OneOfCharTokenDetector.create(detectorType, detectorValue);
        }
        throw new TypeError('a detector must be a string or an array');
    });
}

const Tokenizer = proto.extend('Tokenizer', {
    constructor(detectors = {}) {
        this.detectors = createDetectors(detectors);
    },

    createTokenize(detectors) {
        var tokenizer = Tokenizer.create(detectors);
        return tokenizer.tokenize.bind(tokenizer);
    },

    tokenize(input) {
        var index = 0;
        var length = input.length;
        var tokens = [];
        var detectors = this.detectors;
        var rest;
        // var previousToken;

        while (index < length) {
            var i = 0;
            var j = detectors.length;
            var token;
            for (;i < j; i++) {
                token = detectors[i].generate(input, index);
                if (token) {
                    break;
                }
            }

            if (token) {
                if (rest) {
                    tokens.push({
                        type: 'name',
                        value: rest
                    });
                    rest = undefined;
                }

                tokens.push(token);

                index += token.value.length;
                // previousToken = token;
            } else if (rest) {
                rest += input[index];
                index++;
            } else {
                rest = input[index];
                index++;
            }
        }

        if (rest) {
            tokens.push({
                type: 'name',
                value: rest
            });
        }

        return tokens;
    }
});

export default Tokenizer;

/*
this.add('tokenize', function() {
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
            {type: 'name', value: ' \tbefore #'},
            {type: 'open', value: '{'},
            {type: 'name', value: ' property > yolo:1,2 > swag'},
            {type: 'close', value: '}'},
            {type: 'name', value: ' '}
        ]);
    });

    // nope, this become much more simple because transformer is not implemented by default
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
});
*/
