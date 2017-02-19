expose(
    'timer/set-timeout',
    {
        pass: function(asap, settle) {
            var setTimeoutCalledBeforeAsap = false;
            setTimeout(function() {
                setTimeoutCalledBeforeAsap = true;
            }, 1);
            asap(function() {
                settle(setTimeoutCalledBeforeAsap);
            });
        }
    }
);
