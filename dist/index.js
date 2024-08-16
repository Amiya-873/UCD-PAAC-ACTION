/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 81:
/***/ ((module) => {

"use strict";
module.exports = require("child_process");

/***/ }),

/***/ 147:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 17:
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),

/***/ 521:
/***/ ((module) => {

"use strict";
module.exports = require("readline");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/* ========================================================================== *
 * Copyright (C) 2024 HCL America Inc.                                        *
 * All rights reserved.                                                       *
 * Licensed under Apache 2 License.                                           *
 * ========================================================================== */
const { spawn } = __nccwpck_require__(81);
const readline = __nccwpck_require__(521);
const fs = __nccwpck_require__(147);
const path = __nccwpck_require__(17);

var url = process.env.INPUT_DEPLOYURL;
var user = process.env.INPUT_USERNAME;
var password = process.env.INPUT_PASSWORD;
var inputFileDirectory = process.env.INPUT_INPUTFILEDIRECTORY;
var inputFile = path.join(inputFileDirectory, 'myData.json');

var command = createCommand(inputFile);

if (!command) {
    console.error("Failed to create the command. Exiting.");
    process.exit(1);
}


var processArgs = command.split(' ');

var runpProcess = spawn(processArgs[0], processArgs.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });

var rl = readline.createInterface({
    input: runpProcess.stdout,
    output: runpProcess.stdin,
    terminal: false
});

runpProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
    if (data.toString().includes('password:')) {
        runProcess.stdin.write(password + '\n');
    }
});

setTimeout(() => {
    rl.on('line', (line) => {
        console.log(line);
        // If the password prompt appears in stdout, provide the password
        if (line.includes('password:')) {
            runProcess.stdin.write(password + '\n');
        }
    });
}, 5000);

runpProcess.on('close', (code) => {
    if (code !== 0) {
        console.error(`Process exited with code ${code}`);
    }
});

function createCommand(inputFilePath) {
    var command = '';
    try {
        var data = fs.readFileSync(inputFilePath, 'utf8');
        var jsonObject = JSON.parse(data);

        if (jsonObject.processType === "generic") {
            command = `./ucd-paac-action/artifacts/pacc-0.1.0.9999999-SNAPSHOT/upload-generic-process ${user} ${password} ${url} ${jsonObject.processName} ${jsonObject.processVersion} ${inputFile}`;
        } else if (jsonObject.processType === 'application') {
            command = `./ucd-paac-action/artifacts/pacc-0.1.0.9999999-SNAPSHOT/upload-application-process ${user} ${password} ${url} ${jsonObject.processName} ${jsonObject.parent} ${inputFile}`;
        } else if (jsonObject.processType === 'component') {
            command = `./ucd-paac-action/artifacts/pacc-0.1.0.9999999-SNAPSHOT/upload-component-process ${user} ${password} ${url} ${jsonObject.processName} ${jsonObject.parent} ${inputFile}`;
        } else {
            throw new Error(`Unknown processType: ${jsonObject.processType}`);
        }

        return command;
    } catch (err) {
        console.error(`Error reading or parsing ${inputFilePath}:`, err);
        return null;
    }
}

})();

module.exports = __webpack_exports__;
/******/ })()
;