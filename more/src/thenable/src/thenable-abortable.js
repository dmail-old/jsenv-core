function createThenableAbortable(thenable, abort){
	var aborted = false;

	if( typeof thenable === 'function' ){
		var executor = thenable;
		thenable = new Promise(function(resolve, reject){
			abort = executor(resolve, reject);
		});
	}

	if( abort && typeof abort != 'function' ){
		throw new TypeError(abort  +' is not a function');
	}

	var proxyPromise = new Promise(function(resolve, reject){
		thenable.then(
			function(value){
				if( false === aborted ){
					resolve(value);
				}
			},
			function(value){
				if( false === aborted ){
					reject(value);
				}
			}
		);
	});

	proxyPromise.abort = function(){
		if( aborted === false ){
			if( abort ){
				abort();
			}
			aborted = true;
		}
	};

	return proxyPromise;
}

export default createThenableAbortable;