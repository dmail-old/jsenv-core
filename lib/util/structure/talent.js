/* eslint-disable no-use-before-define */

/*

http://peterseliger.blogspot.fr/2014/04/the-many-talents-of-javascript.html#the-many-talents-of-javascript

keywords :
Trait, Talent, Composable, Component, Mixin, Unit, Behaviour, Subject, Target
Reuse, Evolve, Combine, Composition
Skill, Competence, Education, Formation, Ability, Capacity, Experience, Teach, Learn, Train
Talent management, Needs, Task, Goal
Evaluation, Performance, Potential

A set of skill makes you competent to do something
In other words a competence is a combination of skills and use skills
Competence include abilities, behaviour and knowledge of how to use a skill to achieve the goal

*/

import util from './util.js';

const Skill = util.extend({
    properties: {},
    name: '',
    installOnSubject: true,
    constructor() {
        util.define.apply(this, arguments);

        this.properties = Object.keys(this.properties).map(function(name) {
            return Property.create(name, Object.getOwnPropertyDescriptor(this.properties, name));
        }, this);

        if (this.installOnSubject) {
            const name = this.name;
            if (name) {
                const selfProperty = Property.create(this.name);
                selfProperty.conflictStrategy = 'throw';
                this.selfProperty = selfProperty;
            }
        }
    },

    add(subject) {
        const talent = Talent.create(this, subject);
        talent.add();
        return talent;
    }
});

function composeFunction(fn, composedFn, when) {
    if (when === 'before') {
        return function() {
            let args = arguments;
            fn.apply(this, args);
            return composedFn.apply(this, args);
        };
    }
    if (when === 'after') {
        return function() {
            let args = arguments;
            composedFn.apply(this, args);
            return fn.apply(this, args);
        };
    }
    if (when === 'around') {
        return function() {
            return fn.call(this, composedFn, fn, arguments, this);
        };
    }
}

const Property = util.extend({
    conflictStrategy: 'override',

    constructor(name, attributes) {
        this.name = name;
        this.attributes = attributes;
    },

    define(attributes) {
        const property = this.createConstructor(this.name, attributes);
        return property;
    },

    delete() {
        const property = this.createConstructor(this.name);
        return property;
    },

    assign(target) {
        const name = this.name;
        const attributes = this.attributes;

        if (target.hasOwnProperty(name)) {
            // for now I got 6 primary strategy : before, after, around, alias, override, skip
            // alias : put the method on a supposed non used property
            // override : execute me
            // skip : ignore this property
            // before : execute before the current
            // after : execute after the current
            // around : execute passing current as first arg, arguments as second and target as third to decide when to call it

            const conflictStrategy = this.conflictStrategy;
            if (conflictStrategy === 'throw') {
                throw new Error('subject already has a property named ' + name);
            } else if (conflictStrategy === 'skip') {
                // noop
            } else if (conflictStrategy === 'override') {
                this.set(target, name, attributes);
            } else if (conflictStrategy === 'alias') {
                this.set(target, 'an alias', attributes);
            } else {
                let targetValue = target[name];
                let skillValue = attributes ? attributes.value : undefined;

                if (typeof targetValue === 'function' && typeof skillValue === 'function') {
                    if (conflictStrategy === 'before') {
                        this.set(target, name, Object.assign(attributes, {
                            value: composeFunction(skillValue, targetValue, 'before')
                        }));
                    } else if (conflictStrategy === 'after') {
                        this.set(target, name, Object.assign(attributes, {
                            value: composeFunction(skillValue, targetValue, 'after')
                        }));
                    } else if (conflictStrategy === 'around') {
                        this.set(target, name, Object.assign(attributes, {
                            value: composeFunction(skillValue, targetValue, 'around')
                        }));
                    }
                }
            }
        } else {
            this.set(target, name, attributes);
        }
    },

    set: function(target, name, attributes) {
        if (attributes) {
            Object.defineProperty(target, name, attributes);
        } else {
            delete target[name];
        }
    }
});

const Talent = util.extend({
    constructor(skill, subject) {
        this.skill = skill;
        this.subject = subject;
        this.assignments = [];
    },

    add() {
        const skill = this.skill;

        skill.properties.forEach(function(property) {
            const assignment = Assignment.create(
                this.subject,
                property
            );
            assignment.perform();
            this.assignments.push(assignment);
        }, this);

        if (skill.installOnSubject) {
            // it may conflict with other properties, in such case we would throw
            const skillAssignment = Assignment.create(this.subject, skill.selfProperty.define({value: this}));
            skillAssignment.perform();
            this.assignments.push(skillAssignment);
        }
    },

    remove() {
        this.assignments.forEach(function(assignment) {
            assignment.cancel();
        });
    }
});

const Assignment = util.extend({
    constructor(target, property, nosave) {
        this.assigned = false;
        this.target = target;
        this.property = property;
        if (!nosave) {
            this.save();
        }
    },

    save() {
        let previous;
        const name = this.name;
        const target = this.target;

        if (target.hasOwnProperty(name)) {
            previous = Assignment.create(
                target,
                this.property.define(Object.getOwnPropertyDescriptor(target, name)),
                true
            );
        } else {
            previous = Assignment.create(target, this.property.delete(), true);
        }

        this.previous = previous;
    },

    perform() {
        if (this.assigned) {
            throw new Error('already assigned');
        }
        this.assigned = true;
        this.property.assign(this.target);
    },

    cancel() {
        if (this.assigned === false) {
            throw new Error('cancel() must be called when assigned');
        }
        this.previous.perform();
        this.assigned = false;
    }
});

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('Pure talent', function() {
            const boundaryEnumerationSkill = Skill.create({
                properties: {
                    first() {
                        return this[0];
                    },

                    last() {
                        return this[this.length - 1];
                    }
                }
            });
            const list = ['a', 'b'];
            const listBoundaryTalent = boundaryEnumerationSkill.add(list);
            const arrayBoundaryTalent = boundaryEnumerationSkill.add(Array.prototype);

            assert(list.first === Array.prototype.first); // they share the same method
            assert(list.first() === 'a'); // method returns the expected value
            assert(list.last() === 'b');

            arrayBoundaryTalent.remove();
            assert(Array.prototype.hasOwnProperty('first') === false); // removing the competence restore old properties
            listBoundaryTalent.remove();
            assert(list.hasOwnProperty('last') === false);
        });

        this.add('conflict resolution : after, before', function() {
            const floatSkill = Skill.create({
                properties: {
                    move() {
                        this.floating = true;
                    }
                }
            });
            floatSkill.properties[0].conflictStrategy = 'after';
            const rideSkill = Skill.create({
                properties: {
                    move() {
                        this.riding = true;
                    }
                }
            });
            rideSkill.properties[0].conflictStrategy = 'before';
            const target = {};
            floatSkill.add(target);
            rideSkill.add(target);

            target.move();
            // even if floatSkill is added before rideSKill, move() rides before float
            assert(Object.keys(target).join(), 'move,riding,floating');
        });

        this.add('promoted talent', function() {
            const randomItemSkill = (function() {
                var parseFloat = global.parseFloat;
                var mathFloor = global.Math.floor;

                return Skill.create({
                    properties: {
                        item(index) {
                            return this[mathFloor(parseFloat(index, 10))];
                        }
                    }
                });
            })();

            const allocateSkill = (function() {
                var arrayFrom = Array.from;

                // faudrais pouvoir combiner deux skill, c'est ptet là qu'interviendrais compétence
                // qui mettrais en commun deux skill
                // cométence serais super simple et se contenterais de combiner deux skill
                // par contre pour faire ça ça veut dire que c'est skill qui doit avoir la logique d'implémentation
                // et non pas talent, comme ça talent on lui passerais competence au lieu de skill et il se démerde
                // une manière simple de faire pourrais être genre que le skill ait une proprté d'initialization
                // qui appliquerais le skill

                // les propriétés de firstSkill se mette sur subject mais comme on peut le voir
                // il nous manque un pointeur vers list, qui est une private property de subject
                // mais subject nous la file pour qu'on puisse l'étendre, c'est ça un promoted talent
                // en plus d'être la combinaison de deux skills on doit aussi avoir un pointeur vers liste
                // sans le mettre dans les propriétés de subject

                var firstSkill = Skill.create({
                    properties: {
                        toArray() {
                            return arrayFrom(list);
                        },
                        valueOf() {
                            return this.toArray();
                        },
                        toString() {
                            return String(list);
                        },
                        size() {
                            return list.length;
                        }
                    }
                });

                return firstSkill.concat(randomItemSkill);
            })();

            const Queue = util.extend({
                constructor() {
                    var list = [];

                    this.define({
                        enqueue(type) {
                            list.push(type);
                            return type;
                        },

                        dequeue() {
                            return list.shift();
                        }
                    });

                    allocateSkill.add(this, list);
                }
            });
            // as we can see the implementation of queue creates two function for every queue
            // it's the only way to keep list private but we also notice that
            // thanks to skill & talent properties which are not directly related to the implementation of queue
            // does not have to be recreated they are just assigned on the list object
            const q = Queue.create();

            q.enqueue("the");
            q.enqueue("quick");
            q.enqueue("brown");
            q.enqueue("fox");
            assert(q.size() === 4);
            assert(q.toArray().join() === 'the,quick,brown,fox');
            assert(q.item(1) === 'quick');

            q.dequeue();
            q.dequeue();
            assert(q.toArray().join() === 'brown,fox');
            assert(q.size() === 2);

            q.dequeue();
            q.dequeue();
            q.dequeue();
            assert(q.size() === 0);
        });
    }
};
