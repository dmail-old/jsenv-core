/*
		oneOf: equals: 10, equals: 10 -> ce sont les mêmes ça va fail, pour un oneOf c'est un conflit et c'est la seule chose qu'on détecte
		anyOf: on peut pas détecter de conflit autre que les conflit d'un is pour chaque anyOf
		allOf: il faut considérer chaque keyword du allOf comme un is
		not: là c'est chaud il faut vérifier que is n'existe pas à l'opposé
		bref à réfléchir mais chaud de détecter des conflits c'est un efeature compliqué
		*/

/*
seul un groupe : not, anyOf, oneOf can duplicate keyword and expect conflictual things
only group can create conflict ? in any cas we have to test conflict with keyword defined in subschema
keyword acting on the same value should maybe belong to the same schema, or at least the same group of keywords
this way we can iterate over the list of keyword easyly to check for conflicts

equals: 10, anyOf: [equals: 5, equals: 3]
maximum: 5, anyOf: [minimum: 10, minimum: 3]
multipleOf: 2, anyOf: [multipleOf: 3]
*/

var conflicts = [
	['minimum', 'maximum'],
	function numberBoundaryConflict(minimum, maximum){
		var maxAllowedValue;
		var minAllowedValue;
		var minValue = minimum.value;
		var maxValue = maximum.value;

		if( maximum.meta.exclusiveMaximum ){
			maxAllowedValue = maxValue + 1;
		}
		else{
			maxAllowedValue = maxValue;
		}

		if( minimum.meta.exclusiveMinimum ){
			minAllowedValue = minValue - 1;
		}
		else{
			minAllowedValue = minValue;
		}

		return minAllowedValue > maxAllowedValue;
	},

	['type', 'type'],
	function typeConflict(firstType, secondType){
		return firstType.value === secondType.value;
	},

	/*
	['type', 'type'],
	function typeConflict(firstType, secondType){
		return false === firstType.equals(secondType);
	},

	['equal', 'equal'],
	function equalsConflict(firstEquals, secondEquals){
		// sauf si font partie d'un schéma oneOf ou anyOf
		return false === firstEquals.equals(secondEquals);
	},
	*/

	['maxLength', 'minLength'],
	function stringLengthBoundaryConflict(maxLength, minlength){
		// sauf si font partie d'un schema anyOf ou oneOf
		return minlength.value > maxLength.value;
	},

	['minProperties', 'maxProperties'],
	function propertiesLengthBoundaryConflict(minProperties, maxProperties){
		// sauf si font partie d'un anyOf ou oneOf
		return minProperties.value > maxProperties.value;
	}
];

export default conflicts;