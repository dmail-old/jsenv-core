// https://github.com/thejameskyle/the-super-tiny-compiler/blob/master/super-tiny-compiler.js

import proto from 'env/proto';

const SyntaxNode = proto.extend('SyntaxNode', {
    childName: 'child',

    constructor(name) {
        this.value = '';
        this.children = [];

        if (name) {
            this.name = name;
        }
        this.parent = null;
        // if (meta) { // nope, it will be setAttribute/getAttribute, that's better
        //     this.meta = meta;
        // }
    },

    rename(name) {
        this.name = name;
    },

    clone(deep = false) {
        var syntaxNode = SyntaxNode.create(this.name, this.parent);
        // syntaxNode.type = this.type; // harcoded for now, maybe Object.getOwnPropertyNames would be better here
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

    next(name) {
        var child = SyntaxNode.create(name || this.childName, this);
        child.parent = this;
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
    // parentName: 'parent',
    // childrenName: 'children',
    childPrototype: null,
    compiler: SyntaxNodeCompiler,

    constructor(syntaxNode) {
        // update the parent reference
        syntaxNode.children.forEach(function(nodeChild) {
            nodeChild[this.name] = this;
        }, this);
        if (this.childPrototype) {
            this[this.childPrototype.name + 's'] = syntaxNode.children;
        } else {
            // it means we don't care about children
            // this.children = syntaxNode.children;
        }

        this.populate(syntaxNode);
    },

    populate(syntaxNode) {
        // this.syntaxNode = transformedSyntaxNode;
        this.name = syntaxNode.name;
        this.value = syntaxNode.value;

        // this[this.childrenName] = syntaxNode.children;
        // this[this.parentName] = syntaxNode.parent;
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

        let childPrototype = this.childPrototype;
        if (childPrototype) {
            syntaxNode.childName = childPrototype.name;
        }

        var transformedSyntaxNode = this.transformSyntaxNode(syntaxNode);

        if (transformedSyntaxNode.children.length) {
            if (CompilableNode.isPrototypeOf(childPrototype) === false) {
                throw new Error('childPrototype must be a compilableNode');
            }

            transformedSyntaxNode.children = transformedSyntaxNode.children.map(function(child) {
                // var childName = child.name;
                // if (childName !== childPrototype.name) {
                //     throw new Error(
                //         'all child name must be ' + childPrototype.name + ' (not ' + childName + ')'
                //     );
                // }
                return childPrototype.compile(child);
            }, this);
        }

        let node = this.create(transformedSyntaxNode);
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

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('core', function() {
            var LeftNode = CompilableNode.extend({
                type: 'left'
            });
            var RightNode = CompilableNode.extend({
                type: 'right'
            });
            var Node = CompilableNode.extend({
                name: 'node',

                constructor(syntaxNode) {
                    if (syntaxNode.name === 'left') {
                        return LeftNode.compile(syntaxNode);
                    }
                    return RightNode.compile(syntaxNode);
                }
            });
            var RootNode = CompilableNode.extend({
                name: 'root',
                childPrototype: Node
            });
            RootNode.registerCompiler({
                compile(syntaxNode) {
                    syntaxNode.next('left');
                    syntaxNode.next('right');

                    return syntaxNode;
                }
            });

            let rootNode = RootNode.compile('');

            assert(LeftNode.isPrototypeOf(rootNode.nodes[0]));
            assert(RightNode.isPrototypeOf(rootNode.nodes[1]));
        });
    }
};
