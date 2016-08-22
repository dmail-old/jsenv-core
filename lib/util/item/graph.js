/*

http://blog.benoitvallon.com/data-structures-in-javascript/the-graph-data-structure/
https://www.npmjs.com/package/graph-data-structure

*/

import util from './util.js';

let Node = util.createConstructor({
    constructor(value) {
        // this.links = [];
        this.value = value;
    },

    clone() {
        return new Node(this.value);
    }
});

let NodeLink = util.createConstructor({
    constructor(sourceNode, targetNode, id) {
        this.sourceNode = sourceNode;
        this.targetNode = targetNode;
        this.id = id;
    },

    rebase(sourceNode) {
        return new NodeLink(sourceNode, this.targetNode, this.id);
    },

    redirect(sourceNode, targetNode) {
        return new NodeLink(sourceNode, targetNode, this.id);
    }
});

let Graph = util.createConstructor({
    constructor() {
        this.nodes = [];
        this.links = [];
    },

    findValueIndex(value) {
        let nodes = this.nodes;
        let i = nodes.length;
        while (i--) {
            if (nodes[i].value === value) {
                break;
            }
        }
        return i;
    },

    createNode(value) {
        return new Node(value);
    },

    addNode(node) {
        this.nodes.push(node);
    },

    getOrCreateNode(value) {
        var index = this.findValueIndex(value);
        var node;

        if (index === -1) {
            node = this.createNode(value);
            this.addNode(node);
        } else {
            node = this.nodes[index];
        }

        return node;
    },

    createLink(sourceNode, targetNode, value) {
        let link = new NodeLink(sourceNode, targetNode, value);
        return link;
    },

    addLink(link) {
        this.links.push(link);
        // link.sourceNode.links.push(link);
        // link.targetNode.links.push(link);
    },

    link(sourceNode, targetNodeValue, linkId) {
        let targetNode = this.getOrCreateNode(targetNodeValue);
        let link = this.createLink(sourceNode, targetNode, linkId);
        // add something to ensure that link are not duplicated, for now ignore but link must be unique (unique source, target, id combination)
        this.addLink(link);
        return link;
    },

    getLink(sourceNode, id) {
        return this.links.find(function(link) {
            return link.sourceNode === sourceNode && link.id === id;
        });
    },

    createDepthFirstIterable(node) {
        var nodes = [];
        var visited = [];
        function traverseDFS(node) {
            visited.push(node);
            nodes.push(node);
            this.links.forEach(function(link) {
                if (link.sourceNode === node) {
                    let linkTargetNode = link.targetNode;
                    if (visited.includes(linkTargetNode) === false) {
                        traverseDFS.call(this, linkTargetNode);
                    }
                }
            }, this);
        }

        if (this.nodes.includes(node) === false) {
            throw new Error('node not found');
        }

        traverseDFS.call(this, node);
        return nodes;
    },

    createBreadthFirstIterable(node) {
        if (this.nodes.includes(node) === false) {
            throw new Error('node not found');
        }
        var nodes = [];
        var queue = [];
        queue.push(node);
        var visited = [];
        visited.push(node);

        while (queue.length) {
            node = queue.shift();
            nodes.push(node);
            this.links.forEach(function(link) { // eslint-disable-line no-loop-func
                if (link.sourceNode === node) {
                    let linkTargetNode = link.targetNode;
                    if (visited.includes(linkTargetNode) === false) {
                        visited.push(linkTargetNode);
                        queue.push(linkTargetNode);
                    }
                }
            }, this);
        }

        return nodes;
    },

    slice(node) {
        // we could basically recreate the graph from that value
        // but it would call again maybe costful functions
        // while we could just loop over the graph and keep valid node & links

        let graph = new Graph();
        // because for now node are just wrapper to value we don't have to clone them
        // later node will have links property because it's faster
        // they may even become splited into pointers & references depending if link is external or internal
        // later w'ell have to clone the node & update accordingly its links property

        let selfAndDescendants = Array.from(this.createDepthFirstIterable(node));
        graph.nodes = selfAndDescendants;

        // remember that a link is valid only when source is one of descendants
        graph.links = this.links.filter(function(link) {
            return selfAndDescendants.some(function(selfOrDescendant) {
                return link.sourceNode === selfOrDescendant;
            });
        });

        return graph;
    },

    clone() {
        let graph = new Graph();

        graph.nodes = this.nodes.slice();
        graph.links = this.links.slice();

        return graph;
    },

    // add the node of an other graph to this one, the complexity is that it may invalid some link
    // as seen in valueDefinition.merge
    // but this is a specificty of valueDefinition
    // or we could rather consider that merging an other graph is not possible directly
    // we may want to merge only a part of the graph
    // which is the case for valueDefinition
    // in fact valueDefinition wants to merge the nodes of the other graph except the root one
    // and wants to update their links to that they refer to this.root
    merge(graph) {
        // attach link to rootNode found in graph to selfRootNode
        graph.links.forEach(function(link) {
            // try to find an existing link that refers to an existing node
            let similarLink = this.links.find(function(selfLink) {
                if (selfLink.sourceNode === this.rootNode && link.sourceNode === graph.rootNode) {
                    return true;
                }

                // here there is a special case for the rootNode
                // when link is on the rootNode of the graph, it must be considered as matching this.rootNode
                // even if the value differs
                return selfLink.sourceNode.value === link.sourceNode.value; // they refer to the same value
            }, this);

            if (similarLink) {
                if (similarLink.id === link.id) { // they got the same id, they must be merged
                    // for now link have no merging stategy because they only got an id
                    // when they will have a descriptor they will have a merging strategy that may have several impacts
                    // console.log('merge link from', link.sourceNode.value, 'to', link.targetNode.value, 'at', link.id);
                } else { // their id differs, it's a new link on an existing node, so create targetNode & corresponding link
                    // console.log(
                    //     'add link from', similarLink.sourceNode.value, 'to', link.targetNode.value, 'at', link.id
                    // );
                    this.link(similarLink.sourceNode, link.targetNode.value, link.id);
                }
            } else {
                // the node is unkown, first add it, then add a link on it
                // console.log(
                //     'create new target node', link.sourceNode.value,
                //     'for a link to', link.targetNode.value, 'at', link.id
                // );
                let addedNode = graph.createNode(link.sourceNode.value);
                this.addNode(addedNode);
                this.link(addedNode, link.targetNode.value, link.id);
            }
        }, this);
    }
});

Graph.from = function(value) {
    let graph = new Graph();

    function createNodeLinks(node) {
        Object.keys(node.value).forEach(function(key) {
            let propertyValue = node.value[key];
            let link = graph.link(node, propertyValue, key);

            if (typeof propertyValue === 'object') {
                createNodeLinks(link.targetNode);
            }
        });
    }

    graph.rootNode = graph.createNode(value);
    graph.nodes.push(graph.rootNode);
    createNodeLinks(graph.rootNode);

    return graph;
};

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('core', function() {
            let value = {
                user: {
                    gender: 'man',
                    item: {
                        name: 'item'
                    },
                    man: true
                },
                bar: true
            };

            let graph = Graph.from(value);
            let valueNode = graph.getOrCreateNode(value);

            assert(valueNode.value === value);
            let trueNode = graph.getOrCreateNode(true);
            let barLink = graph.getLink(valueNode, 'bar');
            assert(barLink.id === 'bar');
            assert(barLink.sourceNode === valueNode);
            assert(barLink.targetNode === trueNode);
            let userLink = graph.getLink(valueNode, 'user');
            assert(userLink.id === 'user');
            assert(userLink.sourceNode === valueNode);
            let userNode = userLink.targetNode;
            let userManLink = graph.getLink(userNode, 'man'); // man link is at index 1 because at index 0 there is the link with valueNode
            assert(userManLink.id === 'man');

            assert(graph.createDepthFirstIterable(valueNode)[2].value === 'man'); // 0 is value, 1 is value.user, 2 is value.user.gender
            console.log(graph.createDepthFirstIterable(valueNode));
            assert(graph.createBreadthFirstIterable(valueNode)[2].value === true); // 0 is value, 1 is value.user, 2 is value.bar

            let userGraph = graph.slice(userNode);
            assert(userGraph.nodes.includes(valueNode) === false);
            assert(userGraph.links.includes(userLink) === false);
            assert(userGraph.links.includes(userManLink) === true);
        });

        this.add('merge', function() {
            let a = {
                foo: true
            };
            let b = {
                bar: true
            };

            let aGraph = Graph.from(a);
            let bGraph = Graph.from(b);

            aGraph.merge(bGraph);

            assert(aGraph.nodes.length === 2); // a & true
            assert(aGraph.nodes[0].value === a);
            assert(aGraph.nodes[1].value === true);
            assert(aGraph.links.length === 2); // foo & bar
            assert(aGraph.links[0].id === 'foo');
            assert(aGraph.links[1].id === 'bar');
        });
    }
};
