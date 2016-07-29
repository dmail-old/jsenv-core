import CompilableNode from './lib/compilable-node.js';

import Variable from './variable.js';
import Constant from './constant.js';

const Expression = CompilableNode.extend({
    name: 'expression',
    childPrototypes: [Variable, Constant],

    constructor() {
        CompilableNode.constructor.apply(this, arguments);
        this.childPrototypes = this.childPrototypes.map(function(childPrototype) {
            return childPrototype.extend();
        });
        this.transformerStorage = this.transformerStorage.branch();
    },

    get transformerPrototypeStorage() {
        return this.childPrototypes[0].transformerPrototypeStorage;
    },

    set transformerPrototypeStorage(value) {
        this.childPrototypes[0].transformerPrototypeStorage = value;
    },

    populate(syntaxNode) {
        let childPrototype = this.childPrototypes.find(function(childPrototype) {
            return childPrototype.name === syntaxNode.name;
        });
        return childPrototype.compile(syntaxNode);
    }
});

export default Expression;
