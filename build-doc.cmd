@echo off
if exist doc (
    del /S /Q doc & rd /S /Q doc
    echo Deleted your old jsdoc dir.
) else (
    echo You have no jsdoc dir. created yet.
)

echo Building jsdoc dir...
node_modules\.bin\jsdoc -p -c conf.json -t node_modules/ink-docstrap/template -r -R README.md