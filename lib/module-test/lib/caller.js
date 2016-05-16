var Caller = {
	getStackTrace: function(error){
		return platform.trace(error);
	},

	createCaller: function(callSite){
		return callSite ? {
			fileName: callSite.getFileName(),
			lineNumber: callSite.getLineNumber(),
			columnNumber: callSite.getColumnNumber()
		} : null;
	},

	findCaller: function(stackTrace, fn, bind){
		// find the caller in the stack trace
		var callSite = stackTrace.callSites.find(fn, bind);
		return this.createCaller(callSite);
	},

	fromError: function(error, fn, bind){
		return this.findCaller(this.getStackTrace(error), fn, bind);
	},

	get: function(fn, bind){
		return this.findCaller(this.getStackTrace(), fn, bind);
	},

	findByFileName: function(fileName){
		return this.get(function(callSite){
			return callSite.getFileName() === fileName;
		});
	}
};

export default Caller;