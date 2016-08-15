## any

Helper to create any value with an immutable approach

## any.scan

```javascript
import any from 'env/any';

let user = {name: 'dam'};
let userDefinition = any.scan(user);
```

## any.factory

```javascript
import any from 'env/any';

let user = {name: 'dam', traits: ['old']};
let userFactory = any.factory(user);

let userA = userFactory.generate();

user.traits != userA.traits; // true
userA.traits[0]; // 'old'
```

## any.concat

```javascript
import any from 'env/any';

let user = {name: 'dam'};
let friendsProperty = {friends: []};
let userWithFriends = any.concat(user, friendsProperty);

userWithFriends.friends !== friendsProperty.friends; // true
```
