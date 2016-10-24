/* eslint-disable no-use-before-define */

/*
enumerable, discoverable, iterable
navigator, walker, iterator, enumerator
*/

import util from './util.js';

/*
A nodenavigator allow to call node.first(), node.last(), node.prev(), node.next(), node.parent()
and node.createNextIterable(), node.createPrevIterable(), node.createAncestorIterable(), node.createDescendantIterable(), createReversedDescendantIterable()
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

            // final required methods for a fully naviguable tree : parent(), first(), after(node), last(), before(node)
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

                        if (children) {
                            const index = children.indexOf(supposedNodeChild);

                            if (index === -1) {
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

                    before(node, supposedNodeChild) {
                        let previousSibling;
                        const children = node.children;

                        if (children) {
                            const index = children.indexOf(supposedNodeChild);

                            if (index === -1) {
                                previousSibling = null;
                            } else if (index === 0) {
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

            assert(navigator.parent() === null);
            // assert(navigator.first() === treeStructure.children[0]);
            // assert(navigator.last() === treeStructure.children[1]);
            // assert(navigator.next() === treeStructure.children[0]);
            // treeStructure.children[0].parent = treeStructure;
            // assert(Array.from(navigator.createDescendantIterable()).length === 2);
        });
    }
};

const ComponentMethod = util.extend({
    constructor(component, name, fn) {
        this.name = name;
        this.untouched = fn;
        this.component = component;

        // prepare a delegated version
        this.delegated = function(composite, ...args) {
            let owner;
            const exposedComponent = composite[component.name];
            let methods;

            if (exposedComponent) {
                // here owner is the composite exposedComponent
                // the delegation concept is in this if :
                // -> callings component's B method is delegated to component's A method
                let exposedComponentOrigin = Object.getPrototypeOf(exposedComponent);
                owner = exposedComponentOrigin;
                methods = owner.methods;
            } else if (component.inheritable) {
                // here owner is the installedComponent
                // (because delegated is set on component prototype so this is the installedComponent)
                // relying on this is a bit optimist
                // but for now it's the only way to access installedComponent
                owner = this;
                methods = this.methods;
            } else {
                // here owner is a component or a compiledComponent
                owner = component;
                methods = owner.methods;
            }

            const method = methods.get(name);
            if (!method) {
                throw new Error('no method named ' + name);
            }

            return method.untouched.call(owner, composite, ...args);
        };

        // prepare exposed version which always call the method on component's composite
        this.exposed = function(...args) {
            const exposedComponent = this;
            const installedComponent = Object.getPrototypeOf(exposedComponent);
            const method = installedComponent.methods.get(name);

            console.log('installed component', installedComponent.composite);

            return method.untouched.call(installedComponent, installedComponent.composite, ...args);
        };
    },

    delegate(component) {
        component[this.name] = this.delegated;
    },

    expose(component) {
        component[this.name] = this.exposed;
    }
});

const ComponentMethods = util.extend({
    constructor(component, map) {
        this.component = component;
        this.map = map;
    },

    set: function(name, fn) {
        const method = ComponentMethod.create(this.component, name, fn);

        return this.add(method);
    },

    add(method) {
        this.map[method.name] = method;
        // for convenience delegated method are installed on the navigator
        method.delegate(this.component);
    },

    get: function(name) {
        let method;

        if (name in this.map) {
            method = this.map[name];
        } else {
            method = null;
        }

        return method;
    },

    import(methods) {
        for (let method of methods) {
            const importedMethod = ComponentMethod.create(this.component, method.name, method.untouched);
            this.add(importedMethod);
        }
    },

    merge(methods) {
        Object.keys(methods).forEach(function(name) {
            this.set(name, methods[name]);
        }, this);

        return this;
    },

    [Symbol.iterator]() {
        var methods = [];
        for (let name in this.map) { // eslint-disable-line guard-for-in
            // (we use Object.create(null) for now so it's ok)
            const method = this.map[name];
            methods.push(method);
        }

        return methods[Symbol.iterator]();
    },

    expose(component) {
        for (let method of this) {
            method.expose(component);
        }
    }
});

const Component = util.extend({
    constructor(name) {
        this.name = name;
        this.methods = ComponentMethods.create(this, Object.create(null));
    },

    method(methods) {
        this.methods.merge(methods);
    },

    inheritable: false,

    compile(methods) {
        const compiledComponent = Object.create(this);
        const compiledMethods = ComponentMethods.create(compiledComponent, Object.create(null));
        compiledComponent.methods = compiledMethods;

        // we inherit this.methods
        compiledMethods.import(this.methods);
        // and overrides them if methods argument is passed
        if (methods) {
            compiledMethods.merge(methods());
        }

        return compiledComponent;
    },

    install(composite) {
        const component = this;
        const installedComponent = Object.create(component);
        // we should so something like installedComponent.init();
        const exposedComponent = Object.create(installedComponent);

        component.methods.expose(exposedComponent);
        Object.defineProperty(composite, component.name, {
            enumerable: false,
            configurable: false,
            writable: false,
            value: exposedComponent
        });

        return exposedComponent;
    }
});

const TreeNavigator = Component.create('navigator');

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

/*
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
*/

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
