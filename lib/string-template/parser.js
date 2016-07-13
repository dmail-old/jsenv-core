import proto from 'env/proto';

import tokenize from './tokenizer.js';

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

    var escapedTokens = [];
    var i = 0;
    var j = tokens.length;
    while (i < j) {
        var token = tokens[i];

        if (token.type === 'escape') {
            if (i < j) {
                i++;
                var nextToken = tokens[i];

                if (nextToken.type !== 'whitespace') { // escape force nonwhitespace token to the 'name' type
                    token = {
                        type: 'name',
                        value: nextToken.value
                    };
                }
            }
        }

        escapedTokens.push(token);
        i++;
    }

    var astNode = SyntaxNode.create('template');
    parseAst(escapedTokens, astNode, 0);

    return astNode;
}

// function transformer(ast) {
//     return ast.children.map(function(node) {
//         return Expressions.create(node);
//     });
// }

export const test = {
    modules: ['@node/assert'],

    main(assert) {
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
    }
};
