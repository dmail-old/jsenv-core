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

    isSelf() {
        return this.sourceNode === this.targetNode;
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

    hasValue(value) {
        return this.findValueIndex(value) > -1;
    },

    findNodeByValue(value) {
        let index = this.findValueIndex(value);
        return index === -1 ? null : this.nodes[index];
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

    removeNode(node) {
        let index = this.nodes.indexOf(node);
        this.nodes.splice(index, 1);
    },

    handleDeadLink(deadLink) {
        let deadLinkTargetNode = deadLink.targetNode;
        let linkUsingRemovedLinkLinkNode = this.links.find(function(link) {
            return link.targetNode.value === deadLinkTargetNode.value;
        });
        let removedCount = 0;
        if (linkUsingRemovedLinkLinkNode) {
            console.log('a link is using the replaced link', linkUsingRemovedLinkLinkNode);
        } else {
            console.log('no link using', deadLinkTargetNode.value, 'removing it');
            this.removeNode(deadLinkTargetNode);

            let i = 0;
            let j = this.links.length;
            for (; i < j; i++) {
                let link = this.links[i];
                if (link.sourceNode === deadLinkTargetNode) {
                    removedCount++;
                    console.log('also remove dead link', link);
                    i += this.removeLink(link);
                }
            }
        }

        return removedCount;
    },

    removeLink(link) {
        let index = this.links.indexOf(link);
        this.links.splice(index, 1);
        return this.handleDeadLink(link);
    },

    replaceLink(replacedLink, link) {
        let index = this.links.indexOf(replacedLink);
        if (index === -1) {
            throw new Error('cannot find link');
        }

        let rebasedLink = link.rebase(replacedLink.sourceNode);
        this.links[index] = rebasedLink;

        if (replacedLink.targetNode.value === rebasedLink.targetNode.value) {
            console.log('rebased link has same target value', rebasedLink.targetNode.value);
        } else {
            console.log('replaced', replacedLink.targetNode.value, 'by', rebasedLink.targetNode.value);
            this.handleDeadLink(replacedLink);

            if (this.hasValue(rebasedLink.targetNode.value) === false) {
                console.log('add node of the rebasedLink', rebasedLink.targetNode.value);
                this.addNode(rebasedLink.targetNode);
            }

            this.links.forEach(function(link) {
                if (link.sourceNode.value === replacedLink.targetNode.value) {
                    console.log(
                        'updating link', link.id,
                        'from', link.sourceNode.value,
                        'to', rebasedLink.targetNode.value
                    );
                    link.sourceNode = rebasedLink.targetNode;
                }
            });
        }
    },

    merge(selfNode, mergedNode, mergedGraph) {
        /* eslint-disable no-loop-func */
        let self = this;
        let redirectedValues = [];
        let valueRedirections = [];
        function mergeLinks(firstNode, secondNode) {
            let index = redirectedValues.indexOf(secondNode.value);
            if (index === -1) {
                redirectedValues.push(secondNode.value);
                valueRedirections.push(firstNode);
            }

            let secondNodeRightLinks = mergedGraph.links.filter(function(mergedGraphLink) {
                return mergedGraphLink.sourceNode === secondNode;// || mergedGraphLink.targetNode === mergedNode;
            });
            // console.log('how many second node right links ?', secondNodeRightLinks.length);
            for (let rightLink of secondNodeRightLinks) {
                let existingRightLink = self.links.find(function(link) {
                    return link.sourceNode === firstNode && link.id === rightLink.id;
                });

                let rightLinkTargetNode = rightLink.targetNode;
                let rightLinkTargetNodeValue = rightLinkTargetNode.value;
                let rightLinkTargetNodeValueIndex = redirectedValues.indexOf(rightLinkTargetNodeValue);
                // console.log('search', rightLinkTargetNodeValue, rightLinkTargetNodeValueIndex, redirectedValues);
                if (rightLinkTargetNodeValueIndex > -1) {
                    let redirectedValueNode = valueRedirections[rightLinkTargetNodeValueIndex];
                    console.log(
                        'the value',
                        rightLinkTargetNodeValue,
                        'is redirected to the node',
                        redirectedValueNode
                    );
                    self.link(redirectedValueNode, redirectedValueNode.value, rightLink.id);
                    console.log('the target node is', rightLinkTargetNode);
                    // mergeLinks(redirectedValueNode, rightLinkTargetNode);
                } else if (existingRightLink) {
                    if (existingRightLink.targetNode.value === rightLinkTargetNode.value) {
                        console.log('right links are the same, nothing to do?');
                        // link are identical, nothing to do
                    } else if (
                        util.isPrimitive(existingRightLink.targetNode.value) ||
                        util.isPrimitive(rightLink.targetNode.value)
                    ) {
                        self.replaceLink(existingRightLink, rightLink); // replace the link (merge)
                    } else {
                        // recursively merge links now
                        console.log(
                            'recursively merge',
                            existingRightLink.targetNode.value,
                            'with',
                            rightLinkTargetNode.value
                        );
                        mergeLinks(existingRightLink.targetNode, rightLink.targetNode);
                    }
                } else {
                    console.log(
                        'unknown right link create one from',
                        firstNode.value,
                        'to',
                        rightLinkTargetNode.value,
                        'at',
                        rightLink.id
                    );
                    self.link(firstNode, rightLinkTargetNode.value, rightLink.id); // duplicate the link in this graph
                    mergeLinks(firstNode, rightLinkTargetNode);
                }
            }
            // there is a special case when a link sourceNode === targetNode
            // he is considered both as a left link and as a right link
            // thus duplicating the link in the graph
            // something must be done about this but later
            // the isSelf() check should be enough

            // let secondNodeLeftLinks = mergedGraph.links.filter(function(mergedGraphLink) {
            //     return mergedGraphLink.targetNode === secondNode;
            // });
            // // console.log('how many second node left links ?', secondNodeLeftLinks.length);
            // for (let leftLink of secondNodeLeftLinks) {
            //     let existingLeftLink = self.links.find(function(link) {
            //         return link.targetNode === firstNode && link.id === leftLink.id;
            //     });
            //     let leftLinkTargetNode = leftLink.targetNode;
            //     let leftLinkTargetNodeValue = leftLinkTargetNode.value;
            //     let leftLinkTargetNodeValueIndex = redirectedValues.indexOf(leftLinkTargetNodeValue);
            //     // console.log('search', rightLinkTargetNodeValue, rightLinkTargetNodeValueIndex, redirectedValues);
            //     if (leftLinkTargetNodeValueIndex > -1) {
            //         let redirectedValueNode = valueRedirections[leftLinkTargetNodeValueIndex];
            //         console.log(
            //             'the value',
            //             leftLinkTargetNodeValueIndex,
            //             'is redirected to the node',
            //             redirectedValueNode
            //         );
            //         self.link(redirectedValueNode, redirectedValueNode.value, leftLink.id);
            //     } else if (leftLink.sourceNode === leftLink.targetNode) {
            //         console.log('left link is self, already handled by right link');
            //         continue;
            //     } else if (leftLink.sourceNode.value === firstNode.value) {
            //         console.log('left link target the firstNode, already handled by right link');
            //         continue;
            //     } else if (existingLeftLink) {
            //         if (existingLeftLink.targetNode.value === leftLinkTargetNode.value) {
            //             // link are identical, nothing to do
            //             console.log('left links are the same, nothing to do?');
            //         } else {
            //             self.replaceLink(existingLeftLink, leftLink); // replace the link (merge)
            //             // recursively merge links too
            //             console.log(
            //                 'recursively merge',
            //                 existingLeftLink.targetNode.value,
            //                 'with',
            //                 leftLinkTargetNode.value
            //             );
            //             mergeLinks(existingLeftLink.targetNode, leftLink.targetNode);
            //         }
            //     } else {
            //         console.log(
            //             'unknown left link create one from',
            //             firstNode.value,
            //             'to',
            //             leftLinkTargetNode.value,
            //             'at',
            //             leftLink.id
            //         );
            //         self.link(firstNode, leftLinkTargetNode.value, leftLink.id); // duplicate the link in this graph
            //     }
            // }
        }

        mergeLinks(selfNode, mergedNode);
    }
});

Graph.from = function(value) {
    let graph = new Graph();

    function createNodeLinks(node) {
        Object.keys(node.value).forEach(function(key) {
            let propertyValue = node.value[key];
            let propertyValueIndex = graph.findValueIndex(propertyValue);
            if (propertyValueIndex === -1) {
                let link = graph.link(node, propertyValue, key);
                if (typeof propertyValue === 'object') {
                    createNodeLinks(link.targetNode);
                }
            } else {
                let propertyValueNode = graph.nodes[propertyValueIndex];
                let link = graph.createLink(node, propertyValueNode, key);
                graph.addLink(link);
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
        /*
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
            aGraph.merge(aGraph.rootNode, bGraph.rootNode, bGraph);
            assert(aGraph.nodes.length === 2); // a & true
            assert(aGraph.nodes[0].value === a);
            assert(aGraph.nodes[1].value === true);
            assert(aGraph.links.length === 2); // foo & bar
            assert(aGraph.links[0].id === 'foo');
            assert(aGraph.links[1].id === 'bar');
        });
        */

        /*
        this.add('merge nested', function() {
            let a = {
                user: {
                    name: 'dam'
                }
            };
            let b = {
                user: {
                    name: 'seb'
                }
            };
            let aGraph = Graph.from(a);
            let bGraph = Graph.from(b);
            aGraph.merge(aGraph.rootNode, bGraph.rootNode, bGraph);

            assert(aGraph.nodes.length === 3);
            assert(aGraph.nodes[0].value === a);
            assert(aGraph.nodes[1].value === b.user);
            assert(aGraph.nodes[2].value === b.user.name);
        });
        */

        /* this.add('from with with left links', function() {
            let a = {
                name: 'dam'
            };
            let b = {
            };
            b.owner = b;
            let aGraph = Graph.from(a);
            let bGraph = Graph.from(b);
            aGraph.merge(aGraph.rootNode, bGraph.rootNode, bGraph);

            console.log(aGraph.nodes);
            assert(aGraph.nodes.length === 2);
            assert(aGraph.nodes[0].value === a);
            assert(aGraph.nodes[1].value === a.name);
        }); */

        this.add('nested cycle', function() {
            let a = {};
            let b = {
                user: {

                }
            };
            b.user.origin = b;
            let aGraph = Graph.from(a);
            let bGraph = Graph.from(b);
            aGraph.merge(aGraph.rootNode, bGraph.rootNode, bGraph);

            assert(aGraph.nodes.length === 2);
            assert(aGraph.nodes[0].value === a);
            assert(aGraph.nodes[1].value === b.user);
            assert(aGraph.links.length === 2);
            assert(aGraph.links[0].id === 'user');
            assert(aGraph.links[1].id === 'origin');
        });

        // this.add('complex merge', function() {
        //     let a = {
        //         foo: {
        //             name: 'dam',
        //             age: 10
        //         }
        //     };
        //     let b = {
        //         bar: a.foo,
        //         goo: 'g',
        //         foo: {
        //             name: {

        //             },
        //             gender: {

        //             }
        //         }
        //     };
        //     b.foo.name.origin = b;
        //     b.foo.gender.test = b;
        //     let aGraph = Graph.from(a);
        //     let bGraph = Graph.from(b);
        //     aGraph.merge(aGraph.rootNode, bGraph.rootNode, bGraph);

        //     // assert(aGraph.nodes.length === );

        //     console.log(aGraph.nodes);
        // });

        /*
        this.add('merge with primitive conflict', function() {
            let a = {
                foo: true
            };
            let b = {
                foo: false
            };
            let aGraph = Graph.from(a);
            let bGraph = Graph.from(b);
            aGraph.merge(bGraph);
            assert(aGraph.nodes.length === 2);
            assert(aGraph.nodes[1].value === false);
            assert(aGraph.links.length === 1);
            assert(aGraph.links[0].id === 'foo');
            assert(aGraph.links[0].sourceNode.value === a);
            assert(aGraph.links[0].targetNode.value === false);
        });

        this.add('merge with object conflict', function() {
            let a = {
                user: {
                    name: 'dam'
                }
            };
            let b = {
                user: {
                    name: 'seb',
                    age: 10
                }
            };
            let aGraph = Graph.from(a);
            let bGraph = Graph.from(b);
            aGraph.merge(bGraph);
            console.log(aGraph);
        });
        */
    }
};
