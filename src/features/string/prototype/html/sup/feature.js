expose(
    {
        run: feature.runStandard(parent, 'sup'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'inline',
            value: function sup() {
                return parent.meta.createHTML(this, 'sup');
            }
        }
    }
);
