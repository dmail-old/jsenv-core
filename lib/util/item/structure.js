/*

var value = {
    foo: Date.now(),
    user: {
        name: 'dam'
    }
};
value.self = value;

var structure = {
    value: {
        tag: 'Object',
    },
    properties: [
        {
            name: 'foo',
            value: {
                tag: 'Date',
                constructorArguments: [1471938451955]
            }
        },
        {
            name: 'user',
            value: {
                tag: 'Object',
            },
            properties: [
                {
                    name: 'name',
                    value: 'dam'
                }
            ]
        }
        {
            name: 'self',
            value: // a pointer to structure
            // the problem here is that we won't be aware that node is a reference
            // it doesn't solve the issue, we could create a referenceNode or pointerNode for thoose special case
            // and when we meet one we know the node must not be iterated as it's a reference to something we have already seen
        }
    ]
};

would be serialized to, we need more than that to be able to recreate the structure

{
    values: [
        {tag: 'Object'},
        {tag: 'Date', constructorArguments: [1471938451955]},
        {tag: 'Object'},
        'dam'
        // here object properties are tag, constructorArguments, frozen, sealed, extensible
    ],
    properties: [
        {owner: 0, name: 'foo', value: 1},
        {owner: 0, name: 'user', value: 2},
        {owner: 2, name: 'name', value: 3},
        {owner: 0, name: 'self', value: 0}
        // here properties properties are owner, name, value, configurable, writable, enumerable, getter, setter
    ]
}
*/

import util from './util.js';

let Definition = util.createConstructor({
    value: undefined,
    tag: '',
    constructorArguments: [],
    frozen: false,
    sealed: false,
    extensible: true,
    properties: [],

    constructor() {

    },

    getPropertyNames() {
        return this.properties.map(function(property) {
            return property.name;
        });
    },

    getProperty(name) {
        return this.properties.find(function(property) {
            return property.name === name;
        });
    }
});

let Property = util.createConstructor({
    name: '',
    definition: null,
    writable: true,
    configurable: true,
    enumerable: true,
    getter: undefined,
    setter: undefined,

    constructor() {

    }
});

Definition.from = function(value) {
    let values = [];
    let definitions = [];

    function createValueProperties(value) {
        return Object.keys(value).map(function(key) {
            let propertyValue = value[key];
            let property = new Property();
            property.name = key;
            property.definition = createDefinition(propertyValue);
            return property;
        });
    }

    function createDefinition(value) {
        let index = values.indexOf(value);
        let definition;
        if (index === -1) {
            definition = new Definition();

            if (util.isPrimitive(value)) {
                definition.value = value;
            } else {
                let toStringResult = Object.prototype.toString.call(value);
                definition.tag = toStringResult.slice('[object '.length, -(']'.length));
                // etc, some value may define constructor arguments
                // frozen sealed etc to be done
            }

            values.push(value);
            definitions.push(definition);
            if (typeof value === 'object') {
                definition.properties = createValueProperties(value);
            }
        } else {
            let seenDefinition = definitions[index];
            definition = new Definition();
            definition.reference = seenDefinition;
        }

        return definition;
    }

    return createDefinition(value);
};

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('core', function() {
            let value = {
                date: new Date(),
                user: {

                },
                bar: true
            };
            value.user.self = value;
            let definition = Definition.from(value);

            assert(definition.tag === 'Object');
            assert(definition.getPropertyNames().join() === 'date,user,bar');
            assert(definition.getProperty('date').definition.tag === 'Date');
            assert(definition.getProperty('user').definition.tag === 'Object');
            assert(definition.getProperty('bar').definition.value === true);
            assert(definition.getProperty('user').definition.getProperty('self').definition.reference === definition);

            // let graph = Graph.from(value);
            // let valueNode = graph.getOrCreateNode(value);

            // assert(valueNode.value === value);
            // let trueNode = graph.getOrCreateNode(true);
            // let barLink = graph.getLink(valueNode, 'bar');
            // assert(barLink.id === 'bar');
            // assert(barLink.sourceNode === valueNode);
            // assert(barLink.targetNode === trueNode);
            // let userLink = graph.getLink(valueNode, 'user');
            // assert(userLink.id === 'user');
            // assert(userLink.sourceNode === valueNode);
            // let userNode = userLink.targetNode;
            // let userManLink = graph.getLink(userNode, 'man'); // man link is at index 1 because at index 0 there is the link with valueNode
            // assert(userManLink.id === 'man');

            // assert(graph.createDepthFirstIterable(valueNode)[2].value === 'man'); // 0 is value, 1 is value.user, 2 is value.user.gender
            // console.log(graph.createDepthFirstIterable(valueNode));
            // assert(graph.createBreadthFirstIterable(valueNode)[2].value === true); // 0 is value, 1 is value.user, 2 is value.bar

            // let userGraph = graph.slice(userNode);
            // assert(userGraph.nodes.includes(valueNode) === false);
            // assert(userGraph.links.includes(userLink) === false);
            // assert(userGraph.links.includes(userManLink) === true);
        });
    }
};
