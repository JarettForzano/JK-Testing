import json
import sys

versionType = sys.argv[1]
print(versionType)
with open("package.json","r") as file:
    string = file.read()
    package = json.loads(string)
version = [int(x) for x in package["version"].split(".")]
if (versionType == "major"):
    package["version"] = f"{version[0]+1}.0.0"
elif (version[2] == "9"):
    package["version"] = f"{version[0]}.{version[1]+1}.0"
else:
    package["version"] = f"{version[0]}.{version[1]}.{version[2]+1}"
with open("package.json","w") as file:
    file.write(json.dumps(package))
