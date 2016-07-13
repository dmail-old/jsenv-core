import Parser from './lib/parser.js';

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
    var variableNode = astNode.next('variable');
    var variableCursor = astCursor;
    var length = tokens.length;
    var token;

    while (variableCursor < length) {
        token = tokens[variableCursor];

        // refer token at the beginning are ignored and set a meta property
        if (token.type === 'refer' && variableCursor === astCursor) {
            variableNode.meta = {refer: true};
            variableCursor++;
            continue;
        }

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

        if (token.type === 'open') {
            break;
        }

        constantNode.value += token.value;
        constantCursor++;
    }

    return constantCursor;
}

var parser = Parser.create(function(tokens, astNode, cursor) {
    var length = tokens.length;
    var token;

    while (cursor < length) {
        token = tokens[cursor];

        if (token.type === 'open') {
            cursor = parseVariable(tokens, astNode, cursor + 1);
            continue;
        }

        cursor = parseConstant(tokens, astNode, cursor);
    }
});
var parse = parser.parse.bind(parser);

export default parse;

export const test = {
    modules: ['@node/assert', './tokenize.js'],

    main(assert, tokenize) {
        tokenize = tokenize.default;

        this.add('basic', function() {
            var tokens = tokenize("before{name}after");
            var ast = parse(tokens);

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
            var tokens = tokenize(" before {#property > yolo:1,2 > swag} ");
            var ast = parse(tokens);

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
            var ast = parse(tokens);

            assert.deepEqual(ast.children, properties);
        }

        this.add("reference", function() {
            parseEqual(
                '{#name}',
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
