/* eslint-disable no-use-before-define, new-cap */

import Immutable from 'immutable';

// const Element = Immutable.Map();
// const Properties = Immutable.Map();
const ObjectProperty = Immutable.Map();
// const ObjectProperties = Immutable.Map();
const ObjectElement = Immutable.Map();

// seems like immutable.js does not allow to create a copy of a current immutable
// because all the concept is to get the exact same object when the immutable is the same
// while what I want is a fresh object even if it's the same

const objectProperty = ObjectProperty.merge({name: 'foo', value: true});
console.log(objectProperty);

let objectProperties = Immutable.Map();
objectProperties = objectProperties.set('foo', objectProperty);
console.log(objectProperties);

const objectElement = ObjectElement.set('properties', objectProperties);
console.log(objectElement);

const sealedObjectProperties = objectProperties.map(function(property) {
    return property.set('sealed', true);
});
console.log(sealedObjectProperties);
