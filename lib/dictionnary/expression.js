import {Variable, Constant, Expression} from 'env/string-template';

// variable expression may be reference to know variable (they start with '#')
const ReferencableVariable = Variable.extend({
    chars: Object.assign({}, Variable.chars, {
        refer: '#'
    }),
    isReference: false,

    populate(syntaxNode) {
        Variable.populate.call(this, syntaxNode);
        if (syntaxNode.isReference) {
            this.isReference = true;
        }
        return this;
    },

    toString() {
        var string = '';

        if (this.isReference) {
            string += this.chars.refer;
        }
        string += Variable.toString.call(this);

        return string;
    }
});
ReferencableVariable.compiler = Variable.compiler.extend({
    compile(syntaxNode) {
        let compiledSyntaxNode = Variable.compiler.compile.call(this, syntaxNode);
        if (compiledSyntaxNode.value[0] === ReferencableVariable.chars.refer) {
            compiledSyntaxNode.isReference = true;
            compiledSyntaxNode.value = compiledSyntaxNode.value.slice(1);
        }
        return compiledSyntaxNode;
    }
});

const DictionnaryExpression = Expression.extend({
    childPrototypes: [ReferencableVariable, Constant]
});

export default DictionnaryExpression;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('ReferencableVariable', function() {
            var variable = ReferencableVariable.compile('#name > transform');

            assert(variable.isReference === true);
            assert(variable.value === 'name');
            assert(variable.transformations.length === 1);
        });
    }
};
