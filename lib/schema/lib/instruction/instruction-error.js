import proto from 'proto';

function getArgumentName(argumentIndex) {
    let argumentName;

    if (argumentIndex === 0) {
        argumentName = 'first argument';
    } else if (argumentIndex === 1) {
        argumentName = 'second argument';
    } else {
        argumentName = 'argument n°' + argumentIndex;
    }

    return argumentName;
}

var errorMessages = {
    "ARGUMENT_LENGTH"(instruction, expectedLength, actualLength) {
        let message = '';

        message += proto.kindOf(instruction);
        message += ' constructor expect ';
        message += expectedLength;
        message += ' arguments ';
        message += '(got ' + actualLength + ')';

        return message;
    },

    "NOT_ENOUGH_ARGUMENT"(instruction, minLength, actualLength) {
        let message = '';

        message += proto.kindOf(instruction);
        message += ' constructor expect at least ';
        message += minLength;
        message += ' arguments ';
        message += '(got ' + actualLength + ')';

        return message;
    },

    "TOO_MUCH_ARGUMENT"(instruction, maxLength, actualLength) {
        let message = '';

        message += proto.kindOf(instruction);
        message += ' constructor expect less than ';
        message += maxLength;
        message += ' arguments ';
        message += '(got ' + actualLength + ')';

        return message;
    },

    "DUPLICATE_ARGUMENT"(instruction, duplicateArgument, duplicateIndexes) {
        let message = '';

        message += proto.kindOf(instruction);
        message += ' constructor expect unique arguments ';
        message += ' but ' + duplicateArgument + ' found for arguments';
        message += ' ' + duplicateIndexes.join(' and ');

        return message;
    },

    "ARGUMENT_TYPE"(instruction, expectedType, actualType, argumentIndex) {
        let message = '';

        message += proto.kindOf(instruction);
        message += ' constructor ';
        message += getArgumentName(argumentIndex);
        message += ' type must be ';
        message += typeof expectedType === 'string' ? expectedType : expectedType.join(' or ');
        message += ' (not ' + actualType + ')';

        return message;
    },

    "ARGUMENT_KIND"(instruction, expectedKind, actualKind, argumentIndex) {
        let message = '';

        message += proto.kindOf(instruction);
        message += ' constructor ';
        message += getArgumentName(argumentIndex);
        message += ' kind must be ';
        message += typeof expectedKind === 'string' ? expectedKind : expectedKind.join(' or ');
        message += ' (not ' + actualKind + ')';

        return message;
    },

    "ARGUMENT_VALUE"(instruction, expectedValues, actualValue, argumentIndex) {
        let message = '';

        message += proto.kindOf(instruction);
        message += ' constructor ';
        message += getArgumentName(argumentIndex);
        message += ' must be one of ';
        message += expectedValues.join(',');

        return message;
    },

    "CONFLICT"(instruction, otherInstruction/* , index */) {
        let message = '';

        message += 'instruction conflict between ';
        message += instruction.stringify();
        message += ' and ';
        message += otherInstruction.stringify();

        return message;
    },

    "UNKNOWN"(instructionName) {
        let message = '';

        message += 'instruction not found : ';
        message += instructionName;

        return message;
    }
};

function InstructionError(code, ...args) {
    var error = new Error();

    error.constructor = InstructionError;
    error.name = error.constructor.name;
    error.code = code;
    if ((code in errorMessages) === false) {
        throw new Error('unkown error code ' + code);
    }
    error.message = errorMessages[code].apply(errorMessages, args);

    return error;
}

export default InstructionError;
