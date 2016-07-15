// https://github.com/thejameskyle/the-super-tiny-compiler/blob/master/super-tiny-compiler.js

import proto from 'env/proto';

// import Tokenizer from './tokenizer.js';
// import Parser from './parser.js';
// import Generator from './generator.js';

// generate(node, parentNode) {
//     var nodeName = node.name;
//     var nodePrototypes = this.nodePrototypes;

//     if (nodeName in nodePrototypes) {
//         var nodePrototype = nodePrototypes[nodeName];
//         var nodeObject = nodePrototype.create();

//         nodeObject.populate(node, parentNode);

//         return nodeObject;
//     }
//     throw new Error('unexpected node ' + nodeName);
// }

const SyntaxNode = proto.extend('SyntaxNode', {
    constructor(name, meta) {
        this.name = name;
        // this.source = '';
        this.value = '';
        this.children = [];
        if (meta) { // nope, it will be setAttribute/getAttribute, that's better
            this.meta = meta;
        }
    },

    rename(name) {
        this.name = name;
    },

    next(type, meta) {
        var child = SyntaxNode.create(type, meta);
        this.children.push(child);
        child.parent = this;
        return child;
    }
});

const GeneratedObjectPrototype = proto.extend('Generator', {
    parentName: 'parent',
    childrenName: 'children',

    constructor() {

    },

    transformName(name) {
        return name;
    },

    transformValue(value) {
        return value;
    },

    transformChildren(children) {
        return children;
    },

    transformParent(parent) {
        return parent;
    },

    transformCompiledNode(compiledNode) {
        // if node has attribute it would be a good idea to keep them
        return {
            name: this.transformName(compiledNode.name),
            value: this.transformValue(compiledNode.value),
            children: this.transformChildren(compiledNode.children),
            parent: this.transformParent(compiledNode.parent)
        };
    },

    populate(compiledNode) {
        this.compiledNode = this.transformCompiledNode(compiledNode);
        this.name = this.compiledNode.name;
        this.value = this.compiledNode.value;
        this[this.childrenName] = this.compiledNode.children;
        this[this.parentName] = this.compiledNode.parent;
    }
});

const Compiler = proto.extend('Compiler', {
    generatedObjectPrototype: GeneratedObjectPrototype,

    constructor(name, compileNode) {
        this.generators = {};

        this.name = name;
        if (compileNode) {
            this.compileNode = compileNode;
        }
    },

    registerGeneratedPrototype(...args) {
        this.generatedObjectPrototype = this.generatedObjectPrototype.extend(...args);
        return this.generatedObjectPrototype;
    },

    generateObjectFromNode(compiledNode) {
        var object = this.generatedObjectPrototype.create();

        var childrenMap = object.childrenMap;
        if (childrenMap) {
            compiledNode.children = compiledNode.children.map(function(child) {
                var childName = child.name;
                if (childName in childrenMap) {
                    var childCompiler = childrenMap[childName];
                    if (Compiler.isPrototypeOf(childCompiler)) {
                        // console.log('auto generates', child.name, 'for', compiledNode.name);
                        return childCompiler.generate(child);
                    }
                    throw new Error(
                        'child compiled for ' + child.name + ' must be a compiler (given:' + childCompiler + ')'
                    );
                }
                throw new Error('uncompilable child ' + child.name);
            }, this);
        }

        object.populate(compiledNode);

        return object;
    },

    compileNode(node) {
        return node;
    },

    generate(node) {
        var compiledNode = this.compileNode(node);

        // crée l'object correspondant
        var object = this.generateObjectFromNode(compiledNode);

        return object;
    },

    compile(input) {
        var astNode = SyntaxNode.create(this.name);

        astNode.value = input;

        return this.generate(astNode);
    }
});

export default Compiler;
