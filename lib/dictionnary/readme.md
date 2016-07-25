# Dictionnary

A JavaScript version of a real dictionnary

## Example

```javascript
import Dictionnary from 'env/dictionnary';

let dict = Dictionnary.create();

dict.registerFilter('young', function(user) {
    return user.age < 25;
});

dict.append({
    "greetings": {
        "young": "hi",
        "": "hello"
    },
    "greetings-scope": "#{greetings} {name}"
});

dict.look('greeting'); // 'hello'
dict.look('greetings', {age: 20}); // 'hi'
dict.look('greetings-scope', {age: 20, name: 'dam'}); // 'hi dam'
```
