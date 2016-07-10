import proto from 'env/proto';

const Transformer = proto.extend('StringTemplateFormatter', {
    chars: {
        paramsPrefix: ':',
        paramsSeparator: ','
    },

    expression: undefined,
    name: 'ref',
    params: [],

    constructor(params) {
        if (params) {
            this.params = this.params.slice();
            this.params.push(...params);
        }
    },

    toString() {
        let string = '';

        string += this.name;
        if (this.params.length > 0) {
            string += this.chars.paramsPrefix + this.params.join(this.chars.paramsSeparator);
        }

        return string;
    },

    createArgs(value) {
        let args = [value];
        args.push.apply(args, this.params);
        return args;
    },

    transform(input) {
        return input;
    },

    exec(value) {
        return this.transform.apply(this, this.createArgs(value));
    }
});

Transformer.parse = function(source) {
    source = source.trim();

    let name;
    let chars = this.chars;
    let paramsPrefix = chars.paramsPrefix;
    let paramsPrefixIndex = source.indexOf(paramsPrefix);
    let params;

    if (paramsPrefixIndex > -1) {
        name = source.slice(0, paramsPrefixIndex).trim();
        params = source.slice(paramsPrefixIndex + paramsPrefix.length).split(chars.paramsSeparator);
    } else {
        name = source;
        params = [];
    }

    return {
        name: name,
        params: params
    };
};

export default Transformer;
