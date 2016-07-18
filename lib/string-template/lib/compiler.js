// https://github.com/thejameskyle/the-super-tiny-compiler/blob/master/super-tiny-compiler.js

import proto from 'env/proto';

const SyntaxNode = proto.extend('SyntaxNode', {
    constructor(name, parent) {
        this.value = '';
        this.children = [];

        this.name = name;
        this.parent = parent;
        // if (meta) { // nope, it will be setAttribute/getAttribute, that's better
        //     this.meta = meta;
        // }
    },

    rename(name) {
        this.name = name;
    },

    next(type) {
        var child = SyntaxNode.create(type, this);
        this.children.push(child);
        return child;
    }
});

const Compiler = proto.extend('Compiler', {
    name: 'node',
    parentName: 'parent',
    childrenName: 'children',

    constructor(compilableNode) {
        this.compilableNode = compilableNode;
    },

    compileNode(node, parent) {
        var compiledNode = this.compilableNode.create(node);

        var children = node.children;
        var childrenMap = this.childrenMap;
        if (childrenMap) {
            children = children.map(function(child) {
                var childName = child.name;
                if (childName in childrenMap) {
                    var childCompilableNode = childrenMap[childName];
                    // eslint-disable-next-line no-use-before-define
                    if (CompilableNode.isPrototypeOf(childCompilableNode)) {
                        // console.log('auto generates', child.name, 'for', compiledNode.name);
                        return childCompilableNode.compiler.generate(child, compiledNode);
                    }
                    throw new Error(
                        'childrenMap must map' + child.name + ' to a compilableNode (given:' + childCompilableNode + ')'
                    );
                }
                throw new Error('uncompilable child ' + child.name);
            }, this);
        }

        compiledNode.populate(node);
        compiledNode[this.childrenName] = children;
        if (parent) {
            compiledNode[this.parentName] = parent;
        }

        return compiledNode;
    },

    transformNode(node) {
        // if node has attribute it would be a good idea to keep them
        return node;
    },

    generate(node, parent) {
        var transformedNode = this.transformNode(node);
        // eslint-disable-next-line no-use-before-define
        if (node !== transformedNode && CompilableNode.isPrototypeOf(transformedNode) === false) {
            throw new TypeError('transformNode must return a compilableNode');
        }
        var compiledNode = this.compileNode(transformedNode, parent);

        return compiledNode;
    },

    compile(input) {
        var astNode = SyntaxNode.create(this.name);

        astNode.value = input;

        return this.generate(astNode);
    }
});

const CompilableNode = proto.extend('CompilableNode', {
    compilerProperties: { },

    constructor(/* node */) {

    },

    extend() {
        let compilableNode = proto.extend.apply(this, arguments);
        let compiler = Compiler.create(compilableNode);

        Object.assign(compiler, CompilableNode.compilerProperties, compilableNode.compilerProperties);
        compilableNode.compiler = compiler;

        return compilableNode;
    },

    populate(node) {
        this.node = node;
        this.name = this.node.name;
        this.value = this.node.value;
    },

    compile(input) {
        return this.compiler.compile(input);
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
