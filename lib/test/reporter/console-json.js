var ConsoleJSONReporter = {
	constructor: function(stream){
		this.stream = stream || process.stdout;
	},

	events: {
		'end': function(test){
			var json = test.toJSON();

			json.platform = {
				type: platform.type,
				name: platform.name,
				version: platform.version
			};

			this.stream.write(JSON.stringify(json, null, '\t'));
		}
	}
};

export default ConsoleJSONReporter;