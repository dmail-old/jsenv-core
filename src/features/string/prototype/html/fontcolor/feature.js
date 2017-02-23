expose(
    {
        run: feature.runStandard(parent, 'fontcolor'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'inline',
            value: function fontcolor(color) {
                return parent.meta.createHTML(this, 'fontcolor', 'color', color);
            }
        }
    }
);
