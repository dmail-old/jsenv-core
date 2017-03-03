import {objectIsCoercible} from '/fix-helpers.js';

function escapeHTML() {
    objectIsCoercible(this);
    var string = String(this);
    return string.replace(/[&<"']/g, function(char) {
        if (char === '&') {
            return '&amp;';
        }
        if (char === '<') {
            return '&lt;';
        }
        if (char === '>') {
            return '&gt;';
        }
        if (char === '"') {
            return '&quot;';
        }
        if (char === '\'') {
            return '&apos;';
        }
        return '&#039;';
    });
}

const fix = {
    type: 'inline',
    value() {
        String.prototype.escapeHTML = escapeHTML;
    }
};

export default fix;
