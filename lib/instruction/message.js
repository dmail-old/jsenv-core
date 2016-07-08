import proto from 'proto';

import InstructionList from './instruction-list.js';

/*

function ValidationError(code, message) {
    var error = new Error(message);

    error.constructor = ValidationError;
    error.name = error.constructor.name;
    error.code = code;

    return error;
}
    allOf

    createString(reverse){
    const not = this.hasFlag('not');

    let combinator;
    let reverseDescendant;

    if( reverse && not ){
        combinator = 'AND';
        reverseDescendant = false;
    }
    else if( not ){
        combinator = 'OR';
        reverseDescendant = true;
    }
    else{
        combinator = 'AND';
        reverseDescendant = false;
    }

    const string = this.list.map(function(group){
        return group.toDefinitionString(reverseDescendant);
    }).join(' ' + combinator + ' ');

    return string;
},

createMessage(validity){
    if( this.hasFlag('not') ){
        return validity.children.map(function(child){
            // we must temp reverse the child
            return child.createMessage();
        }).join(' OR ');
    }

    return validity.failureReason.getFailureMessage(validity);
}
*/

/* anyOf

toDefinitionString(reverse){
        if( reverse ) this.reverse();

        const not = this.hasFlag('not');
        let combinator;

        if( not ){
            combinator = 'AND';
        }
        else{
            combinator = 'OR';
        }

        // in this scenario, we only want to print what has failed, but we are printing everything
        // toDefinitionString is great but we need something for toFailureString

        const string = this.list.map(function(group){
            return group.toDefinitionString(not);
        }, this).join(' ' + combinator + ' ');

        if( reverse ) this.reverse();

        return string;
    },

*/

/*
oneOf

toExpectationString(){
        var expectationString = this.value.map(function(schema){
            return schema.toExpectationString();
        }).join(' AND ');

        if( this.not ){
            expectationString = 'none or more than one of ' + expectationString;
        }
        else{
            expectationString = 'one of ' + expectationString;
        }

        return expectationString;
    },

*/

/*
properties

toDefinitionString(){
        return this.list.map(function(group){
            return 'when present ' + group.toDefinitionString();
        }).join(' AND ');
    },

*/

/*
values

toDefinitionString(){
        return 'for each property ' + Values.super.toDefinitionString.call(this);
    },
*/

export default ValidationMessage;
