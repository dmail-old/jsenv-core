/*
we could provide a brutal reload as this one (window.reload or process.kill)
but we may also provide a gracefulreload by placing hook on every possible pending action
(setTimeout, setImmediate, setInterval, requestAnimationFrame, xhr & dom callbacks, ...)
Then deleting all thoose hooks and wait for the end of the current event loop doing setImmediate(function() {
	// here we rerun the mainModule code
	// how to rerun the mainModule code, Im' not sure Systemjs provide a way to do this, we could delete the cache for the mainModule
	// and rerun it
});
But that would be a bunch of work:
- identify and delete all hooks, WOW
- in a scenario where many env are generated only hooks of the restarted env should be removed, WOW
  it would mean not using window.setTimeout anymore but env.setTimeout
  for a first version restart() could exists only on jsenv on would restart all generated env but the ideal way to do
  would be to provide env.setTimeout etc to be able to restart a specific env code
- rerun the mainModule may have side effects and how to is not clear atm
*/

import jsenv from 'jsenv';

import restart from './#{jsenv|default.agent.type}.js';

jsenv.build(function restartMethod() {
    return {
        restart: restart
    };
});

