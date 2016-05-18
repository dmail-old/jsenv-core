/*

// https://github.com/Polymer/TemplateBinding/blob/master/src/TemplateBinding.js

*/

import proto from 'proto';
import Options from 'jsenv/options';

import Expression from './expression.js';
// import Transformer from './transformer.js';

import Renderer from './renderer.js';

const StringTemplate = proto.extend('StringTemplate', {
    // regex: /{([A-Za-z][A-Za-z0-9]*)[^}]*}/g,
    // regex: /{([A-Za-z]?[A-Za-z0-9]*)}/g,
    regex: /(\\*\#?{[A-Za-z]?[A-Za-z0-9 \|:,]*})/g,
    string: null,
    strings: [],
    expressions: [],
    Renderer: Renderer,

    constructor(string) {
        if (arguments.length > 0) {
            // we parse upon creation to immediatly get any parsing error
            this.parse(string);
        }
    },

    parse(source) {
        source = String(source);

        let index = 0;
        let regex = this.regex;
        let matches;
        let strings = [];
        let expressionDatas = [];
        let string;
        let expressionSource;
        let expressionData;

        regex.lastIndex = 0;
        while (matches = regex.exec(source)) { // eslint-disable-line no-cond-assign
            expressionSource = matches[1];
            expressionData = Expression.parse(expressionSource);

            if (!expressionData.escaped) {
                string = source.slice(index, matches.index);
                strings.push(string);
                // expressionData.index = expressions.length;
                expressionDatas.push(expressionData);
                index = regex.lastIndex;
            }
        }
        strings.push(source.slice(index));

        this.source = source;
        this.strings = strings;
        this.expressions = expressionDatas.map(function(expressionData, index) {
            let expression = Expression.create();

            expression.template = this;
            expression.reference = expressionData.reference;
            expression.key = expressionData.key;
            expression.index = index;
            expression.transformers = expressionData.transformers || [];

            return expression;
        }, this);
    },

    copy() {
        return this.extend();
    }
});

const CompiledProperties = {
    compilationResult: undefined,

    resolve() {
        return this.expressions.map(function(expression) {
            return expression.eval(this.options);
        }, this);
    },

    get values() {
        let compilationResult = this.compilationResult;

        if (compilationResult === undefined) {
            compilationResult = this.resolve();
            this.compilationResult = compilationResult;
        }

        return compilationResult;
    },

    set values(value) {
        this.compilationResult = value;
    },

    // render logic
    tag(fn, bind) {
        return fn.apply(bind, [this.strings].concat(this.values));
    },

    toString() {
        return this.Renderer.renderAsString(this.strings, this.values);
    },

    toArray() {
        return this.Renderer.renderAsArray(this.strings, this.values);
    }
};

StringTemplate.define({
    options: Options.create({
        scope: null,
        transformer: null,
        transformerBind: null,
        instantiateTransformer() {
            throw new Error('instantiateTransformer not defined');
        }
    }),

    compile(options = {}) {
        return this.extend(CompiledProperties, {
            options: Options.create(this.options, options)
        });
    },

    // shortcuts
    exec(scope, map, bind) {
        return this.compile({
            scope: scope,
            transformer: map,
            transformerBind: bind
        });
    },

    render(scope, map, bind) {
        return this.exec(scope, map, bind).toString();
    }
});

/*
format(string, scope) {
    return this.constructor.create(string).render(scope);
},

stringifyValue(value) {
    if (typeof value === 'object') {
        try {
            JSON.stringify(value);
        } catch (e) {
            value = '[Circular]';
        }
    }

    return value;
}

// create a short version of the data
// to resume calling
// logger.log('info', 'name: {name}', {name: 'damien', age:10});
// must ignore the age property to shorten the data passed to the streams
subsetValues(values) {
    let i = 0;
    let j = values.length;
    let subset = {};

    for (;i < j; i++) {
        subset[this.expressions[i]] = this.stringifyValue(values[i]);
    }

    return subset;
},

toJSON() {
    return {
        string: this.string,
        scope: this.scope ? this.subsetValues(this.values) : null
    };
}
*/

export default StringTemplate;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add("parse", function() {
            let result = StringTemplate.create('Hello {name}{ok} !');

            assert.equal(result.strings.join(), 'Hello ,, !');
            assert.equal(result.expressions.join(), '{name},{ok}');
        });

        this.add('render on same template gives != result for != object', function() {
            var tpl = StringTemplate.create('Hello {name} !');

            assert.equal(tpl.render({name: 'damien'}), 'Hello damien !');
            assert.equal(tpl.render({name: 'sandra'}), 'Hello sandra !');
        });

        /*
        this.add('toArray().join equivalent to toString()', function() {
            var tpl = StringTemplate.create('test');

            assert.equal(tpl.toArray().join(''), tpl.toString());
        });
        */
    }
};
