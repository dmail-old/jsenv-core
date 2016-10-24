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
                children: [
                    {name: 'a'},
                    {name: 'b'}
                ]
            };

            /*
            plus quelque chose comme

            TreeNavigatorComponent.compile(function() {
                return {
                    parent() {
                        return this.parent; // when you need navigator you can do this.navigator
                    }
                }
            });

            we would have composite, composition, component and a component
            may have "shared" or "delegated" or I don't know hwo to name list of properties & methods
            which belong to the composite but are stored on the component to avoid most name conflict
            */

            const Navigator = TreeNavigator.compile(function() {
                return {
                    parent(node) {
                        const parent = 'parent' in node ? node.parent : null;
                        // here this !== node.navigator because node.navigator is a proxy
                        // to the real navigator

                        return parent;
                    },

                    first(node) {
                        let first;
                        const children = node.children;

                        if (children) {
                            first = children.length === 0 ? null : children[0];
                        } else {
                            first = null;
                        }

                        return first;
                    },

                    last(node) {
                        let last;
                        const children = node.children;

                        if (children && children.length) {
                            last = children[children.length - 1];
                        } else {
                            last = null;
                        }

                        return last;
                    },

                    after(node, supposedNodeChild) {
                        let nextSibling;
                        const children = node.children;

                        // console.log('calling after', arguments);

                        if (children) {
                            const index = children.indexOf(supposedNodeChild);

                            if (index === -1) {
                                // console.log('index is -1', supposedNodeChild);
                                nextSibling = null; // maybe we should throw
                            } else if (index === children.length - 1) {
                                nextSibling = null;
                            } else {
                                nextSibling = children[index + 1];
                            }
                        } else {
                            nextSibling = null;
                        }

                        return nextSibling;
                    },

                    before(node, childNode) {
                        let previousSibling;
                        const children = node.children;

                        if (children) {
                            const index = children.indexOf(childNode);

                            if (index === 0) {
                                previousSibling = null;
                            } else {
                                previousSibling = children[index - 1];
                            }
                        } else {
                            previousSibling = null;
                        }

                        return previousSibling;
                    }
                };
            });
            const navigator = Navigator.install(treeStructure);
            treeStructure.children[0].parent = treeStructure;

            // assert(treeStructure.navigator !== navigator);
            assert(navigator.parent() === null);
            assert(navigator.first() === treeStructure.children[0]);
            assert(navigator.last() === treeStructure.children[1]);
            assert(navigator.next() === treeStructure.children[0]);
            console.log(Array.from(navigator.createDescendantIterable()));
            // we cannot get next node because the child node does not inform of its parent
            // so descendantIterable is stopped to the first node it encounters

            // assert.deepEqual(Array.from(navigator.createDescendantIterable()), treeStructure.children);
            // c'est tout, comme les children n'ont pas de navigator je ne peux pas les trouver
        });
    }
};

/*
peut-on simplifier ce truc en disant qu'en gros lorsqu'on définie une méthode sur TreeNavigator

Navigator methods are wrapped so that when called if their first argument have a navigator property
then it's the method of the first argument which is used (see delegate below)
*/
const TreeNavigator = util.extend({
    compile(methods) {
        const Navigator = this.extend();
        Navigator.methods = Object.assign({}, this.methods); // Object.create(this.methods);
        // could use the commented Object.create() but have to update Object.keys in constructor
        // but I'm not sure I want to keep both objects linked by prototype
        Navigator.method(methods());

        return Navigator;
    },
    methods: {},

    method(methods) {
        Object.keys(methods).forEach(function(name) {
            this.methods[name] = methods[name];
            this[name] = function(...args) {
                return this.delegate(name, ...args);
            };
        }, this);
    },

    delegate(name, node, ...args) {
        let methods;
        let bind;
        const navigator = node.navigator;

        // now node.navigator is a proxy so when it exists we call method on him, no need to know its methods object
        // nope don't call on him because he would curry the first argument
        if (navigator) {
            bind = Object.getPrototypeOf(navigator);
            methods = bind.methods;
        } else if (this.propagable) {
            // console.log('does not have own navigator but propagable', name);
            bind = this;
            methods = this.methods;
        } else {
            // console.log(node, 'does not have navigator', name);
            bind = TreeNavigator;
            methods = TreeNavigator.methods;
        }

        if ((name in methods) === false) {
            throw new Error('no method named ' + name);
        }

        return methods[name].call(bind, node, ...args);
    },
    propagable: true,

    constructor(node) {
        const navigator = this;
        const exposedNavigator = Object.create(this);

        // exposedNavigator.methods = this.methods; // inherit methods so that we can call them later
        // we could do that earlier ? yeah we could if we do exposedNavigator.node = node;
        // and exposedNavigator.navigator = this;
        // and attach the method on it method could access node & navigator without having to be recreated
        // for each call to constructor()
        // for now they access it thanks to scope and i'll keep it like that for now cause
        // the only reason to change is perf
        Object.keys(this.methods).forEach(function(name) {
            const method = this.methods[name];
            exposedNavigator[name] = function(...args) {
                return method.call(navigator, node, ...args);
            };
        }, this);

        // this.node = node;
        Object.defineProperty(node, 'navigator', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: exposedNavigator
        });
        return exposedNavigator;
    },

    install(node) {
        const navigator = this.create(node);
        return navigator;
    }
});

// createAncestorIterable()
TreeNavigator.method({
    createAncestorIterable(node) {
        return createIterable(function() {
            let parentNode = this.parent(node);
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
TreeNavigator.method({
    createDescendantIterable(node) {
        let descendantNode;
        return createIterable(function() {
            if (descendantNode) {
                // console.log('getting next from', descendantNode);
                descendantNode = this.next(descendantNode);
            } else {
                descendantNode = this.first(node);
            }

            const result = {
                done: !descendantNode,
                value: descendantNode
            };

            return result;
        }, this);
    },

    first() {
        return null;
    }
});

// createNextIterable(), next(), depthless(), nextSibling()
TreeNavigator.method({
    createNextIterable(node) {
        let nextNode;

        return createIterable(function() {
            if (nextNode) {
                nextNode = this.next(nextNode);
            } else {
                nextNode = this.next(node);
            }

            const result = {
                done: !nextNode,
                value: nextNode
            };

            return result;
        }, this);
    },

    next(node) {
        let nextNode;
        let depthlessNode = this.depthless(node);

        if (depthlessNode) {
            // console.log('got a depthless node');
            nextNode = depthlessNode;
        } else {
            // console.log('no depthless node, nextSibling ?');
            const nextSibling = this.nextSibling(node);
            if (nextSibling) {
                // console.log('got a nextSibling', nextSibling);
                nextNode = nextSibling;
            } else {
                // console.log('no nextSibling on', node);

                // search if a parent element got element after themselves
                let ancestorNode = this.parent(node);
                let ancestorNodeNextSibling;

                while (ancestorNode) {
                    ancestorNodeNextSibling = this.nextSibling(ancestorNode);
                    if (ancestorNodeNextSibling) {
                        break;
                    } else {
                        ancestorNode = this.parent(ancestorNode);
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

    depthless(node) {
        return this.first(node);
    },

    nextSibling(node) {
        let nextSibling;
        const parentNode = this.parent(node);
        // console.log('parent for', node, parentNode);

        if (parentNode) {
            nextSibling = this.after(parentNode, node);
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
TreeNavigator.method({
    createReversedDescendantIterable(node) {
        let reversedDescendantNode;

        return createIterable(function() {
            if (reversedDescendantNode) {
                reversedDescendantNode = this.previous(reversedDescendantNode);
            } else {
                reversedDescendantNode = this.last(node);
            }

            const result = {
                done: !node,
                value: node
            };

            return result;
        }, this);
    },

    last() {
        return null;
    }
});

// createPreviousIterable(), previous(), previousSibling(), deepest()
TreeNavigator.method({
    createPreviousIterable(node) {
        let previousNode;

        return createIterable(function() {
            if (previousNode) {
                previousNode = this.previous(previousNode);
            } else {
                previousNode = this.previous(node);
            }

            const result = {
                done: !previousNode,
                value: previousNode
            };

            return result;
        }, this);
    },

    previous(node) {
        let previousNode;
        const previousSibling = this.previousSibling(node);

        if (previousSibling) {
            let previousSiblinDeepestNode = this.deepest(previousSibling);
            if (previousSiblinDeepestNode) {
                previousNode = previousSiblinDeepestNode;
            } else {
                previousNode = previousSibling;
            }
        } else {
            const parentNode = this.parent(node);
            if (parentNode) {
                previousNode = parentNode;
            } else {
                previousNode = null;
            }
        }

        return previousNode;
    },

    previousSibling(node) {
        let previousSibling;
        const parentNode = this.parent(node);

        if (parentNode) {
            previousSibling = this.before(parentNode, node);
        } else {
            previousSibling = null;
        }
        return previousSibling;
    },

    deepest(node) {
        let lastNode = this.last(node);
        let deepestNode;

        if (lastNode) {
            deepestNode = lastNode;

            while (true) { // eslint-disable-line
                let deepestLastNode = this.last(deepestNode);
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
    },

    before() {
        return null;
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
