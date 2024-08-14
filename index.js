/* ========================================================================== *
 * Copyright (C) 2024 HCL America Inc.                                        *
 * All rights reserved.                                                       *
 * Licensed under Apache 2 License.                                           *
 * ========================================================================== */
const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const url = process.env.INPUT_DEPLOYURL;
const user = process.env.INPUT_USERNAME;
const password = process.env.INPUT_PASSWORD;
const inputFileDirectory = process.env.INPUT_INPUTFILEDIRECTORY;

const inputFile = path.join(inputFileDirectory, 'myData.json');

const command = createCommand(inputFile);

if (!command) {
    console.error("Failed to create the command. Exiting.");
    process.exit(1);
}

const processArgs = command.split(' ');

const process = spawn(processArgs[0], processArgs.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });

const rl = readline.createInterface({
    input: process.stdout,
    output: process.stdin,
    terminal: false
});

process.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
});

rl.on('line', (line) => {
    console.log(line);
    if (line.includes('password:')) {
        process.stdin.write(password + '\n');
    }
});

process.on('close', (code) => {
    if (code !== 0) {
        console.error(`Process exited with code ${code}`);
    }
});

function createCommand(inputFilePath) {
    let command = '';
    try {
        const data = fs.readFileSync(inputFilePath, 'utf8');
        const jsonObject = JSON.parse(data);

        if (jsonObject.processType === "generic") {
            command = `./artifacts/pacc-0.1.0.9999999-SNAPSHOT/upload-generic-process ${user} ${password} ${url} ${jsonObject.processName} ${jsonObject.processVersion} ${inputFile}`;
        } else if (jsonObject.processType === 'application') {
            command = `./artifacts/pacc-0.1.0.9999999-SNAPSHOT/upload-application-process ${user} ${password} ${url} ${jsonObject.processName} ${jsonObject.parent} ${inputFile}`;
        } else if (jsonObject.processType === 'component') {
            command = `./artifacts/pacc-0.1.0.9999999-SNAPSHOT/upload-component-process ${user} ${password} ${url} ${jsonObject.processName} ${jsonObject.parent} ${inputFile}`;
        } else {
            throw new Error(`Unknown processType: ${jsonObject.processType}`);
        }

        return command;
    } catch (err) {
        console.error(`Error reading or parsing ${inputFilePath}:`, err);
        return null;
    }
}
