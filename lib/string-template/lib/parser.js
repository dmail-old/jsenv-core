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
