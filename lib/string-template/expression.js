import proto from 'env/proto';

import Transformer from './transformer.js';

const Expression = proto.extend('Expression', {
    chars: {
        refer: '#',
        open: '{',
        close: '}',
        transform: '>',
        parametrize: ':',
        separate: ','
    },

    template: undefined, // expression belongs to a template, always
    index: undefined,
    escaped: false,
    reference: false,
    key: '',
    transformers: [],

    constructor(key) {
        this.key = key;
    },

    toString() {
        let string = '';
        let chars = this.chars;

        if (this.reference) {
            string += chars.reference;
        }
        string += chars.open;
        string += this.key;
        if (this.transformers.length) {
            string += Transformer.chars.paramsPrefix + this.transformers.join(' ' + chars.transformerSeparator + ' ');
        }
        string += chars.close;

        return string;
    },

    evalRaw() {
        return this.toString();
    },

    transform(output, options) {
        let transformers = this.transformers.map(function(transformerData) {
            let transformer = options.instantiateTransformer(transformerData);
            transformer.options = options;
            transformer.expression = this;
            return transformer;
        });

        output = transformers.reduce(function(previousOutput, transformer) {
            return transformer.exec(previousOutput);
        }, output);

        let compilationTransformer = options.transformer;
        let compilationTransformerBind = options.transformerBind;
        if (compilationTransformer) {
            output = compilationTransformer.call(compilationTransformerBind, output, this.index, options);
        }

        return output;
    },

    eval(options) {
        let scope = options.scope;
        let output;

        if (scope === null) {
            output = this.evalRaw();
        } else if (scope instanceof Array) {
            output = this.index in scope ? scope[this.index] : this.evalRaw();
        } else if (typeof scope === 'string') {
            throw new TypeError('string cannot be used as scope');
        } else if (scope === undefined) {
            throw new TypeError('undefined cannot be used as scope');
        } else {
            output = this.key in scope ? scope[this.key] : this.evalRaw();
        }

        return this.transform(output, options);
    }
});

Expression.parse = function(source) {
    let escaped = false;
    let reference = false;
    let transformers;
    let i = 0;
    let j = source.length;
    let slashCount = 0;
    let char;
    for (;i < j; i++) {
        char = source[i];

        if (char === '\\') {
            slashCount++;
        } else {
            break;
        }
    }
    let expressionContent = source;
    let chars = this.chars;

    if (slashCount) {
        if (slashCount % 2 === 0) {
            // pair: don't touch anything
            expressionContent = expressionContent.slice(slashCount);
        } else {
            // impair amout of slash: ignore expression
            escaped = true;
            expressionContent = expressionContent.slice(1); // remove a slash
        }
    }

    if (expressionContent[0] === chars.reference) {
        reference = true;
        expressionContent = expressionContent.slice(1);
    }

    expressionContent = expressionContent.slice(chars.open.length, -chars.close.length);

    // now I got the source I can parse the transformers
    let key;
    let pipeIndex = expressionContent.indexOf(chars.transformerSeparator);

    if (pipeIndex > 1) {
        key = expressionContent.slice(0, pipeIndex);
        transformers = expressionContent.split(chars.transformerSeparator);
        transformers = transformers.slice(1).map(function(transformerSource) {
            return Transformer.parse(transformerSource);
        }, this);
    } else {
        key = expressionContent;
        transformers = [];
    }

    key = key.trim();

    return {
        escaped: escaped,
        reference: reference,
        key: key,
        transformers: transformers
    };
};

function tokenize(input) {
    var cursor = 0;
    var tokens = [];
    var escapeChar = '\\';
    var openChar = Expression.chars.open;
    var closeChar = Expression.chars.close;
    var referChar = Expression.chars.refer;
    var transformChar = Expression.chars.transform;
    var parametrizeChar = Expression.chars.parametrize;
    var separateChar = Expression.chars.separate;
    var char;
    var length = input.length;
    var rest;
    var token;

    function nextToken(char) {
        if (char === escapeChar) {
            var escapeCount = 1;
            var escapeCursor = cursor + 1;
            var escapeValue = char;
            while (escapeCursor < length) {
                char = input[escapeCursor];
                if (char === escapeChar) {
                    escapeValue += char;
                    escapeCount++;
                    escapeCursor++;
                } else {
                    break;
                }
            }

            // pair amount of escape char : ignore
            if (escapeCount % 2 === 0) {
                cursor = escapeCursor - 1;
                return null;
            }
            // impair amount of escape char: count as an escape attempt
            return {
                type: 'escape',
                value: escapeValue
            };
        }

        if (char === referChar) {
            return {
                type: 'refer',
                value: char
            };
        }

        if (char === openChar) {
            return {
                type: 'open',
                value: char
            };
        }

        if (char === closeChar) {
            return {
                type: 'close',
                value: char
            };
        }

        if (char === transformChar) {
            return {
                type: 'transform',
                value: char
            };
        }

        if (char === parametrizeChar) {
            return {
                type: 'parametrize',
                value: char
            };
        }

        if (char === separateChar) {
            return {
                type: 'separate',
                value: char
            };
        }

        var WHITESPACE = /\s/;
        if (WHITESPACE.test(char)) {
            return {
                type: 'whitespace',
                value: char
            };
        }

        return null;
    }

    while (cursor < length) {
        char = input[cursor];
        token = nextToken(char);

        if (token) {
            if (rest) {
                tokens.push({
                    type: 'name',
                    value: rest
                });
                rest = '';
            }
            tokens.push(token);
            cursor += token.value.length;
        } else if (rest) {
            rest += char;
            cursor++;
        } else {
            rest = char;
            cursor++;
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

var SyntaxNode = proto.extend('SyntaxNode', {
    constructor(name, meta) {
        this.name = name;
        this.value = '';
        this.children = [];
        if (meta) {
            this.meta = meta;
        }
    },

    next(type, meta) {
        var child = SyntaxNode.create(type, meta);
        this.children.push(child);
        return child;
    }
});

function parser(tokens) {
    function parseParametrize(tokens, transformNode, transformCursor) {
        var paramNode = transformNode.next('param');
        var paramCursor = transformCursor;
        var length = tokens.length;
        var token;

        while (paramCursor < length) {
            token = tokens[paramCursor];

            if (token.type === 'separate') {
                paramNode = transformNode.next('param');
                paramCursor++;
                continue;
            }

            // close variable node -> close transform node -> close parametrize node
            if (token.type === 'close') {
                break;
            }

            // transform close -> param close
            if (token.type === 'transform') {
                break;
            }

            // ignore white space in param node
            if (token.type === 'whitespace') {
                paramCursor++;
                continue;
            }

            paramNode.value += token.value;
            paramCursor++;
        }

        return paramCursor;
    }

    function parseTransform(tokens, variableNode, variableCursor) {
        var transformNode;
        var transformCursor = variableCursor;
        var length = tokens.length;
        var token;

        while (transformCursor < length) {
            token = tokens[transformCursor];

            if (token.type === 'transform') {
                transformNode = variableNode.next('transform');
                transformCursor++;
                continue;
            }

            if (token.type === 'parametrize') {
                transformCursor = parseParametrize(tokens, transformNode, transformCursor + 1);
                continue;
            }

            // end of the variable node -> end of the transform node
            if (token.type === 'close') {
                break;
            }

            // ignore white space in transform node
            if (token.type === 'whitespace') {
                transformCursor++;
                continue;
            }

            transformNode.value += token.value;
            transformCursor++;
        }

        return transformCursor;
    }

    function parseVariable(tokens, astNode, astCursor) {
        var variableNode;
        var variableCursor = astCursor;
        var length = tokens.length;
        var token;

        if (variableCursor > 1 && tokens[variableCursor - 2].type === 'refer') {
            variableNode = astNode.next('variable', {refer: true});
        } else {
            variableNode = astNode.next('variable');
        }

        while (variableCursor < length) {
            token = tokens[variableCursor];

            // close the variable node
            if (token.type === 'close') {
                variableCursor++; // consume the token
                break;
            }

            // parse transform child
            if (token.type === 'transform') {
                variableCursor = parseTransform(tokens, variableNode, variableCursor);
                continue;
            }

            // ignore whitespace in a variable node
            if (token.type === 'whitespace') {
                variableCursor++;
                continue;
            }

            variableNode.value += token.value;
            variableCursor++;
        }

        return variableCursor;
    }

    function parseConstant(tokens, astNode, astCursor) {
        var constantNode = astNode.next('constant');
        var constantCursor = astCursor;
        var length = tokens.length;
        var token;

        while (constantCursor < length) {
            token = tokens[constantCursor];

            if (token.type === 'open' && (constantCursor === 0 || tokens[constantCursor - 1].type !== 'escape')) {
                break;
            }

            if (token.type === 'refer' && constantCursor < length && tokens[constantCursor + 1].type === 'open') {
                break;
            }

            // ignore escape used to escape an open token
            if (token.type === 'escape' && constantCursor < length && tokens[constantCursor + 1].type === 'open') {
                constantCursor++;
                continue;
            }

            constantNode.value += token.value;
            constantCursor++;
        }

        return constantCursor;
    }

    function parseAst(tokens, astNode, cursor) {
        var length = tokens.length;
        var token;

        while (cursor < length) {
            token = tokens[cursor];

            if (token.type === 'refer' && cursor < length && tokens[cursor + 1].type === 'open') {
                cursor = parseVariable(tokens, astNode, cursor + 2);
                continue;
            }

            // open must not be escaped
            if (token.type === 'open' && (cursor === 0 || tokens[cursor - 1].type !== 'escape')) {
                cursor = parseVariable(tokens, astNode, cursor + 1);
                continue;
            }

            cursor = parseConstant(tokens, astNode, cursor);
        }
    }

    var astNode = SyntaxNode.create('template');
    parseAst(tokens, astNode, 0);

    return astNode;
}

// function transformer(ast) {
//     return ast.children.map(function(node) {
//         return Expressions.create(node);
//     });
// }

export default Expression;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
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
                var pairEscapeTokens = tokenize("\\{name}");

                assert.deepEqual(pairEscapeTokens, [
                    {type: 'escape', value: '\\'},
                    {type: 'open', value: '{'},
                    {type: 'name', value: 'name'},
                    {type: 'close', value: '}'}
                ]);

                var impairEscapeTokens = tokenize("\\\\{name}");

                assert.deepEqual(impairEscapeTokens, [
                    {type: 'name', value: '\\'},
                    {type: 'open', value: '{'},
                    {type: 'name', value: 'name'},
                    {type: 'close', value: '}'}
                ]);
            });

            this.add('more complex test', function() {
                var tokens = tokenize(" before #{ property > yolo:1,2 > swag} ");

                assert.deepEqual(tokens, [
                    {type: 'whitespace', value: ' '},
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

        this.add('parser', function() {
            this.add('basic', function() {
                var tokens = tokenize("before{name}after");
                var ast = parser(tokens);

                assert.deepEqual(ast, {
                    name: 'template',
                    value: '',
                    children: [
                        {name: 'constant', value: 'before', children: []},
                        {name: 'variable', value: 'name', children: []},
                        {name: 'constant', value: 'after', children: []}
                    ]
                });
            });

            this.add('advanced', function() {
                var tokens = tokenize(" before #{ property > yolo:1,2 > swag} ");
                var ast = parser(tokens);

                assert.deepEqual(ast, {
                    name: 'template',
                    value: '',
                    children: [
                        {name: 'constant', value: ' before ', children: []},
                        {name: 'variable', value: 'property', meta: {refer: true}, children: [
                            {name: 'transform', value: 'yolo', children: [
                                {name: 'param', value: '1', children: []},
                                {name: 'param', value: '2', children: []}
                            ]},
                            {name: 'transform', value: 'swag', children: []}
                        ]},
                        {name: 'constant', value: ' ', children: []}
                    ]
                });
            });
        });

        this.add('parse', function() {
            function parseEqual(source, properties) {
                var tokens = tokenize(source);
                var ast = parser(tokens);

                assert.deepEqual(ast.children, properties);
            }

            this.add("reference", function() {
                parseEqual(
                    '#{name}',
                    [
                        {
                            name: 'variable',
                            value: 'name',
                            meta: {refer: true},
                            children: []
                        }
                    ]
                );
            });

            this.add("core", function() {
                parseEqual(
                    '{name}',
                    [
                        {
                            name: 'variable',
                            value: 'name',
                            children: []
                        }
                    ]
                );
            });

            this.add("impair backslashes", function() {
                parseEqual(
                    '\\{name}',
                    [
                        {
                            name: 'constant',
                            value: '{name}',
                            children: []
                        }
                    ]
                );
            });

            this.add("pair backslashes", function() {
                parseEqual(
                    '\\\\{name}',
                    [
                        {
                            name: 'constant',
                            value: '\\',
                            children: []
                        },
                        {
                            name: 'variable',
                            value: 'name',
                            children: []
                        }
                    ]
                );
            });

            this.add("transformers", function() {
                this.add("core", function() {
                    parseEqual(
                        '{name > length:2,3}',
                        [
                            {
                                name: 'variable',
                                value: 'name',
                                children: [
                                    {
                                        name: 'transform',
                                        value: 'length',
                                        children: [
                                            {
                                                name: 'param',
                                                value: '2',
                                                children: []
                                            },
                                            {
                                                name: 'param',
                                                value: '3',
                                                children: []
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    );
                });

                this.add("many", function() {
                    parseEqual(
                        '{name > length > size}',
                        [
                            {
                                name: 'variable',
                                value: 'name',
                                children: [
                                    {
                                        name: 'transform',
                                        value: 'length',
                                        children: []
                                    },
                                    {
                                        name: 'transform',
                                        value: 'size',
                                        children: []
                                    }
                                ]
                            }
                        ]
                    );
                });
            });
        });
    }
};
