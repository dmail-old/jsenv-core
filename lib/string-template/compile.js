// import proto from 'env/proto';

import Compiler from './lib/compiler.js';

var compiler = Compiler.create();

var tokenizerConfig = {
    escape: '\\',
    open: '{',
    close: '}'
};

compiler.registerTokenizer(tokenizerConfig);

compiler.parser.astNodeName = 'template';
compiler.registerParser('constant', function(tokens, templateNode, templateCursor) {
    var constantNode = templateNode.next('constant');
    var constantCursor = templateCursor;
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
});

compiler.registerParser('variable', function(tokens, templateNode, templateCursor) {
    var variableNode = templateNode.next('variable');
    var variableCursor = templateCursor;
    var length = tokens.length;
    var token;

    while (variableCursor < length) {
        token = tokens[variableCursor];

        // close the variable node
        if (token.type === 'close') {
            variableCursor++; // consume the token
            break;
        }

        // ignore whitespace in a variable node
        // if (token.type === 'whitespace') {
        //     variableCursor++;
        //     continue;
        // }

        variableNode.value += token.value;
        variableCursor++;
    }

    return variableCursor;
});

compiler.registerParser('template', function(tokens, templateNode, cursor) {
    var length = tokens.length;
    var token;

    while (cursor < length) {
        token = tokens[cursor];

        if (token.type === 'open') {
            cursor = this.parseNode('variable', tokens, templateNode, cursor + 1);
            continue;
        }

        cursor = this.parseNode('constant', tokens, templateNode, cursor);
    }

    return cursor;
});

compiler.registerNode('constant', {
    parentName: 'template',

    toString() {
        return this.value;
    },

    evalRaw() {
        return this.toString();
    },

    eval() {
        return this.value;
    }
});

compiler.registerNode('variable', {
    parentName: 'template',

    toString() {
        let string = '';

        string += tokenizerConfig.open;
        string += this.value;
        string += tokenizerConfig.close;

        return string;
    },

    evalRaw() {
        return this.toString();
    },

    eval(input) {
        let output;

        if (input === null) {
            output = this.evalRaw();
        } else if (typeof input === 'object' || typeof input === 'function') {
            if (input instanceof Array) {
                var variableExpressions = this.template.expressions.filter(function(expression) {
                    return expression.name === 'variable';
                });
                var index = variableExpressions.indexOf(this);

                if (index in input) {
                    output = input[index];
                } else {
                    output = this.evalRaw();
                }
            } else {
                var propertyName = this.value;

                if (propertyName in input) {
                    output = input[propertyName];
                } else {
                    output = this.evalRaw();
                }
            }
        } else {
            throw new TypeError(
                'Expression.eval first argument must be null, an object or a function (' + input + 'given)'
            );
        }

        return output;
    }
});

compiler.registerNode('template', {
    parentName: 'compiler',
    childrenName: 'expressions',

    eval(input) {
        return this.expressions.map(function(expression) {
            return expression.eval(input);
        }).join('');
    }
});

var compile = compiler.compile.bind(compiler);

export default compile;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('compile()', function() {
            var compiled = compile('before{name}after');

            assert(compiled.expressions.length === 3);
            assert(compiled.expressions[0].value === 'before');
            assert(compiled.expressions[1].value === 'name');
            assert(compiled.expressions[2].value === 'after');
        });

        this.add('eval() on null', function() {
            var source = 'hello {name} !';
            var template = compile(source);
            var output = template.eval(null);

            assert(output === source);
        });

        this.add('eval() on object', function() {
            var source = 'hello {name}, your age is {age}';
            var template = compile(source);
            var output = template.eval({name: 'dam'});

            assert(output === 'hello dam, your age is {age}');
        });

        this.add('eval() on function', function() {
            var source = '{name}';
            var template = compile(source);
            var output = template.eval(function test() {});
            // function are considered as object having properties used to produce the output

            assert(output === 'test');
        });

        this.add('eval() on array', function() {
            var source = '{first} {second} {third}';
            var template = compile(source);
            var input = ['a', 'b'];
            var output = template.eval(input);

            assert(output === 'a b {third}');
        });

        this.add('eval() on undefined & string (any non null primitive)', function() {
            var source = '{first}';
            var template = compile(source);

            // undefined
            assert.throws(
                function() {
                    template.compile(undefined);
                },
                function(e) {
                    return e.name === 'TypeError';
                }
            );
            // string
            assert.throws(
                function() {
                    template.compile('yo');
                },
                function(e) {
                    return e.name === 'TypeError';
                }
            );
        });
    }
};
