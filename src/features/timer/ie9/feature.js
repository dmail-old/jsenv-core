expose(
    {
        pass: function() {
            return (
                jsenv.isBrowser() &&
                /MSIE .\./.test(window.navigator.userAgent)
            ) === false;
        },
        solution: {
            type: 'corejs',
            value: 'web.timers'
        }
    }
);
