/*
// cache should be promise oriented evenf if it's synchronous

// put(request, response) -> sync
// match(request) // resolve to cache, reject when no cache
// delete(request) // returns false or resolve to true if request is cached and deleted sucessfully
*/

import proto from 'proto';

function compareHeader(headerName, headersA, headersB){
	return headersA.get(headerName) === headersB.get(headerName);
}

function compareHeaders(headerNames, headersA, headersB){
	return headerNames.every(function(headerName){
		return compareHeader(headerName, headersA, headersB);
	});
}

function compareVaryHeaders(response, request){
	if( response.headers.has('vary') ){
		var headerNames = response.headers.get('vary').split(',');
		return compareHeaders(headerNames, response.headers, request.headers);
	}
	return true;
}

function compareUrl(requestA, requestB){
	return String(requestA.url) === String(requestB.url);
}

function compareMethod(requestA, requestB){
	return requestA.method === requestB.method;
}

function getHeaderLength(headers){
	var length, headerValue;

	if( headers.has('content-length') ){
		headerValue = headers.get('content-length');
		if( false === isNaN(headerValue) ){
			length = parseInt(headerValue);
		}
	}

	return length;
}

function getLength(httpMessage){
	return httpMessage.body ? getHeaderLength(httpMessage.headers) : 0;
}

function cloneRequest(request){
	var clonedRequest = request.clone();
	if( clonedRequest.body ){
		clonedRequest.body.catch(function(){});
	}
	// avoid unhandled rejection, this is a clone so rejection mus be handled by origin response
	return clonedRequest;
}

function cloneResponse(response){
	var clonedResponse = response.clone();

	if( clonedResponse.body ){
		clonedResponse.body.catch(function(){});
	}
	// calling response.catch on the clone still returns the error anyway
	clonedResponse.cacheState = 'local';

	return clonedResponse;
}

var Cache = proto.extend({
	maxLength: 1000, // max 1000 response stored in cache
	byteLimit: 100 * 1000 * 1000, // max 100 mo of data stored
	byteLength: 0,

	constructor(){
		this.entries = [];
	},

	get length(){
		return this.entries.length;
	},

	clear(){
		this.entries.length = 0;
		this.byteLength = 0;
	},

	set(request, response){
		var index = this.indexOf(request), entry;

		if( index === -1 ){
			if( this.maxLength > 0 && this.length == this.maxLength ){
				this.remove(0);
			}

			index = this.entries.length;
			entry = {
				request: cloneRequest(request),
				response: cloneResponse(response)
			};
			this.add(index, entry);
		}
		else{
			entry = this.entries[index];
			if( response != entry.response ){
				entry.response = cloneResponse(response);
				this.replace(index, entry);
			}
		}

		return entry;
	},

	indexOf(request){
		return this.entries.findIndex(function(entry){
			var cachedRequest = entry.request;
			var cachedResponse = entry.response;

			if( request === cachedRequest ) return true;
			if( false === compareUrl(cachedRequest, request) ) return false;
			if( false === compareMethod(cachedRequest, request) ) return false;
			if( false === compareVaryHeaders(cachedResponse, request) ) return false;
			return true;
		}, this);
	},

	has(request){
		return this.indexOf(request) > -1;
	},

	computeEntryLength(entry){
		var requestLength = getLength(entry.request);
		var responseLength = getLength(entry.response);
		var entryLength = 0;

		if( typeof requestLength === 'number' ){
			entryLength+= requestLength;
		}
		if( typeof responseLength === 'number' ){
			entryLength+= responseLength;
		}

		return entryLength;
	},

	checkByteLimit(length){
		// when the length is not set in headers, we cannot know if the length will ever be too high
		// for the cache, to keep it simple we just cache thoose entry ignoring the byteLimit rule
		if( typeof length === 'number' ){
			if( this.byteLength + length > this.byteLimit ){
				throw new RangeError('the cache byteLimit (' + this.byteLimit + ') would be reached with' + length);
			}
		}

		return true;
	},

	add(index, entry){
		var entryLength = this.computeEntryLength(entry);

		if( this.checkByteLimit(entryLength) ){
			this.byteLength+= entryLength;
			this.entries[index] = entry;
		}

		return this;
	},

	remove(index){
		var entry = this.entries[index];
		this.byteSize-= this.computeEntryLength(entry);
		this.entries.splice(index, 1);
	},

	replace(index, entry){
		var entryLength = this.computeEntryLength(entry);

		this.byteSize-= this.computeEntryLength(this.entries[index]);
		if( this.checkByteLimit(entryLength) ){
			this.byteLength+= entryLength;
			this.entries[index] = entry;
		}
	},

	get(request){
		var index = this.indexOf(request);
		return index === -1 ? null : this.entries[index].response;
	},

	delete(request){
		var index = this.indexOf(request);

		if( index > -1 ){
			this.remove(index);
			return true;
		}
		return false;
	}
});

export default Cache;