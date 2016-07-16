// maybe refer should be inside the open sequences like '{#name}' instead of '#{name}'
// that would simplify the refer check (avoid backward check) and is maybe more intelligent
// yeah let's do this
// I got the feeling that we could completely split the concept of tokenize before{{inside}}after
// and later also tokenize what is inside to add the concept of 'refer' and 'transformer' etc

import proto from 'env/proto';

var Parser = proto.extend('Parser', {
    escapeTokens(tokens) {
        // vu la tournure que ça prend faudrais ignorer les escapes qui sont avant { et } mais laisser les autres
        // puisque tokenize et parse du contenu de l'expression va changer aussi
        // mais est ce qu'on peut vraiment découpler à ce point je pense pas que ce soit une bonne idée puisque le contenu
        // de l'expression pourrait influencer sa fermeture ou non etc...
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

        return escapedTokens;
    }
});

export default Parser;

/*
this.add('parse()', function() {
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
});
*/
