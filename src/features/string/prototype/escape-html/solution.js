feature.polyfill(escapeHTML);

function escapeHTML() {
    return String(this).replace(/[&<"']/g, function(char) {
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
