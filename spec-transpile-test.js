var test1 = "eval(\"const foo = \\\"foo\\\";\");";
var test2 = "eval(`foo${bar}`);";
var test3 = "\
    var object = {\
        code: transpile`\
            const foo = \"foo\";\
        `\
    };\
";
var test4 = "\
    var object = {\
        code: transpile`(function(value) {\
            var result = [];\
            for (var entry of value) {\
                result.push(entry);\
            }\
            return result;\
        })`\
    };\
";

var customPlugin =  function(babel) {
    var parse = babel.parse;
    var traverse = babel.traverse;
    var t = babel.types;

    return {
        visitor: {
            TaggedTemplateExpression: function(path) {
                var node = path.node;
                if (!t.isIdentifier(node.tag, {name: 'transpile'})) {
                    return;
                }
                console.log('node', node);

                var expressions = node.quasi.expressions;
                var strings = node.quasi.quasis;

                // this is a string of js code to be parsed by babel
                var raw = "";
                var handleString = function(n){
                    // should it be .cooked?
                    // https://github.com/babel/babel/blob/c4a491123e6dfcbc37e970028d9e5c3daa5c5af8/src/acorn/src/expression.js#L515
                    raw += n.value.raw;
                };
                var handleExpression = function(n){
                    cleanAst(n);
                    var proxy = new ProxyIdent(n);
                    proxy.cache();
                    raw += proxy.proxyIdent;
                };

                for (var i=0; i<expressions.length; i++) {
                    handleString(strings[i]);
                    handleExpression(expressions[i]);
                }

                handleString(strings[strings.length - 1]);
                console.log('raw', raw);
                //var intermediateAst = babelParse('(' + raw + ')').body[0].expression;
                //delete intermediateAst.parenthesizedExpression;
                // raw = "(function() { " + raw + " })";

                var code = babel.transform(raw, {
                    plugins: [
                        "transform-es2015-block-scoping"
                    ] 
                }).code;

                var newNode = t.expressionStatement(t.stringLiteral(code));
                path.replaceWith(newNode);
            }     
        }
    };
};

var result = require("babel-core").transform(
    test4,
    {
        plugins: [
            [
                customPlugin
            ]            
        ]
    }
);
console.log('result', result.code);
