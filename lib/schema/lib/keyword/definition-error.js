const errors = {
    TYPE(keyword, actualType, expectedType) {
        let message = '';

        message += 'keyword value type must be ';
        message += typeof expectedType === 'string' ? expectedType : expectedType.join(' or ');
        message += ' (not ' + actualType + ')';

        return message;
    },

    KIND(keyword, actualKind, expectedKind) {
        let message = '';

        message += 'keyword value kind must be ';
        message += typeof expectedKind === 'string' ? expectedKind : expectedKind.join(' or ');
        message += ' (not ' + actualKind + ')';

        return message;
    },

    /*
    "EMPTY"(keyword) {
        let message = '';

        message += keyword;
        message += ' keyword value must not be empty';

        return message;
    },
    */

    DUPLICATE(keyword, duplicateKeys, duplicateValue) {
        let message = '';

        message += keyword;
        message += ' keyword values must be unique';
        message += ' but ' + duplicateValue + ' found for keys';
        message += ' ' + duplicateKeys;

        return message;
    },

    UNKNOWN(keyword) {
        let message = '';

        message += keyword;
        message += ' keyword does not exist';

        return message;
    },

    MISSING(keyword, missingKeyword) {
        let message = '';

        message += keyword;
        message += ' keyword expect the presence of ' + missingKeyword + ' keyword';

        return message;
    }

    /*
    "LOOSE"(keyword, ownerKeyword) {
        let message = '';

        message += keyword;
        message += ' keyword must belong to ' + ownerKeyword;

        return message;
    }

    "EARLY"(keyword, minDepth) {
        let message = '';

        message += keyword;
        message += ' keyword depth must be greater than ' + minDepth;

        return message;
    }
    */
};

function DefinitionError(code, ...args) {
    var error = new Error();

    error.name = 'DefinitionError';
    error.code = code;
    error.message = errors[code].apply(errors, args);

    return error;
}

export default DefinitionError;
