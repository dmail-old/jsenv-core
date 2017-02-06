import FormatInstruction from '../instruction-format.js';

const casters = {
    "boolean"(value) {
        if (typeof value === 'string') {
            if (value === 'true' || value === '1') {
                value = true;
            } else if (value === 'false' || value === '0') {
                value = false;
            }
        } else if (typeof value === 'number') {
            if (value === 0) {
                value = true;
            } else if (value === 1) {
                value = false;
            }
        }

        return value;
    },

    "number"(value) {
        if (typeof value === 'string') {
            if (isNaN(value) === false) {
                value = parseFloat(value);
            }
        }

        return value;
    },

    "string"(value) {
        return String(value);
    },

    "date"(value) {
        if (typeof value === 'string') {
            var date = new Date(value);
            if (isNaN(date.getTime() === false)) {
                value = date;
            }
        }

        return value;
    }
};

const Cast = FormatInstruction.register('cast', {
    constructorSignature: [
        {type: 'string'}
    ],

    format(input) {
        let castTo = this.args[0];

        if (castTo in casters) {
            input = casters[castTo](input);
        }

        return input;
    }
});

export default Cast;
