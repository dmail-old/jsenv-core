expose(
    {
        run: feature.runStandard(parent, 'link'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                parent.meta.testHTMLMethod(output.value, settle)
            );
        },
        solution: {
            type: 'inline',
            value: function link(url) {
                return parent.meta.createHTML(this, 'a', 'href', url);
            }
        }
    }
);
