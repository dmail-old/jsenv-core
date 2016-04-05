## Timeout

Every test will fail after a default timeout of 100ms. This section explains how to deal with this.

#### Test timeout

By default the thenable returned by your test function must settle in less than 100ms.
The following example shows how you to use a thenable with a custom timeout

```javascript
export function suite(add){
  add("testing timeout", function(test){
    var promiseResolvedIn200ms = new Promise(function(res){ setTimeout(res, 200); });
    test.timeout.set(500);
    return promiseResolvedIn200ms;
  });
}
```

#### Assertion timeout

When you make an assertion the default timeout of the test is disabled in favor of the assertion timeout.

```javascript
export function suite(add){
  add("testing assertion timeout precedence", function(){
    var promiseResolvedIn200ms = new Promise(function(res){ setTimeout(res, 200); });
    var willResolveAssertion = test.willResolve(promiseResolvedIn200ms);
    willResolveAssertion.timeout.set(250); // let 250ms for willResolveAssertion to settle
    return willResolveAssertion;
  });
}
```