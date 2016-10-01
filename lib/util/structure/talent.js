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

const Skill = util.extend({
    properties: {},
    constructor() {
        util.define.apply(this, arguments);

        this.properties = Object.keys(this.properties).map(function(name) {
            return Property.create(name, Object.getOwnPropertyDescriptor(this.properties, name));
        }, this);
    },

    add(subject) {
        const competence = Competence.create(this, subject);
        competence.add();
        return competence;
    }
});

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
            if (conflictStrategy === 'skip') {
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

const Competence = util.extend({
    constructor(skill, subject) {
        this.skill = skill;
        this.subject = subject;
        this.assignments = [];
    },

    add() {
        this.skill.properties.forEach(function(property) {
            const assignment = Assignment.create(
                this.subject,
                property
            );
            assignment.perform();
            this.assignments.push(assignment);
        }, this);
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
            const listBoundaryCompetence = boundaryEnumerationSkill.add(list);
            const arrayBoundaryCompetence = boundaryEnumerationSkill.add(Array.prototype);

            assert(list.first === Array.prototype.first); // they share the same method
            assert(list.first() === 'a'); // method returns the expected value
            assert(list.last() === 'b');

            arrayBoundaryCompetence.remove();
            assert(Array.prototype.hasOwnProperty('first') === false); // removing the competence restore old properties
            listBoundaryCompetence.remove();
            assert(list.hasOwnProperty('last') === false);
        });

        this.add('Resolvable talent', function() {
            // here the skill may define a way to resolve conflict on properties
            // to do this skill must say how the properties is handling the conflict

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
    }
};
