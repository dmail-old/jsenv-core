require('./index.js');

function run(path){
	global.platform.ready(function(){
		global.platform.info('running', global.platform.locate(path));

		return System.import(path);
	});
}

module.exports = run;