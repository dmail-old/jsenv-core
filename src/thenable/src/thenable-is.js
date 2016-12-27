function isThenable(a){
	return a && typeof a.then === 'function';
}

export default isThenable;