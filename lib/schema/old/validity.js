import proto from 'proto';

import safeHasProperty from './util/safe-has-property.js';

var Expression = proto.extend('Expression', {
	source: undefined,
	name: 'value',
	owner: null,
	metaGetters: {
		path(value){
			return this.getPath().concat(this.name).join('.');
		}
	},

	constructor(options){
		if( options ){
			Object.assign(this, options);
		}

		if( false === this.hasOwnProperty('name') ){
			this.name = this.getDefaultName(this.source);
		}

		this.propertyContainers = new Map();
	},

	getDefaultName(value){
		return this.name;

		/*
		var name = proto.kindOf(value);
		name = name[0].toLowerCase() + name.slice(1);
		return name;
		*/
	},

	get value(){
		return this.source;
	},

	set value(value){
		if( value != this.source ){
			this.source = value;
			// update the value in the object
			if( this.hasOwnProperty('owner') ){
				this.owner[this.name] = value;
			}
		}
	},

	getPath(){
		var path = [];
		var parentContainer = this.parent;

		while( parentContainer ){
			path.unshift(parentContainer.name);
			parentContainer = parentContainer.parent;
		}

		return path;
	},

	hasProperty(propertyName){
		return safeHasProperty(propertyName, this.value);
	},

	createPropertyExpression(propertyName){
		var propertyExpression;

		if( this.propertyExpressions.has(propertyName) ){
			propertyExpression = this.propertyExpressions.get(propertyName);
		}
		else{
			propertyExpression = this.create({
				value: this.value[propertyName],
				name: propertyName,
				owner: this.value
			});

			propertyExpression.parent = this;
			//this.children.push(propertyValueContainer);

			this.propertyExpressions.set(propertyName, propertyExpression);
		}

		return propertyExpression;
	}
});

var Validity = proto.extend('Validity', {
	valid: true,

	constructor(validable){
		if( typeof validable != 'object' ){
			throw new TypeError('Validity expect an object');
		}
		if( typeof validable.validate != 'function' ){
			throw new TypeError('validable must have a validate method');
		}

		this.validable = validable;
		this.validCount = 0;
	},

	get value(){
		return this.expression.value;
	},

	set value(value){
		return this.expression.value = value;
	},

	createStep(validable, expression){
		const step = Validity.create(validable);

		step.expression = expression;

		return step;
	},

	createPropertyValidity(propertyName){
		const propertyValidity = Validity.create(this.validable);

		propertyValidity.expression = this.expression.createPropertyExpression(propertyName);

		return propertyValidity;
	},

	iterate(iterable, map, bind, mode = 'every'){
		let valid = true;

		this.children = [];

		for(let item of iterable){
			if( map ){
				item = map.call(bind, item);
			}
			let step = Validity.create(item);
			step.expression = this.expression;
			//const step = this.createStep(item, this.valueContainer);

			step.validate();
			this.children.push(step);
			valid = step.valid;

			if( valid ){
				this.validCount++;
			}

			if( mode === 'every' ){
				if( false === valid ){
					this.failureReason = step.failureReason;
					break;
				}
			}
			else if( mode === 'some' ){
				if( true === valid ){
					break;
				}
			}
			else if( typeof mode === 'number' ){
				if( true === valid && this.validCount > mode ){
					valid = false;
					//this.failureReason = child.failureReason;
					break;
				}
			}
			else if( mode === 'parallel' ){
				continue;
			}
		}

		return valid;
	},

	checkMany(list, mode = 'every'){
		return this.iterate(list, null, null, mode);
	},

	every(list){
		return this.checkMany(list, 'every');
	},

	some(list){
		return this.checkMany(list, 'some');
	},

	exactly(list, count){
		return this.checkMany(list, count);
	},

	adopt(validity){
		if( validity !== this ){
			this.valid = validity.valid;
			this.failureReason = validity.failureReason;
			this.children = validity.children;
		}

		return this.valid;
	},

	validate(){
		const validateReturnValue = this.validable.validate(this);

		if( Validity.isPrototypeof(validateReturnValue) ){
			this.adopt(validateReturnValue);
		}
		else if( typeof validateReturnValue  == 'boolean' ){
			this.valid = validateReturnValue;
			if( false === validateReturnValue && false === this.hasOwnProperty('failureReason') ){
				this.failureReason = this.validable;
			}
		}
		else{
			throw new TypeError(this + ' validate() must return a boolean or a validity object');
		}

		return this.valid;
	},

	check(value){
		var expression;
		if( Expression.isPrototypeOf(value) ){
			expression = value;
		}
		else{
			expression = Expression.create({source: value});
		}

		this.expression = expression;

		return this.test();
	}
});

Validity.interfaceProperties = {
	checkValidity(value){
		let validityState = Validity.create(this);

		validityState.check(value);

		return validityState;
	}
};

export default Validity;