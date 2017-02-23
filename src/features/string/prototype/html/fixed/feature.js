expose(
    {
        run: feature.runStandard(parent, 'fixed'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'inline',
            value: function fixed() {
                return parent.meta.createHTML(this, 'tt');
            }
        }
    }
);
