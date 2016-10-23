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

                    after(node, childNode) {
                        let nextSibling;
                        const children = node.children;

                        if (children) {
                            const index = children.indexOf(childNode);

                            if (index === children.length - 1) {
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

            assert(treeStructure.navigator === navigator);
            // assert(navigator.parent() === null);
            // assert(navigator.first() === treeStructure.children[0]);
            // assert(navigator.last() === treeStructure.children[1]);
            // assert(navigator.next() === treeStructure.children[0]);
            console.log(Array.from(navigator.createDescendantIterable()));
            // we cannot get next node because the child node does not inform of its parent
            // so descendantIterable is stopped to the first node it encounters

            // assert.deepEqual(Array.from(navigator.createDescendantIterable()), treeStructure.children);
            // c'est tout, comme les children n'ont pas de navigator je ne peux pas les trouver
        });
    }
};

const TreeNavigator = util.extend({
    compile(methods) {
        const Navigator = this.extend();
        // we must ensure hidden methods are not overriden
        Object.assign(Navigator.methods, methods());
        return Navigator;
    },
    methods: {},

    method(methods) {
        Object.keys(methods).forEach(function(name) {
            this.methods[name] = methods[name];

            // oui c'est bien que this.parent soit bind sur this.node
            // par contre ici je fais genre this.node, ...args
            // mais si j'écris this.after(node, otherNode)
            // alors il faut check si node à un navigateur et lui déléguer l'appel à after
            // pour faire ça on pourrait regarder si method.length < au nombre requis et dans ce cas on met this.node
            // sinon on touche à rien et on proxy

            /*
            à réfléchir :

            - on voit bien que je me perds entre la nécéssité de pouvoir définir des méthodes à un objet
            sans que celle si soit set dans ces propriétés et le besoin de déléguate l'apelle
            à ces methods dans certains cas, ok on est presque bon

            le dernier truc un peu chiant c'est d'être obligé d'écrire node.navigator.parent(node)
            alors que navigator est "forcément" appliqué sur node
            on pourrait se dire ok il manque l'argument node donc par défaut c'est this.node
            mais j'ai peut que par la suite on ait du mal à savoir quand et comment this.node
            est mis lorsqu'on apelle .parent
            surtout lorsqu'on considère que la méthode qu'on éxécute dépend de node
            donc on ne peut pas savoir d'avance la function qui sera appelé et regardé son nb d'argument
            pour le moment on va utiliser la notation où on répète node
            */

            this[name] = function(...args) {
                if (args.length === 0) {
                    return this.proxy(name, this.node);
                }
                return this.proxy(name, ...args);
            };
        }, this);
    },

    proxy(name, node, ...args) {
        let methods;
        let bind;
        const navigator = node.navigator;

        if (navigator) {
            bind = navigator;
            methods = navigator.methods;
        } else if (this.propagable) {
            console.log('does not have own navigator but propagable', name);
            bind = this;
            methods = this.methods;
        } else {
            console.log(node, 'does not have navigator', name);
            bind = TreeNavigator;
            methods = TreeNavigator.methods;
        }

        if ((name in methods) === false) {
            throw new Error('no method proxy named ' + name);
        }

        return methods[name].call(bind, node, ...args);
    },
    propagable: true,

    constructor(node) {
        this.node = node;
        node.navigator = this;
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
                console.log('getting next from', descendantNode);
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
            nextNode = depthlessNode;
        } else {
            console.log('no depthless node, nextSibling ?');
            const nextSibling = this.nextSibling(node);
            if (nextSibling) {
                console.log('got a nextSibling');
                nextNode = nextSibling;
            } else {
                console.log('no nextSibling on', node);

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
        // console.log('parent for', node, parentNode, this.methods);

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
