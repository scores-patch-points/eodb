Vendored, never edited: the portable modules of the pharos repository (scores-patch-points/pharos-prepublic), copied from its commit named below.
Their sha256 hashes are in VENDOR.sha256 and checked by app/test/vendor.test.mjs: a mismatch means a file was edited or the copy is out of date.
To update: copy the files from a newer pharos commit, regenerate VENDOR.sha256 (cd app/vendor/pharos && shasum -a 256 *.mjs cells.json > ../VENDOR.sha256), and change the commit below.
pharos commit: bdba96aef1ce55254be2aeafb3f464d8bc4bc596
