var Timeout = {
	timer: null,

	constructor: function(fn, bind, value){
		this.fn = fn;
		this.bind = bind;
		if( arguments.length > 2 ){
			this.set(value);
		}
	},

	valueOf: function(){
		return this.value;
	},

	create: function(){
		var timeout = Object.create(this);

		timeout.constructor.apply(timeout, arguments);

		return timeout;
	},

	expire: function(){
		this.fn.call(this.bind);
	},

	has: function(){
		return this.timer !== null;
	},

	get: function(){
		return this.value;
	},

	set: function(value){
		this.delete();
		this.value = value;
		if( value ){
			this.timer = setTimeout(this.expire.bind(this), value);
		}
	},

	delete: function(){
		if( this.timer ){
			clearTimeout(this.timer);
			this.timer = null;
		}
	}
};

export default Timeout;