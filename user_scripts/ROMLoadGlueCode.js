"use strict";
/*
 Copyright (C) 2012-2016 Grant Galitz

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
function attachBIOS(BIOS, saveAfter = true) {
    try {
        IodineGUI.Iodine.attachBIOS(new Uint8Array(BIOS));
    }
    catch (error) {
        IodineGUI.Iodine.attachBIOS(BIOS);
    }
    // Save BIOS in LocalStorage
    if (saveAfter) {
        try {
            setValue('BIOS_FILE', arrayToBase64(IodineGUI.Iodine.BIOS));
        }
        catch (error) {
            writeRedTemporaryText('Could not store bios : ' + error.message);
        }
    }
}
function attachROM(ROM, saveAfter = true) {
    try {
        IodineGUI.Iodine.attachROM(new Uint8Array(ROM));
    }
    catch (error) {
        IodineGUI.Iodine.attachROM(ROM);
    }

    // Save ROM in IndexedDB
    if (saveAfter) {
        // convert ArrayBuffer to base64 encoded string
        compressArrayBuffer(IodineGUI.Iodine.ROM).then(async (compressed) => {
            RomsRepository.addRom('LAST_ROM', compressed);
        });
    }
}
function fileLoadShimCode(files, ROMHandler) {
    if (typeof files != "undefined") {
        if (files.length >= 1) {
            let file = files[files.length - 1];
            //Gecko 1.9.2+ (Standard Method)
            try {
                var binaryHandle = new FileReader();
                binaryHandle.onloadend = function () {
                    ROMHandler(this.result);
                }
                binaryHandle.readAsArrayBuffer(file);
            }
            catch (error) {
                try {
                    var result = file.getAsBinary();
                    var resultConverted = [];
                    for (var index = 0; index < result.length; ++index) {
                        resultConverted[index] = result.charCodeAt(index) & 0xFF;
                    }
                    ROMHandler(resultConverted);
                }
                catch (error) {
                    alert("Could not load the processed ROM file!");
                }
            }
        }
    }
}
function fileLoadBIOS() {
    fileLoadShimCode(this.files, attachBIOS);
}
function fileLoadROM() {
    fileLoadShimCode(this.files, attachROM);
}
function downloadFile(fileName, registrationHandler) {
    var ajax = new XMLHttpRequest();
    ajax.onload = registrationHandler;
    ajax.open("GET", "./" + fileName, true);
    ajax.responseType = "arraybuffer";
    ajax.overrideMimeType("text/plain; charset=x-user-defined");
    ajax.send(null);
}
function processDownload(parentObj, attachHandler) {
    try {
        attachHandler(new Uint8Array(parentObj.response));
    }
    catch (error) {
        var data = parentObj.responseText;
        var length = data.length;
        var dataArray = [];
        for (var index = 0; index < length; index++) {
            dataArray[index] = data.charCodeAt(index) & 0xFF;
        }
        attachHandler(dataArray);
    }
}
async function compressArrayBuffer(input, algorithm = 'gzip') {
    const stream = new Response(input).body
        .pipeThrough(new CompressionStream(algorithm));
    return await new Response(stream).arrayBuffer();
}
async function decompressArrayBuffer(input, algorithm = 'gzip') {
    const decompressedStream = new Response(input).body
        .pipeThrough(new DecompressionStream(algorithm));
    return await new Response(decompressedStream).arrayBuffer()
}

async function uInt8ArrayToBase64Compressed(uInt8Array) {
    let compressed = await compressArrayBuffer(uInt8Array, 'gzip');
    return arrayToBase64(new Uint8Array(compressed));
}
async function base64CompressedToUInt8Array(base64Compressed) {
    let compressed = new Uint8Array(base64ToArray(base64Compressed));
    return new Uint8Array(await decompressArrayBuffer(compressed, 'gzip'));
}

// IndexedDB playground
const RomsRepository = function() {
    const indexedDB =
        window.indexedDB ||
        window.mozIndexedDB ||
        window.webkitIndexedDB ||
        window.msIndexedDB ||
        window.shimIndexedDB;
    if (!indexedDB) {
        console.log('IndexedDB could not be found in this browser.');
    }
    let db = null;
    let dbName = 'RomsDatabase';
    let dbVersion = 1;
    let storeName = 'roms';
    let request = indexedDB.open(dbName, dbVersion);
    request.onerror = function (event) {
        console.error('An error occurred with IndexedDB');
        console.error(event);
    };
    request.onupgradeneeded = function () {
        console.log('Database upgrade needed');
        const db = request.result;
        const store = db.createObjectStore(storeName);
    };
    request.onsuccess = function () {
        console.log('Database opened successfully');
        db = request.result;
        console.log(db);
    };
    function _addRom(name, file) {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put({file: file }, name);
    }
    function _getRom(name, callback) {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const romQuery = store.get(name);

        romQuery.onsuccess = function () {
            callback(romQuery.result.file);
        };
    }
    function addRom(name, file) {
        if (db != null) {
            _addRom(name, file);
        } else {
            request.addEventListener("success", (event) => {
                _addRom(name, file);
            });
        }
    }
    function getRom(name, callback) {
        if (db != null) {
            _getRom(name, callback);
        } else {
            request.addEventListener("success", (event) => {
                _getRom(name, callback);
            });
        }
    }
    return {
        addRom: addRom,
        getRom: getRom,
    }
}();
