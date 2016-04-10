// call fn without impacting the resolved/value of the thenable (except if fn throw/reject error)
function callAfterThenableIsSettled(thenable, fn, bind){
	var value, resolved;

	return thenable.then(
		function(resolutionValue){
			resolved = true;
			value = resolutionValue;
		},
		function(rejectionValue){
			resolved = false;
			value = rejectionValue;
		}
	).then(function(){
		return Promise.resolve(fn.call(bind, value, resolved));
	}).then(function(){
		return resolved ? value : Promise.reject(value);
	});
}

export default callAfterThenableIsSettled;