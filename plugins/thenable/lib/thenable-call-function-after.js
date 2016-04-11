function createThenableCallingFunctionAfterDuration(fn, duration){
	var timer;
	var promise = new Promise(function(resolve, reject){
		timer = setTimeout(function(){
			resolve(fn());
		}, duration);
	});

	promise.cancel = function(){
		if( timer != null ){
			clearTimeout(timer);
			timer = null;
		}
	};

	return promise;
}

export default createThenableCallingFunctionAfterDuration;