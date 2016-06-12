function replace(string, values){
	return string.replace((/\\?\{([^{}]+)\}/g), function(match, name){
		if( match.charAt(0) == '\\' ) return match.slice(1);
		return (values[name] != null) ? values[name] : '';
	});
}

export default replace;