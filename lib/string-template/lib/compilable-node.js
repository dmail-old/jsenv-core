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

const SyntaxNodeCompiler = proto.extend('SyntaxNodeCompiler', {
    constructor() {
        // this.compiledNodePrototype = arguments[0];
    },

    compile(syntaxNode) {
        // if node has attribute it would be a good idea to keep them
        return syntaxNode;
    }
});

// long story short : a compilableNode is an object populated by a syntaxNode
// where you can transform the syntaxNode before it's populated in order to obtain the desired tree structure/properties
const CompilableNode = proto.extend('CompilableNode', {
    name: 'node',
    value: '',
    parentName: 'parent',
    childrenName: 'children',
    childrenMap: {},
    compiler: SyntaxNodeCompiler,

    constructor() {
        this[this.parentName] = null;
        this[this.childrenName] = [];
    },

    populate(syntaxNode) {
        // this.syntaxNode = transformedSyntaxNode;
        this.name = syntaxNode.name;
        this.value = syntaxNode.value;

        this[this.childrenName] = syntaxNode.children;
        this[this.parentName] = syntaxNode.parent;
    },

    transformSyntaxNode(syntaxNode) {
        var transformedSyntaxNode = this.compiler.compile(syntaxNode);
        // eslint-disable-next-line no-use-before-define
        if (transformedSyntaxNode !== syntaxNode && SyntaxNode.isPrototypeOf(transformedSyntaxNode) === false) {
            throw new TypeError('transformSyntaxNode must return a syntaxNode');
        }
        return transformedSyntaxNode;
    },

    compile(syntaxNodeOrString) {
        var syntaxNode;
        if (SyntaxNode.isPrototypeOf(syntaxNodeOrString)) {
            syntaxNode = syntaxNodeOrString.clone(false); // no mutation of argument
        } else {
            syntaxNode = SyntaxNode.create(this.name);
            syntaxNode.value = syntaxNodeOrString;
        }

        var transformedSyntaxNode = this.transformSyntaxNode(syntaxNode);

        let childrenMap = this.childrenMap;
        transformedSyntaxNode.children = transformedSyntaxNode.children.map(function(child) {
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

        let node = this.create();
        // update the parent reference
        transformedSyntaxNode.children.forEach(function(nodeChild) {
            // this is not child.parent, child here is already a compiledNode
            nodeChild[nodeChild.parentName] = node;
        });
        node.populate(transformedSyntaxNode);

        return node;
    }
});

CompilableNode.define({
    createCompiler(...args) {
        var SyntaxNodeCompilerPrototype = SyntaxNodeCompiler.extend(...args);
        var syntaxNodeCompiler = SyntaxNodeCompilerPrototype.create(this);
        return syntaxNodeCompiler;
    },

    registerCompiler(...args) {
        let compiler = this.createCompiler(...args);
        this.compiler = compiler;
        this.compile = this.compile.bind(this);
        return this;
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
