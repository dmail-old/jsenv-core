import Parser from './lib/parser.js';

var parser = Parser.create(parseRoot);
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

        /*
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
        */

        function parseEqual(source, properties) {
            var tokens = tokenize(source);
            var ast = parse(tokens);

            assert.deepEqual(ast.children, properties);
        }

        /*
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
        */

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

        /*
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
        */
    }
};
