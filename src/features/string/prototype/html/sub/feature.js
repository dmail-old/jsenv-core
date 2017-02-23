expose(
    {
        run: feature.runStandard(parent, 'sub'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'inline',
            value: function sub() {
                return parent.meta.createHTML(this, 'sub');
            }
        }
    }
);
