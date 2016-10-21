/* eslint-disable no-use-before-define */

/*
enumerable, discoverable, iterable
navigator, walker, iterator, enumerator
*/

import util from './util.js';

/*
A nodenavigator allow to call node.first(), node.last(), node.prev(), node.next(), node.parent()
and node.createNextIterable(), node.createPrevIterable(), node.createAncestorIterable(), node.createDescendantIterable(), createReversedDescendantIterable()

but you must be able to specify some stuff such as that the node is a leaf (has no descendant)
*/

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('allow to specify how a tree structure can be discovered', function() {
            const treeStructure = {
                parent: null,
                children: [
                    {name: 'a'},
                    {name: 'b'}
                ]
            };

            const Navigator = TreeNavigator.extend({
                parent() {
                    return this.node.parent;
                },

                first() {
                    return this.node.children[0];
                },

                last() {
                    return this.node.children[this.node.children.length - 1];
                },

                after(childNode) {
                    let nextSibling;
                    const children = this.node.children;
                    const index = children.indexOf(childNode);
                    if (index === children.length - 1) {
                        nextSibling = null;
                    } else {
                        nextSibling = children[index + 1];
                    }
                    return nextSibling;
                },

                before(childNode) {
                    let previousSibling;
                    const children = this.node.children;
                    const index = children.indexOf(childNode);
                    if (index === 0) {
                        previousSibling = null;
                    } else {
                        previousSibling = children[index - 1];
                    }
                    return previousSibling;
                }
            });
            const navigator = Navigator.install(treeStructure);

            assert(treeStructure.navigator === navigator);
            assert(navigator.parent() === null);
            assert(navigator.first() === treeStructure.children[0]);
            assert(navigator.last() === treeStructure.children[1]);
            assert(navigator.next() === treeStructure.children[0]);
            // console.log(Array.from(navigator.createDescendantIterable()));
            // we cannot get next node because the child node does not inform of its parent
            // so descendantIterable is stopped to the first node it encounters

            // assert.deepEqual(Array.from(navigator.createDescendantIterable()), treeStructure.children);
            // c'est tout, comme les children n'ont pas de navigator je ne peux pas les trouver
        });
    }
};

const TreeNavigator = util.extend({
    constructor(node) {
        this.node = node;
        node.navigator = this;
    },

    install(node) {
        const navigator = this.create(node);
        return navigator;
    },

    proxy(node, method, ...args) {
        const navigator = node.navigator;
        if (navigator) {
            return navigator[method](...args);
        }
        const proto = TreeNavigator;
        return proto[method].apply(proto, args);
    }
});

// createAncestorIterable()
TreeNavigator.refine({
    createAncestorIterable() {
        let node = this.node;

        return createIterable(function() {
            let parentNode = this.proxy(node, 'parent');
            node = parentNode;

            const result = {
                done: !parentNode,
                value: parentNode
            };

            return result;
        }, this);
    },

    parent() {
        return null;
    }
});

// createDescendantIterable()
TreeNavigator.refine({
    createDescendantIterable() {
        let node;

        return createIterable(function() {
            if (node) {
                node = this.proxy(node, 'next');
            } else {
                node = this.first();
            }

            const result = {
                done: !node,
                value: node
            };

            return result;
        }, this);
    },

    first() {
        return null;
    }
});

// createNextIterable(), next(), depthless(), nextSibling()
TreeNavigator.refine({
    createNextIterable() {
        let node = this.node;

        return createIterable(function() {
            let nextNode = this.proxy(node, 'next');
            node = nextNode;

            const result = {
                done: !nextNode,
                value: nextNode
            };

            return result;
        }, this);
    },

    next() {
        let nextNode;
        let depthlessNode = this.depthless();
        if (depthlessNode) {
            nextNode = depthlessNode;
        } else {
            const nextSibling = this.nextSibling();
            if (nextSibling) {
                nextNode = nextSibling;
            } else {
                // search if a parent element got element after themselves
                let ancestorNode = this.parent();
                let ancestorNodeNextSibling;

                while (ancestorNode) {
                    ancestorNodeNextSibling = this.proxy(ancestorNode, 'nextSibling');
                    if (ancestorNodeNextSibling) {
                        break;
                    } else {
                        ancestorNode = this.proxy(ancestorNode, 'parent');
                    }
                }

                if (ancestorNodeNextSibling) {
                    nextNode = ancestorNodeNextSibling;
                } else {
                    nextNode = null;
                }
            }
        }

        return nextNode;
    },

    depthless() {
        return this.first();
    },

    nextSibling() {
        let nextSibling;
        const parentNode = this.parent();
        if (parentNode) {
            nextSibling = this.proxy(parentNode, 'after', this.node);
        } else {
            nextSibling = null;
        }
        return nextSibling;
    },

    after() {
        return null;
    }
});

// createReversedDescendantIterable()
TreeNavigator.refine({
    createReversedDescendantIterable() {
        let node;

        return createIterable(function() {
            if (node) {
                node = this.proxy(node, 'previous');
            } else {
                node = this.last();
            }

            const result = {
                done: !node,
                value: node
            };

            return result;
        });
    },

    last() {
        return null;
    }
});

// createPreviousIterable(), previous(), previousSibling(), deepest()
TreeNavigator.refine({
    createPreviousIterable() {
        let node = this.node;

        return createIterable(function() {
            let previousNode = this.proxy(node, 'previous');
            node = previousNode;

            const result = {
                done: !previousNode,
                value: previousNode
            };

            return result;
        }, this);
    },

    previous() {
        let previousNode;
        const previousSibling = this.previousSibling();

        if (previousSibling) {
            let previousSiblinDeepestNode = this.proxy(previousSibling, 'deepest');
            if (previousSiblinDeepestNode) {
                previousNode = previousSiblinDeepestNode;
            } else {
                previousNode = previousSibling;
            }
        } else {
            const parentNode = this.parent();
            if (parentNode) {
                previousNode = parentNode;
            } else {
                previousNode = null;
            }
        }

        return previousNode;
    },

    previousSibling() {
        let previousSibling;
        const parentNode = this.parent();
        if (parentNode) {
            previousSibling = this.proxy(parentNode, 'before', this.node);
        } else {
            previousSibling = null;
        }
        return previousSibling;
    },

    before() {
        return null;
    },

    deepest() {
        let lastNode = this.last();
        let deepestNode;

        if (lastNode) {
            deepestNode = lastNode;

            while (true) { // eslint-disable-line
                let deepestLastNode = this.proxy(deepestNode, 'last');
                if (deepestLastNode) {
                    deepestNode = deepestLastNode;
                } else {
                    break;
                }
            }
        } else {
            deepestNode = null;
        }

        return deepestNode;
    }
});

// final required methods for a fully naviguable tree : parent(), first(), after(node), last(), before(node)

function createIterable(nextMethod, bind) {
    return {
        [Symbol.iterator]: function() {
            return this;
        },
        next() {
            return nextMethod.call(bind);
        }
    };
}
