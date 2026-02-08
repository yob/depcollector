This is a native typescript project that will be published to npmjs.com as a public package.

It includes an executable script that when run, examines the package.json and package-lock.json files
in the current directory and for each dependecny determins:

* name
* current version
* current version release date
* latest version
* latest version release date

Additionally, it collects the current time, the current git sha of HEAD, and the timestamp of HEAD.

This data is printed to stdout as JSON. The user can do whatever they like with it, but the initial
use case will be to upload it to an S3 bucket

