// maybe refer should be inside the open sequences like '{#name}' instead of '#{name}'
// that would simplify the refer check (avoid backward check) and is maybe more intelligent
// yeah let's do this
// I got the feeling that we could completely split the concept of tokenize before{{inside}}after
// and later also tokenize what is inside to add the concept of 'refer' and 'transformer' etc

import proto from 'env/proto';

var SyntaxNode = proto.extend('SyntaxNode', {
    constructor(name, meta) {
        this.name = name;
        // this.source = '';
        this.value = '';
        this.children = [];
        if (meta) {
            this.meta = meta;
        }
    },

    rename(name) {
        this.name = name;
    },

    next(type, meta) {
        var child = SyntaxNode.create(type, meta);
        this.children.push(child);
        return child;
    }
});

var Parser = proto.extend('Parser', {
    constructor(astNodeName) {
        this.parsers = {};
        this.astNodeName = astNodeName;
    },

    registerParser(nodeName, parser) {
        this.parsers[nodeName] = parser;
    },

    parseNode(nodeName, tokens, currentNode, cursor) {
        var nodeParsers = this.parsers;

        if (nodeName in nodeParsers) {
            return nodeParsers[nodeName].call(this, tokens, currentNode, cursor);
        }
        throw new Error('unparsable node ' + nodeName);
    },

    parse(tokens) {
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

        var astNode = SyntaxNode.create(this.astNodeName);

        this.parseNode(astNode.name, tokens, astNode, 0);

        return astNode;
    }
});

export default Parser;
