## Advanced documentation

- Every test function is wrapped in a promise, the resolution/rejection of this promise reflects the passed/failed state of the test.

## Test state

failed : An assertion has failed
errored : Loading and executing the test has generated an unexpected error

## Running test in parallel requirements

The first failed test prevent next tests from being executed.  
Next version will let next test being executed when it's an assertion error.  
Other errors will still prevent next tests execution because they are unexpected but it's discutable.  
It's just about commenting [this line](https://github.com/dmail/system-test/blob/aec97df11272fa082d635813e5eb7146e0a0b1ad/lib/run.js#L101).

Test are currently runned in serie, running them in parallel has more requiremens if we want to prevent other tests from being executed.
When a test must prevent execution of others tests in a parellel module we need : 
- Assertion.cancel() (requires that every async assertion provide a cancel method too)
- Test.cancel() (already available as test.abort(), must trigger Assertion.cancel on running assertion)
- TestSuite.cancel() (must trigger test.cancel on running tests)
- Report.cancel() (must trigger suite.cancel on running assertion)
The Task object I'm working on is perfect for this case but it's for later.  

Moreover preventing other tests execution is maybe not wanted the final version could run everything in parallel, collecting errors and generate a report.
