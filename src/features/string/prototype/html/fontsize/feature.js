expose(
    {
        run: feature.runStandard(parent, 'fontsize'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'inline',
            value: function fontsize(size) {
                return parent.meta.createHTML(this, 'fontsize', 'size', size);
            }
        }
    }
);
