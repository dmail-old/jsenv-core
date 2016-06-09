import jsenv from 'jsenv';

// import assert from '@node/assert';

jsenv.generate({
    logLevel: 'info',
    autorun() {
        // call exports.default
        this.parent.result.default();
    },
    cover: {

    }
}).then(function(env) {
    var source = `
    export default function() {
        return true;
    }
    `;
    var sourceAddress = 'anonymous';

    return env.evalMain(source, sourceAddress).then(function() {
        // console.log(env.plugins.get('cover').value);
    });
});
