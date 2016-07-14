import proto from 'env/proto';

const NodePrototype = proto.extend('Node', {
    parentName: 'parent',
    childrenName: 'children'
});

var Generator = proto.extend('Generator', {
    nodePrototypes: {},

    constructor(nodePrototypes = {}) {
        this.nodePrototypes = nodePrototypes;
    },

    registerNode(nodeName, ...args) {
        var nodePrototype = NodePrototype.extend(nodeName, ...args);
        this.nodePrototypes[nodeName] = nodePrototype;
        return nodePrototype;
    },

    generate(node) {
        var nodeName = node.name;
        var nodePrototypes = this.nodePrototypes;

        if (nodeName in nodePrototypes) {
            var nodePrototype = nodePrototypes[nodeName];
            var nodeObject = nodePrototype.create();

            nodeObject.name = nodeName;
            nodeObject.value = node.value;

            nodeObject[nodeObject.childrenName] = node.children.map(function(nodeChild) {
                let nodeChildObject = this.generate(nodeChild);

                nodeChildObject[nodeChildObject.parentName] = nodeObject;
                // console.log(
                // 'set', nodeObject.name, 'as parent of', nodeChildObject.name, 'on property',
                // nodeChildObject.parentName);

                return nodeChildObject;
            }, this);

            return nodeObject;
        }
        throw new Error('unexpected node ' + nodeName);
    }
});

export default Generator;
