import {createHTML} from '../helpers.js';

function anchor(url) {
    return createHTML(this, 'a', 'href', url);
}

const fix = {
    type: 'inline',
    value() {
        String.prototype.anchor = anchor;
    }
}

export default fix;
