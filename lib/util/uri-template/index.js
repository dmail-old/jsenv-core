import proto from 'env/proto';
import StringTemplate from 'env/stirng-template';
import URI from 'env/uri';

const URITemplate = proto.extend('URITemplate', {
    constructor(string) {
        this.template = StringTemplate.create(string);
    },

    eval(scope) {
        let compiledTemplate = this.template.eval(scope);

        return URI.create(compiledTemplate.toString());
    }
});

export default URITemplate;
