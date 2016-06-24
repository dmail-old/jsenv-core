## clone

Deeply clone an object, support circular references & property descriptors

```javascript
var clone = require('@dmail/object-clone');

var a = {name: 'a'};
var b = clone(a);
b.name; // 'a'

// of course b != a
```

It clone deeply

```javascript
var a = {
	list: [
		{name: 'first'}
	]
};
var b = clone(a);

b.list[0].name; // 'first'
b.list != a.list; // true
```

It support property descriptors

```javascript

var a = {
	get name(){
		return 'a';
	}
};
var b = clone(a);
b.name; // 'a'
```

It support circular references

```javascript
var a = {};
a.self = a;
var b = clone(a);

a.self; // a
b.self; // b
```
