/*

stampit API : https://github.com/stampit-org/stampit/blob/master/docs/API.md
stampit spec : https://github.com/stampit-org/stamp-specification
stampit compose.js : https://github.com/stampit-org/stampit/blob/master/src/compose.js

For now Im gonna use stampit but I prepare this because

- stampit is missing a true conflict detection/resolution mecanism (It claims to do it using infected compose)
- stampit auto merge deepProperties together on [compose](https://github.com/stampit-org/stampit/blob/eb9658189ca175f0dc1ac9463909fe291280af1c/src/compose.js#L72)
& merge them too on [creation](https://github.com/stampit-org/stampit/blob/eb9658189ca175f0dc1ac9463909fe291280af1c/src/compose.js#L17)
this is exactly because stampit is missing conflict resolution, a conflict resolution may be to merge
- stampit has methods() & props() whild I could just use one of them and internally create the two groups : function & properties
- for now I don't need static, conf, propertyDescriptors

Keep in mind I cannot just create a composedFunction when composing unit init() method
and ideally the same applies for any other method. I "must" keep both methods under a composedFunction object to be able to call them as I want
and get their result
(that's mainly because the return value of init() is important and may impact how next init() are being called)

suggested API here:

import Unit from 'jenv/unit';

// you can compose unit/pojo together (returns a composedUnit which has internal mecanism to ensure composition)
Unit.compose(pojo, unit);
// you can resolve the unit/pojo conflict (returns a resolvedUnit which has internal mecanism to ensure conflict resolution)
Unit.resolve(pojoOrUnit, {propertyName: resolverConfig});
// you can create an "instance" or this unit (returns a classic JavaScript object with all expected properties initalizer being called ...)
Unit.create(pojoOrUnit, ...args);

// unit instance got method as well (compose/resolve return a new unit object)
unit.compose(pojoOrUnit);
unit.resolve(resolverMap);
unit.create(...args);

// that's not planned but that would be great if conceptually we could do
Object.prototype.compose = Unit.compose;
Object.prototype.resolve = Unit.resolve;
// Object.prototype.create = Unit.create; -> not mandatory I suppose
// in order to use pojo as composable unit
*/
