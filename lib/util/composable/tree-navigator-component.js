import util from './util.js';

const TreeNavigator = util.extend();

// createAncestorIterable()
TreeNavigator.refine({
    createAncestorIterable() {
        let node = this;
        return createIterable(function() {
            let parentNode = node.up();
            node = parentNode;

            const result = {
                done: !parentNode,
                value: parentNode
            };

            return result;
        }, this);
    },

    up() {
        return null;
    }
});

// createDescendantIterable()
TreeNavigator.refine({
    createDescendantIterable() {
        let descendantNode;
        return createIterable(function() {
            if (descendantNode) {
                // console.log('getting next from', descendantNode);
                descendantNode = descendantNode.next();
            } else {
                descendantNode = this.first();
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
TreeNavigator.refine({
    createNextIterable() {
        let node = this;

        return createIterable(function() {
            let nextNode = node.next();
            node = nextNode;

            const result = {
                done: !node,
                value: node
            };

            return result;
        }, this);
    },

    next() {
        let nextNode;
        let depthlessNode = this.depthless();

        if (depthlessNode) {
            // console.log('got a depthless node');
            nextNode = depthlessNode;
        } else {
            // console.log('no depthless node, nextSibling ?');
            const nextSibling = this.nextSibling();
            if (nextSibling) {
                // console.log('got a nextSibling', nextSibling);
                nextNode = nextSibling;
            } else {
                // console.log('no nextSibling on', node);

                // search if a parent element got element after themselves
                let ancestorNode = this.up();
                let ancestorNodeNextSibling;

                while (ancestorNode) {
                    ancestorNodeNextSibling = ancestorNode.nextSibling();
                    if (ancestorNodeNextSibling) {
                        break;
                    } else {
                        ancestorNode = ancestorNode.up();
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
        const parentNode = this.up();
        // console.log('parent for', node, parentNode);

        if (parentNode) {
            nextSibling = parentNode.after(this);
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
        let reversedDescendantNode;

        return createIterable(function() {
            if (reversedDescendantNode) {
                reversedDescendantNode = reversedDescendantNode.previous();
            } else {
                reversedDescendantNode = this.last();
            }

            const result = {
                done: !reversedDescendantNode,
                value: reversedDescendantNode
            };

            return result;
        }, this);
    },

    last() {
        return null;
    }
});

// createPreviousIterable(), previous(), previousSibling(), deepest()
TreeNavigator.refine({
    createPreviousIterable() {
        let node = this;

        return createIterable(function() {
            let previousNode = node.previous();
            node = previousNode;

            const result = {
                done: !node,
                value: node
            };

            return result;
        }, this);
    },

    previous() {
        let previousNode;
        const previousSibling = this.previousSibling();

        if (previousSibling) {
            let previousSiblinDeepestNode = previousSibling.deepest();
            if (previousSiblinDeepestNode) {
                previousNode = previousSiblinDeepestNode;
            } else {
                previousNode = previousSibling;
            }
        } else {
            const parentNode = this.up();
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
        const parentNode = this.up();

        if (parentNode) {
            previousSibling = parentNode.before(this);
        } else {
            previousSibling = null;
        }
        return previousSibling;
    },

    deepest() {
        let lastNode = this.last();
        let deepestNode;

        if (lastNode) {
            deepestNode = lastNode;

            while (true) { // eslint-disable-line
                let deepestLastNode = deepestNode.last();
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

const defaultNavigationMethods = {
    up() {
        let parent;

        if ('parent' in this) {
            parent = this.parent;
        } else {
            parent = null;
        }

        return parent;
    },

    first() {
        let first;
        const children = this.children;

        if (children) {
            first = children.length === 0 ? null : children[0];
        } else {
            first = null;
        }

        return first;
    },

    last() {
        let last;
        const children = this.children;

        if (children && children.length) {
            last = children[children.length - 1];
        } else {
            last = null;
        }

        return last;
    },

    after(supposedNodeChild) {
        let nextSibling;
        const children = this.children;

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

    before(supposedNodeChild) {
        let previousSibling;
        const children = this.children;

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
TreeNavigator.refine(defaultNavigationMethods);

export default TreeNavigator;
