import jsenv from 'jsenv';

// import require from '@node/require';
// import assert from '@node/assert';

Promise.resolve().then(function() {
    // remap
    return jsenv.generate({
        logLevel: 'info',
        autorun() {
            this.parent.result.default();
        },
        cover: {
            upload: {
                codecov: true,
                codecovToken: 'f695edf1-d0f4-4799-bb08-46955137f0c3'
            }
        }
    }).then(function(env) {
        var source = `
        export default function() {
            return true;
        }
        `;
        var sourceAddress = 'anonymous';

        return env.evalMain(source, sourceAddress);
    });
});
