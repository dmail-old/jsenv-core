import Body from '../lib/body.js';

export function suite(add){
	add("fill(pipable) calls pipable.pipeTo(this)", function(){
		var body = Body.create();
		var item = {pipeTo: this.spy()};

		body.fill(item);

		this.calledWith(item.pipeTo, body);
	});

	add("fill(notundefined) write into body and close it", function(){
		var body = Body.create();

		body.fill('yo');

		this.equal(body.state, 'closed');

		return this.resolveWith(body.readAsString(), 'yo');
	});

	add({
		modules: ['node/stream'],
		name: "pipeTo(nodeStream) wrap the nodestream to give him close(),then(),catch(),error() methods",
		fn: function(nodeStream){
			var body = Body.create();
			var streamA = new nodeStream.PassThrough();

			body.pipeTo(streamA);

			this.equal(typeof streamA.close, 'function');
			this.equal(typeof streamA.then, 'function');
			this.equal(typeof streamA.catch, 'function');
			this.equal(typeof streamA.error, 'function');

			streamA.error('foo');

			return this.rejectWith(streamA, 'foo');
		}
	});

	add({
		modules: ['node/stream'],
		name: "fill(nodeStream) will bind the node stream & write(),error(),close() methods",
		fn: function(nodeStream){
			var bodyA = Body.create();
			var bodyB = Body.create();
			var streamA = new nodeStream.PassThrough();
			var streamB = new nodeStream.PassThrough();

			bodyA.fill(streamA);
			bodyB.fill(streamB);

			streamA.end('foo');
			streamB.emit('error', 'bar');

			return Promise.all([
				this.resolveWith(bodyA.readAsString(), 'foo'),
				this.rejectWith(bodyB, 'bar')
			]);
		}
	});

	add("fill(undefined) close without data", function(){
		var body = Body.create();

		body.fill(undefined);

		return this.resolveWith(body.readAsString(), '');
	});

	add("on creation, argument[0] !== undefined is passed to fill()", function(test){
		var body = Body.create('foo');

		return test.resolveWith(body.readAsString(), 'foo');
	});

	add("readAsString is resolved to the stream buffers as string", function(){

	}).skip();
}