function filterIterableWithThenable(iterable, filter, bind){
	var values = Array.from(iterable);
	var thenables = values.map(function(value){
		return filter.call(bind, value);
	});

	return Promise.all(thenables).then(function(filterResults){
		return values.filter(function(val, index){
			return filterResults[index] === true; 
		});
	});
}
