import json
import sys

versionType = sys.argv[1]
print(versionType)
with open("package.json","r") as file:
    string = file.read()
    package = json.loads(string)
version = [int(x) for x in package["version"].split(".")]
package["version"] = versionType

with open("package.json","w") as file:
    file.write(json.dumps(package))
