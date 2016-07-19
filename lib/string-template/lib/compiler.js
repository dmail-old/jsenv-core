// https://github.com/thejameskyle/the-super-tiny-compiler/blob/master/super-tiny-compiler.js

import proto from 'env/proto';

const SyntaxNode = proto.extend('SyntaxNode', {
    constructor(name, parent) {
        this.value = '';
        this.children = [];

        this.name = name;
        this.parent = parent || null;
        // if (meta) { // nope, it will be setAttribute/getAttribute, that's better
        //     this.meta = meta;
        // }
    },

    rename(name) {
        this.name = name;
    },

    clone(deep = false) {
        var syntaxNode = SyntaxNode.create(this.name, this.parent);
        syntaxNode.value = this.value; // value is a string no need to clone it
        if (deep) {
            syntaxNode.children = this.children.map(function(child) {
                let childClone = child.clone(deep);
                childClone.parent = syntaxNode;
                return childClone;
            });
        } else {
            syntaxNode.children = this.children;
        }

        return syntaxNode;
    },

    next(type) {
        var child = SyntaxNode.create(type, this);
        this.children.push(child);
        return child;
    }
});

const CompiledNode = proto.extend('CompiledNode', {
    name: 'node',
    value: '',
    parentName: 'parent',
    childrenName: 'children',

    constructor() {
        this[this.parentName] = null;
        this[this.childrenName] = [];
    },

    populate(compiledSyntaxNode) {
        // this.syntaxNode = transformedSyntaxNode;
        this.name = compiledSyntaxNode.name;
        this.value = compiledSyntaxNode.value;

        this[this.childrenName] = compiledSyntaxNode.children;
        this[this.parentName] = compiledSyntaxNode.parent;
    }
});

const CompilableNode = proto.extend('CompilableNode', {
    CompiledNodePrototype: CompiledNode,
    nodeProperties: {},
    childrenMap: {},

    constructor(name, properties) {
        this.name = name;
        Object.assign(this, properties);

        let CompiledNodePrototype = CompiledNode.extend(this.name, this.nodeProperties);
        this.CompiledNodePrototype = CompiledNodePrototype;
    },

    transform(syntaxNode) {
        // if node has attribute it would be a good idea to keep them
        return syntaxNode;
    },

    transformSyntaxNode(syntaxNode) {
        var transformedSyntaxNode = this.transform(syntaxNode);
        // eslint-disable-next-line no-use-before-define
        if (transformedSyntaxNode !== syntaxNode && SyntaxNode.isPrototypeOf(transformedSyntaxNode) === false) {
            throw new TypeError('transformSyntaxNode must return a syntaxNode');
        }
        return transformedSyntaxNode;
    },

    compile(syntaxNodeOrString) {
        var syntaxNode;

        if (SyntaxNode.isPrototypeOf(syntaxNodeOrString)) {
            syntaxNode = syntaxNodeOrString;
        } else {
            syntaxNode = SyntaxNode.create(this.name);
            syntaxNode.value = syntaxNodeOrString;
        }

        let transformedSyntaxNode = this.transformSyntaxNode(syntaxNode);
        let compiledSyntaxNode = transformedSyntaxNode.clone(false);
        let childrenMap = this.childrenMap;
        compiledSyntaxNode.children = compiledSyntaxNode.children.map(function(child) {
            var childName = child.name;
            if (childName in childrenMap) {
                var childCompilableNode = childrenMap[childName];
                // eslint-disable-next-line no-use-before-define
                if (CompilableNode.isPrototypeOf(childCompilableNode)) {
                    // console.log('auto generates', child.name, 'for', compiledNode.name);
                    return childCompilableNode.compile(child);
                }
                throw new Error(
                    'childrenMap must map' + child.name + ' to a compilableNode (given:' + childCompilableNode + ')'
                );
            }
            throw new Error('uncompilable child ' + child.name);
        }, this);

        let CompiledNodePrototype = this.CompiledNodePrototype;
        let compiledNode = CompiledNodePrototype.create();
        // update the parent reference
        compiledSyntaxNode.children.forEach(function(compiledNodeChild) {
            // this is not child.parent, child here is already a compiledNode
            compiledNodeChild[compiledNodeChild.parentName] = compiledNode;
        });
        compiledNode.populate(compiledSyntaxNode);

        return compiledNode;
    }
});

export default CompilableNode;

/*
this.add('compile()', function() {
    this.add('core', function() {
        var compiled = compile('before{name}after');

        assert(compiled.expressions.length === 3);
        assert(compiled.expressions[0].value === 'before');
        assert(compiled.expressions[1].value === 'name');
        assert(compiled.expressions[2].value === 'after');

        assert(Constant.isPrototypeOf(compiled.expressions[0]));
    });
});
*/
