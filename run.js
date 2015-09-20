function run(location){
	var path = require('path');
	var cwd = process.cwd();
	var fsFileLocation = path.resolve(cwd, location);
	var dirname = path.dirname(fsFileLocation);

	process.chdir(dirname);
	location = path.basename(location);

	require(path.resolve(__dirname, './index.js'));

	global.platform.ready(function(){
		global.platform.info('running', global.platform.locate(location));
		return System.import(location);
	});
}

module.exports = run;