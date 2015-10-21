# system-platform

Run JavaScript accross platforms using systemjs

#### Run js from Sublime Text

You can run your JavaScript files directly from SublimeTest hitting Ctrl+B. 
Create a file at `C:/Users/Damien/AppData/Roaming/Sublime Text 3/Packages/User/system-plaftorm.sublime-build`.  
with the following content :

```json
{
	"cmd": ["C:\\Users\\Damien\\AppData\\Roaming\\npm\\system-platform.cmd", "$file"],
	"selector": "source.js"
}
```
