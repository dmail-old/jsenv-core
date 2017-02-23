expose(
    {
        run: feature.runStandard(parent, 'big'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'inline',
            value: function big() {
                return parent.meta.createHTML(this, 'big');
            }
        }
    }
);
