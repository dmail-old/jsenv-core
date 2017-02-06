import proto from 'proto';

import CompilableNode from './lib/compilable-node.js';

import Variable from './variable.js';
import Constant from './constant.js';

const NodePrototypeList = proto.extend('NodePrototypeList', {
    constructor(...args) {
        this.list = args;
    },

    extend() {
        let extended = proto.extend.apply(this, arguments);
        if (extended.list === this.list) {
            extended.list = this.list.map(function(childPrototype) {
                return childPrototype.extend();
            });
        }
        return extended;
    },

    populate(syntaxNode) {
        let childPrototype = this.list.find(function(childPrototype) {
            return childPrototype.name === syntaxNode.name;
        });
        return childPrototype.compile(syntaxNode);
    }
});

const Expression = CompilableNode.extend({
    name: 'expression',
    childPrototype: NodePrototypeList.create(Variable, Constant),

    constructor() {
        CompilableNode.constructor.apply(this, arguments);
        this.transformerPrototypeStorage = this.transformerPrototypeStorage.branch();
    },

    get transformerPrototypeStorage() {
        return this.childPrototype.list[0].transformerPrototypeStorage;
    },

    set transformerPrototypeStorage(value) {
        this.childPrototype.list[0].transformerPrototypeStorage = value;
    },

    populate(syntaxNode) {
        return this.childPrototype.populate(syntaxNode);
    }
});

export default Expression;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('core', function() {
            assert(Expression.transformerPrototypeStorage === Variable.transformerPrototypeStorage);

            let exp = Expression.create();

            assert(Object.getPrototypeOf(exp.childPrototype) === Expression.childPrototype);
            assert(Object.getPrototypeOf(exp.childPrototype.list[0]) === Expression.childPrototype.list[0]);
            assert(Object.getPrototypeOf(exp.transformerPrototypeStorage) === Expression.transformerPrototypeStorage);
        });
    }
};
