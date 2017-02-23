// https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
// https://googlechrome.github.io/samples/promise-rejection-events/

expose(
    {
        run: feature.runStandard('Promise'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.promise',
            // we have to do this to be sure corejs polyfill activates
            // because if we need unhandled-rejection support corejs may fail to detect its missing
            // but we know its missing so force corejs polyfill in that case
            beforeFix: 'delete Promise;'
        }
    }
);
