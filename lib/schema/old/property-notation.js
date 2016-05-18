// porperty keyword are abstract keyword in fact, just like additionalproperties for instance
// they are keywords that must be created at a specific point

import DefinitionError from '../definition-error.js';
import Keyword from '../keyword.js';
import AbstractKeyword from './keyword-abstract.js';

let PropertyNotation = Object.assign(AbstractKeyword, {
	requiredDepth: 1,
	isPropertyNotation: true,

	get depth(){
		var depth = 0, parentOrSelf = this;

		while( parentOrSelf ){
			if( parentOrSelf.hasOwnProperty('propertyName') ){
				depth++;
			}
			parentOrSelf = parentOrSelf.parent;
		}

		return depth;
	},

	createPropertyKeyword(propertyName){
		const clone = this.clone();

		clone.params.set('propertyName', propertyName);
		// clone.createRealKeyword = clone;

		return clone;
	},

	createRealKeyword(){
		const parent = parent;

		// parent must be a properties keyword
		if( false === parent.hasOwnProperty('propertyName') ){
			throw new DefinitionError('LOOSE', this.name, 'properties');
		}

		const propertyName = parent.propertyName;

		let cloneParent = parent;
		let depthCount = this.requiredDepth;
		while(depthCount--){
			cloneParent = cloneParent.parent;
			if( !cloneParent ){
				throw new DefinitionError('EARLY', this.name, this.requiredDepth);
			}
		}

		// problem is that the clone should not also create a keyword
		const propertyKeyword = this.createPropertyKeyword(propertyName);

		cloneParent.addKeyword(propertyKeyword);

		return propertyKeyword;
	}
});

export default PropertyNotation;