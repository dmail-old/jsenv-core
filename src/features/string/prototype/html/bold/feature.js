expose(
    {
        run: feature.runStandard(parent, 'bold'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'inline',
            value: function bold() {
                return parent.meta.createHTML(this, 'b');
            }
        }
    }
);
