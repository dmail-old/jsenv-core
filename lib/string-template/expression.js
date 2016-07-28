import CompilableNode from './lib/compilable-node.js';

import Variable from './variable.js';
import Constant from './constant.js';

const Expression = CompilableNode.extend({
    name: 'expression',
    transformerStorage: Variable.transformerStorage,
    childPrototypes: [Variable, Constant],

    constructor() {
        CompilableNode.constructor.apply(this, arguments);
        this.transformerStorage = this.transformerStorage.create();
        this.childPrototypes[0] = this.childPrototypes[0].extend({
            transformerStorage: this.transformerStorage
        });
    },

    populate(syntaxNode) {
        let childPrototype = this.childPrototypes.find(function(childPrototype) {
            return childPrototype.name === syntaxNode.name;
        });
        return childPrototype.compile(syntaxNode);
    }
});

export default Expression;
