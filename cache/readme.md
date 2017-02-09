# cache/

This folder speed up things by caching many output such as polyfill builds or transpiled files.
Most cache folders and files are ignored by .gitignore because this is dynamic content.

## features.js

Cached transpiled version of features.js.
feature.js is transpiled because it uses template literals to be more readable.

## scan/

Contains a folder per user-agent.
Used to cache scan result.
This folder is not in .gitignore because it contains valuable data valid for any project.

## polyfill/

Contains a folder per set of sources used as polyfill.

## transpile/

Contains a folder per set of plugins used by the transpiler.

## fix/

Contains a folder per user-agent combined with the features detected as problematic.
It is used to cache fix result.
