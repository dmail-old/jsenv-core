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

    transformNode(node) {
        // if node has attribute it would be a good idea to keep them
        return {
            name: this.transformName(node.name),
            value: this.transformValue(node.value)
        };
    },

    populate(node) {
        this.node = this.transformNode(node);
        this.name = this.node.name;
        this.value = this.node.value;
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

    generateObjectFromNode(node, parent) {
        var object = this.generatedObjectPrototype.create();

        var children = node.children;
        var childrenMap = object.childrenMap;
        if (childrenMap) {
            children = children.map(function(child) {
                var childName = child.name;
                if (childName in childrenMap) {
                    var childCompiler = childrenMap[childName];
                    if (Compiler.isPrototypeOf(childCompiler)) {
                        // console.log('auto generates', child.name, 'for', compiledNode.name);
                        return childCompiler.generate(child, object);
                    }
                    throw new Error(
                        'child compiled for ' + child.name + ' must be a compiler (given:' + childCompiler + ')'
                    );
                }
                throw new Error('uncompilable child ' + child.name);
            }, this);
        }

        object.populate(node);
        object[object.childrenName] = children;
        if (parent) {
            object[object.parentName] = parent;
        }

        return object;
    },

    compileNode(node) {
        return node;
    },

    generate(node, parent) {
        var compiledNode = this.compileNode(node);

        // crée l'object correspondant
        var object = this.generateObjectFromNode(compiledNode, parent);

        return object;
    },

    compile(input) {
        var astNode = SyntaxNode.create(this.name);

        astNode.value = input;

        return this.generate(astNode);
    }
});

export default Compiler;

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
