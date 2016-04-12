import proto from 'proto';

var MappedIterator = proto.extend({
	constructor(iterable, map, bind){
		if( typeof map != 'function' ) throw new TypeError('map must be a function');
		if( false === Symbol.iterator in iterable ) throw new TypeError('not iterable', iterable);

		this.iterable = iterable;
		this.iterator = iterable[Symbol.iterator]();
		this.map = map;
		this.bind = bind;
		this.index = 0;
	},

	next(){
		var next = this.iterator.next();

		if( next.done === false ){
			next.value = this.map.call(this.bind, next.value, this.index, this.iterable);
			this.index++;
		}

		return next;
	},

	toString(){
		return '[object Mapped Iterator]';
	}
});

var MappedIterable = proto.extend({
	iterable: null,
	map: null,
	bind: null,

	constructor(iterable, map, bind){
		this.iterable = iterable;
		this.map = map;
		this.bind = bind;
	},

	toString(){
		return '[object Mapped Iterable]';
	},

	[Symbol.iterator](){
		return MappedIterator.create(this.iterable, this.map, this.bind);
	}
});

function createMappedIterable(iterable, fn, bind){
	return MappedIterable.create(iterable, fn, bind);
}

export default createMappedIterable;