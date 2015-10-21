# system-platform

Run JavaScript accross platforms using systemjs

### Run from Sublime Text

You can run your JavaScript files directly from SublimeTest hitting Ctrl+B.  
Create a file at `C:/Users/Damien/AppData/Roaming/Sublime Text 3/Packages/User/system-plaftorm.sublime-build`.  
Put the following content inside the created file

```json
{
	"cmd": ["system-platform", "$file"],
	"selector": "source.js"
}
```

Replace `system-platform` by the location of system-platform executable.

##### Getting `system-platform` executable location

platform | command
-------- | ----------
windows | `where system-platform`    
linux | `which system-platform`
