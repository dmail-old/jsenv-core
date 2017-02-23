expose(
    {
        run: feature.runStandard(parent, 'blink'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'inline',
            value: function blink() {
                return parent.meta.createHTML(this, 'blink');
            }
        }
    }
);
