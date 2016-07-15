import proto from 'env/proto';

const NodePrototype = proto.extend('Node', {
    parentName: 'parent',
    childrenName: 'children',

    constructor() {

    },

    transformName(name) {
        return name;
    },

    transformValue(value) {
        return value;
    },

    // setAttribute() // to be able to give some attribute to the node (will be used by reference)

    populate(node, parentNode, nodeObject) {
        this.name = this.transformName(node.name);
        this.value = this.transformValue(node.value);
        if (parentNode) {
            this[this.parentName] = parentNode;
        }

        this[this.childrenName] = node.children.map(function(nodeChild) {
            return nodeObject.generate(nodeChild, this);
        }, this);
    }
});

const Generator = proto.extend('Generator', {

});

var Generator = proto.extend('Generator', {
    constructor() {

    },

    createGenerator(...args) {
        var generator = Generator.extend(...args);
        return generator;
    },

    generate(node, parentNode) {
        var nodeName = node.name;
        var nodePrototypes = this.nodePrototypes;

        if (nodeName in nodePrototypes) {
            var nodePrototype = nodePrototypes[nodeName];
            var nodeObject = nodePrototype.create();

            nodeObject.populate(node, parentNode);

            return nodeObject;
        }
        throw new Error('unexpected node ' + nodeName);
    }
});

export default Generator;
