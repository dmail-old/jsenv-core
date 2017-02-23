feature.polyfill(unescapeHTML);

function unescapeHTML() {
    return String(this).replace(/&(?:amp|lt|gt|quot|apos);/g, function(char) {
        if (char === '&amp;') {
            return '&';
        }
        if (char === '&lt;') {
            return '<';
        }
        if (char === '&gt;') {
            return '>';
        }
        if (char === '&quot;') {
            return '"';
        }
        if (char === '&apos;') {
            return '\'';
        }
        return char;
    });
}
