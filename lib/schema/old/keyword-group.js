import proto from 'proto';

import Keyword from '../keyword.js';
import DefinitionError from '../definition-error.js';
import SortedArray from '../util/array-sorted.js';

import './assert/index.js';
import './format/index.js';

var KeywordGroup = Keyword.extend('KeywordGroup', {
	assertions: ['is-object'],
	propertyName: undefined,
	//conflictWithOpposite: true,
	//conflictWithOtherInstance: false,

	constructor(value){
		KeywordGroup.super.constructor.apply(this, arguments);

		this.children = [];
		if( value ){
			this.setAll(value);
		}
	},

	clone(deep){
		const clone = KeywordGroup.super.clone.call(this, deep);

		if( this.hasOwnProperty('propertyName') ){
			clone.propertyName = this.propertyName;
		}
		if( deep ){
			clone.children = this.children.map(function(child){
				return child.clone();
			});
		}

		return clone;
	},

	checkChildConflict(){

	},

	addKeyword(keyword){
		keyword.parent = this;

		this.checkChildConflict(keyword);

		SortedArray.add(this.children, keyword, this.compareKeyword);

		keyword.callHook('added');

		return keyword;
	},

	removeKeyword(keyword){
		keyword.callHook('remove');

		if( KeywordGroup.isPrototypeOf(keyword) ){
			let children = keyword.children, child, count = children.length;
			if( count ){
				while(count--){
					child = keyword.children[0];
					child.parent.removeKeyword(child);
				}
			}
		}
		/*
		// why could we need this?
		if( keyword.hasOwnProperty('parent') ){
			let parent = keyword.parent;
			if( parent ){
				parent.removeKeyword(keyword);
			}
		}
		*/

		var index = this.children.indexOf(keyword);
		if( index > -1 ){
			this.children.splice(index, 1);
			keyword.parent = undefined;
			keyword.dependencies.forEach(function(dependency, index){
				keyword.removeDependency(index);
			}, this);
			keyword.callHook('removed');

			return true;
		}
		return false;
	},

	getKeywordNameIndex(keywordName){
		return this.getPrototypeIndex(this.getKeywordPrototypeByName(keywordName));
	},

	compareKeywordNames(nameA, nameB){
		return this.getKeywordNameIndex(nameA) - this.getKeywordNameIndex(nameB);
	},

	createChild(KeywordPrototype, keywordValue){
		const dependencies = KeywordPrototype.dependencies.map(this.get, this);

		return KeywordPrototype.create(keywordValue, dependencies);
	},

	setAll(definition){
		return Object.keys(definition).sort(this.compareKeywordNames.bind(this)).map(function(keywordName){
			const KeywordPrototype = this.getKeywordPrototypeByName(keywordName);

			return this.addKeyword(this.createChild(KeywordPrototype, definition[keywordName]));
		}, this);
	},

	set(keywordName, keywordValue){
		const keyword = this.createKeyword.apply(this, arguments);
		return this.addKeyword(keyword);
	},

	get(keywordName){
		return this.children.find(function(keyword){
			return keyword.name == keywordName;
		});
	},

	delete(keywordName){
		const keyword = this.get(keywordName);
		if( keyword ) return this.removeKeyword(keyword);
		return false;
	},

	isConcernedBy(valueContainer){
		if( false === KeywordGroup.super.isConcernedBy.call(this, valueContainer) ) return false;
		if( this.hasOwnProperty('propertyName') && false === valueContainer.hasProperty(this.propertyName) ) return false;
		return true;
	},

	testMode: 'every',

	test(validity){
		// instead of skipping silently, we should report why the keyword was skipped:
		// skipped because in disabled state (disabled)
		// skipped because of expected value (inactiveValue)
		// skipped because of param combinaison (cast, trim)
		// once value is known
		// skipped because of value type (restrictedTo)
		// skipped for this specific value because value has not a specific property (dependency)
		// skipped for this specific value because value has a property (default)
		// on eval chaque keyword

		/*
		state: 'skipped', 'evaluated',
		data:
			for skipped: 'disabled', 'param-configuration', 'value-restriction', 'property-absence', 'property-presence'
			for evaluated:
				result: {
					type: 'assert', 'assign'
				}
			for errored: the error
		*/

		const filteredKeywords = this.children.filter(function(keyword){
			return keyword.isActive() && keyword.isConcernedBy(validity.valueContainer);
		});

		if( this.hasOwnProperty('propertyName') ){
			return validity.adopt(validity.createPropertyValidity(this.propertyName).every(filteredKeywords));
		}

		return validity.checkMany(filteredKeywords, this.testMode);
	}
});

export default KeywordGroup;