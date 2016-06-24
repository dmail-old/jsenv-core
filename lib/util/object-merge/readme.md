## merge

Merge the properties of source into target

```javascript
var merge = require('object/merge');

merge({foo: 'foo'}, {bar: 'bar'}); // {foo: 'boo', bar: 'bar'}
```

You can pass a predefined array of property names.

```javascript
merge({name: 'dam'}, {name: 'john', age: 10}, ['age']); // {name: 'dam', age: 10}
```

Merged properties clone objects

```javascript
var left = {};
var right = {item: {name: 'item'}};

merge(left, right);

left.item.name; // 'item'
left.item == right.item; // false
```

Advanced use case

```javascript

// advanced example
var defaultOptions = {
	a: true,
	item: {
		b: true
	}
};
var userOptions = {
	a: false,
	item: {
		b: false,
		c: true
	}
};
merge(merge({}, defaultOptions), userOptions); // {a: false, item: {b: false, c: true}}
```
