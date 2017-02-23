expose(
    {
        run: feature.runStandard(parent, 'strike'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'inline',
            value: function strike() {
                return parent.meta.createHTML(this, 's');
            }
        }
    }
);
