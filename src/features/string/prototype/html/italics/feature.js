expose(
    {
        run: feature.runStandard(parent, 'italics'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'inline',
            value: function italics() {
                return parent.meta.createHTML(this, 'i');
            }
        }
    }
);
