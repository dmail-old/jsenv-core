var uneval = require('../uneval.js');

var Instruction = (function() {
    function preventMembersConflict(id) {
        this.members.forEach(function(member) {
            member.as = member.name + '$' + id;
        });
    }
    function findMember(name) {
        return find(this.members, function(member) {
            return member.name === name;
        });
    }
    function addMember(name, propertyName) {
        var existing = this.findMember(name);
        if (existing) {
            throw new Error(
                'duplicate member ' + name + ' for ' + this
            );
        }
        this.members.push({
            name: name,
            property: propertyName,
            as: null
        });
    }

    function DeclareInstruction(from) {
        this.from = from;
        this.members = [];
    }
    DeclareInstruction.prototype = {
        constructor: DeclareInstruction,
        type: 'declare',
        findMember: findMember,
        addMember: addMember,
        preventConflict: function(id) {
            this.name = '$' + id;
            preventMembersConflict.call(this, id);
        },
        toSource: function(minify) {
            var source;
            if (this.members.length === 1 && this.members[0].name === '') {
                var firstMember = this.members[0];
                source = 'var ' + firstMember.as + ' = ' + uneval(this.from) + ';';
            } else {
                source = 'var ';
                source += this.name;
                source += ' = ';
                source += uneval(this.from);
                source += ';';
                if (!minify) {
                    source += '\n';
                }

                var inlineName = this.name;
                source += this.members.map(function(member) {
                    var memberSource = '';
                    memberSource += 'var ';
                    memberSource += member.as;
                    memberSource += ' = ';
                    memberSource += inlineName;

                    var propertyName = member.name;
                    if (propertyName) {
                        memberSource += '[' + uneval(propertyName) + ']';
                    }
                    memberSource += ';';
                    return memberSource;
                }).join(minify ? '' : '\n');
            }
            return source;
        }
    };

    function ImportInstruction(from) {
        this.from = from;
        this.members = [];
    }
    ImportInstruction.prototype = {
        constructor: ImportInstruction,
        type: 'import',
        findMember: findMember,
        addMember: addMember,
        preventConflict: preventMembersConflict,
        toSource: function(minify) {
            var source = 'import {';
            source += this.members.map(function(member) {
                var memberSource = '';
                memberSource += member.name;
                if (member.as) {
                    memberSource += ' as ' + member.as;
                }
                return memberSource;
            }).join(minify ? ',' : ', ');
            source += '}';
            source += ' from ';
            source += "'" + this.from + "'";
            source += ';';
            return source;
        }
    };

    return {
        create: function createInstruction(type, arg) {
            if (type === 'inline') {
                return new DeclareInstruction(arg);
            }
            if (type === 'import') {
                return new ImportInstruction(arg);
            }
        }
    };
})();

function find(iterable, fn) {
    var i = 0;
    var j = iterable.length;
    var found = null;
    while (i < j) {
        found = iterable[i];
        if (fn(found, i, iterable)) {
            break;
        }
        found = null;
        i++;
    }
    return found;
}

function generateAbstractSource(abstractObjects, minify) {
    var instructions = [];
    var links = [];
    abstractObjects.forEach(function(abstractObject) {
        Object.keys(abstractObject).forEach(function(propertyName) {
            var abstractProperty = abstractObject[propertyName];
            var instruction = find(instructions, function(instruction) {
                return (
                    instruction.type === abstractProperty.type &&
                    instruction.from === abstractProperty.from
                );
            });
            if (instruction) {

            } else {
                instruction = Instruction.create(abstractProperty.type, abstractProperty.from);
                instructions.push(instruction);
            }
            instruction.addMember(abstractProperty.name, propertyName);
            links.push({
                object: abstractObject,
                property: propertyName,
                instruction: instruction
            });
        });
    });
    // set a unique variable name for every instruction
    // to prevent clash and allow collecting thoose variable later
    var id = 0;
    instructions.forEach(function(instruction) {
        id++;
        instruction.preventConflict(id);
    });

    function generateInstructionSource() {
        return instructions.map(function(instruction) {
            return instruction.toSource(minify);
        }).join(minify ? '' : '\n');
    }
    function getAbstractObjectVariableNameForProperty(abstractObject, property) {
        var link = find(links, function(link) {
            return (
                link.object === abstractObject &&
                link.property === property
            );
        });
        var instruction = link.instruction;
        var abstractProperty = abstractObject[property];
        var member = instruction.findMember(abstractProperty.name);
        if (member) {
            return member.as;
        }
        throw new Error(
            'cannot find named member ' + abstractProperty.name + ' of property ' + property
        );
    }
    function generateCollectorSources() {
        return abstractObjects.map(function(abstractObject) {
            var objectSource = '{';
            objectSource += Object.keys(abstractObject).map(function(key) { // eslint-disable-line
                return '"' + key + '": ' + getAbstractObjectVariableNameForProperty(abstractObject, key);
            }).join(minify ? ',' : ', ');
            objectSource += '}';
            return 'collect(' + objectSource + ');';
        }).join(minify ? '' : '\n');
    }

    return (
        generateInstructionSource() +
        (minify ? '' : '\n\n') +
        'var collector = [];' +
        (minify ? '' : '\n') +
        'function collect(a) {' +
        (minify ? '' : '\n') +
        (minify ? '' : '\t') +
        'collector.push(a);' +
        (minify ? '' : '\n') +
        '}' +
        (minify ? '' : '\n') +
        generateCollectorSources() +
        (minify ? '' : '\n') +
        'export default collector;'
    );
}

module.exports = generateAbstractSource;

// console.log(
//     generateSource(
//         [
//             {
//                 foo: {
//                     type: 'import',
//                     name: 'default',
//                     from: './foo.js'
//                 },
//                 bar: {
//                     type: 'import',
//                     name: 'default',
//                     from: './bar.js'
//                 },
//                 baz: {
//                     type: 'import',
//                     name: 'filename',
//                     from: './bar.js'
//                 },
//                 name: {
//                     type: 'inline',
//                     name: '',
//                     from: 'nammmmme'
//                 }
//             }
//         ]
//     )
// );
