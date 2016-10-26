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
// you can install the unit on an existing object instead of creating an object
Unit.install(pojoOrUnit, object)

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

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        const spy = null;
        const compose = null;

        this.add('core', function() {
            const unit = compose(
                {
                    init: spy(function() {
                        // we can totally add more properties here
                        this.merge({
                            method() {

                            }
                        });
                    }),
                    constructor: spy(),
                    foo() {}
                },
                {
                    init: spy(),
                    bar() {}
                }
            );

            const firstUnit = unit.composition[0];
            const secondUnit = unit.composition[1];
            const firstUnitCall = firstUnit.get('init').lastCall;
            const secondUnitCall = secondUnit.get('init').lastCall;
            const compileTarget = {};
            const compiledUnit = unit.compile(compileTarget); // we must know the compile target

            assert(firstUnitCall.called);
            assert(firstUnitCall.this === firstUnit);
            assert(secondUnitCall.called);
            assert(secondUnitCall.this === secondUnit);
            // ensure compiledUnit has a method property that must be installed as well
            assert(compiledUnit.has('method'));

            // install target & compile target may be !=
            const installTarget = {};
            compiledUnit.install(installTarget);

            // ensure the properties on installTarget are present
            assert(installTarget.foo === firstUnit.get('foo'));
            assert(installTarget.bar === secondUnit.get('bar'));

            /*
            // should we call constructor once we know the object being created and the properties belonging to him
            // I also need something to be able to clone an object with the current state of it
            // It gives me the feeling even instance should be stamp
            // in other words we wouldn't use raw object anymore, even instance would use the implement keyword to add more property
            // we would have conflict and remember that stamp are immutable so every time an object would be mutated
            // all the structure must be updated as well to use the new immutable value

            et en utilisanet immutable.js ?
            finalement c'est "exactement" ce que fais immutable.js
            stampit() -> Map()
            compose() -> map.merge(), voir map.mergeWith() si on souhaite gérer le conflit autrement qu'en écrasant
            method() -> map.set()

            du coup on instancie pas un immutable, on continue de le modifier, à "aucun" moment on ne passe par un objet classique
            par contre toutes les méthodes dans immutable ne doivent pas être overrides mais on veut pouvoir en ajouter de nouvelles
            faut essayer de faire lab-immutable.js pour voir ce que ça donnerait
            */
        });
    }
};
