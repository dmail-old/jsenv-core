/*
https://gist.github.com/six8/1732686
// Depth first search
// As given in http://en.wikipedia.org/wiki/Topological_sorting

https://github.com/eknkc/tsort/blob/master/index.js

-> error

je regarde mon objet, à je sais qu'il a besoin de b et c
je regarde mon object c, je sais qu'il a besoin de b

        http://en.wikipedia.org/wiki/Topological_sorting
        L ← Empty list that will contain the sorted nodes
while there are unmarked nodes do
    select an unmarked node n
    visit(n)
function visit(node n)
    if n has a temporary mark then stop (not a DAG)
    if n is not marked (i.e. has not been visited yet) then
        mark n temporarily
        for each node m with an edge from n to m do
            visit(m)
        mark n permanently
        unmark n temporarily
        add n to head of L

*/

const Node = {
    edges: [],
    marked: false,
    markedTemp: false,

    constructor(object) {
        this.object = object;
    },

    create(object) {
        return new this.constructor(object);
    }
};
Node.constructor.prototype = Node;

const Graph = {
    nodes: null,
    sorted: null,
    firstNodePrototype: null,

    constructor() {
        this.nodes = [];
    },

    create() {
        return new this.constructor();
    },

    createNode(object) {
        return Node.create(object);
    },

    findIndex(object) {
        let nodes = this.nodes;
        let i = nodes.length;
        while (i--) {
            if (nodes[i].object === object) {
                break;
            }
        }
        return i;
    },

    getOrCreateNode(object) {
        let objectProto = Object.getPrototypeOf(object);

        if (this.hasOwnProperty('firstNodePrototype')) {
            var firstNodePrototype = this.firstNodePrototype;
            if (objectProto !== firstNodePrototype) {
                throw new TypeError(
                    'every graph node must share same prototype ' + object + ' does not share ' + firstNodePrototype
                );
            }
        } else {
            this.firstNodePrototype = objectProto;
        }

        var index = this.findIndex(object);
        var node;

        if (index === -1) {
            node = this.createNode(object);
            this.nodes.push(node);
        } else {
            node = this.nodes[index];
        }

        return node;
    },

    register(object, dependencies) {
        var node = this.getOrCreateNode(object);
        if (dependencies) {
            if (this.debug) {
                console.log('set', String(object), 'dependencies to', dependencies.join());
            }

            node.edges = dependencies.map(this.getOrCreateNode, this);
        }
        if (this.sorted) {
            this.sorted = null;
        }
        return this;
    },

    visit(node) {
        if (node.markedTemp === true) {
            throw new Error(
                'There is a cycle in the graph (' + node.object + '). It is not possible to derive a topological sort.'
            );
        }
        if (node.marked === false) {
            node.markedTemp = true;
            node.edges.forEach(this.visit, this);
            node.marked = true;
            node.markedTemp = false;
            this.sorted.push(node.object);
        }
    },

    sort() {
        let sorted = this.sorted;

        if (!this.sorted) {
            sorted = [];
            this.sorted = sorted;
            this.nodes.forEach(this.visit, this);
        }

        return sorted;
    }
};
Graph.constructor.prototype = Graph;

export default Graph;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        function assertSortedTo(graph, expectedSortResult) {
            assert.deepEqual(graph.sort(), expectedSortResult);
        }

        this.add("string", function() {
            let graph = Graph.create();

            graph.register('a', ['b', 'c']);
            graph.register('c', ['b']);

            assertSortedTo(graph, ['b', 'c', 'a']);
        });

        this.add("object", function() {
            let a = {};
            let b = {};
            let c = {};
            let graph = Graph.create();

            graph.register(a, [b, c]);
            graph.register(c, [b]);

            assertSortedTo(graph, [b, c, a]);
        });

        this.add("cyclic dependency", function() {
            assert.throws(
                function() {
                    let a = 'a';
                    let b = 'b';
                    let graph = Graph.create();

                    graph.register(a, [b]);
                    graph.register(b, [a]);
                    graph.sort();
                },
                function(e) {
                    return e.message.startsWith('There is a cycle in the graph');
                }
            );
        });

        this.add("share proto", function() {
            assert.throws(
                function() {
                    let a = {};
                    let b = 10;
                    let graph = Graph.create();

                    graph.register(a, [b]);
                },
                function(e) {
                    return e.name === 'TypeError';
                }
            );
        });

        this.add("preserve order", function() {
            let graph = Graph.create();

            graph.register('c');
            graph.register('b');
            graph.register('a');
            assert.equal(graph.sort().join(), 'c,b,a');
        });
    }
};
