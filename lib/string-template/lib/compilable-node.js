// https://github.com/thejameskyle/the-super-tiny-compiler/blob/master/super-tiny-compiler.js

import proto from 'env/proto';
import Item from 'env/item';

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
        return deep ? Item.clone(this) : Item.concat(this); // use concat to prevent children deep cloning
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
    compiler: SyntaxNodeCompiler,

    constructor() {
        this.instancied = true;
        this.childPrototype = this.childPrototype.extend();
        this.children = [];
    },

    get childrenPropertyName() {
        return this.childPrototype.name + 's';
    },

    get children() {
        return this[this.childrenPropertyName];
    },

    set children(value) {
        this[this.childrenPropertyName] = value;
    },

    populate(syntaxNode) {
        let children = syntaxNode.children;
        if (children.length) {
            let childPrototype = this.childPrototype;
            if (CompilableNode.isPrototypeOf(childPrototype) === false) {
                throw new Error('childPrototype must be a compilableNode');
            }

            children = children.map(function(child) {
                // var childName = child.name;
                // if (childName !== childPrototype.name) {
                //     throw new Error(
                //         'all child name must be ' + childPrototype.name + ' (not ' + childName + ')'
                //     );
                // }
                return childPrototype.compile(child);
            }, this);

            // update the parent reference
            children.forEach(function(nodeChild) {
                nodeChild[this.name] = this;
            }, this);
        }

        this.name = syntaxNode.name;
        this.value = syntaxNode.value;
        this.children = children;

        return this;
    },

    appendChild(child) {
        this.children.push(child);
    },

    compileSyntaxNode(syntaxNode) {
        // to be fixed, apparently some already compiledsyntaxNode are re-compiled
        // I think it happens because they are re-compiled by an other compile strategy (a child compiler vs a parent compiler)
        // but it must be verified
        // if (syntaxNode.compiled) {
        //     throw new Error('cannot compile a compiledSyntaxNode');
        // }

        var compiledSyntaxNode = this.compiler.compile(syntaxNode);
        // eslint-disable-next-line no-use-before-define
        if (compiledSyntaxNode !== syntaxNode && SyntaxNode.isPrototypeOf(compiledSyntaxNode) === false) {
            throw new TypeError('transformSyntaxNode must return a syntaxNode');
        }

        compiledSyntaxNode.compiled = true;
        return compiledSyntaxNode;
    },

    compile(syntaxNodeOrInput) {
        let node;
        if (this.instancied) {
            node = this;
        } else {
            node = this.create(); // we must do this.create() first because it may mutate node.childPrototype for instance
        }

        var syntaxNode;
        if (SyntaxNode.isPrototypeOf(syntaxNodeOrInput)) {
            syntaxNode = syntaxNodeOrInput.clone(false); // no mutation of argument
        } else {
            syntaxNode = SyntaxNode.create(this.name);
            syntaxNode.value = syntaxNodeOrInput;
        }

        let childPrototype = node.childPrototype;
        if (childPrototype) {
            syntaxNode.childName = childPrototype.name;
        }

        var compiledSyntaxNode = node.compileSyntaxNode(syntaxNode);

        return node.populate(compiledSyntaxNode);
    }
});
CompilableNode.childPrototype = CompilableNode;

CompilableNode.define({
    createCompiler(...args) {
        var SyntaxNodeCompilerPrototype = SyntaxNodeCompiler.extend(...args);
        var syntaxNodeCompiler = SyntaxNodeCompilerPrototype.create(this);
        return syntaxNodeCompiler;
    },

    registerCompiler(...args) {
        let compiler = this.createCompiler(...args);
        this.compiler = compiler;
        // this.compile = this.compile.bind(this);
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

                populate(syntaxNode) {
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

        this.add('childPrototype can safely be mutated in the constructor', function() {
            let Node = CompilableNode.extend({
                constructor() {
                    this.childPrototype.test = true;
                }
            });
            let node = Node.create();

            assert(Node.childPrototype.hasOwnProperty('test') === false);
            assert(node.childPrototype.hasOwnProperty('test') === true);
        });
    }
};
