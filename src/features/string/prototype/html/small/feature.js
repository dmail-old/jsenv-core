expose(
    {
        run: feature.runStandard(parent, 'small'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'small',
            value: function small() {
                return parent.meta.createHTML(this, 'small');
            }
        }
    }
);
