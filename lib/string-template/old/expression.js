import proto from 'env/proto';

import Transformer from './transformer.js';

const Expression = proto.extend('Expression', {
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

export default Expression;
