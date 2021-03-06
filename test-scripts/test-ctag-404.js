/*global require, console, global, Future */

var fs = require("fs");
var path = fs.realpathSync(".");
global.servicePath = path + "/../service";
global.checkResult = require("./../service/javascript/utils/checkResult");
global.Log = require("./../service/javascript/utils/Log.js");
global.Future = require("./foundations/Future");
var CalDav = require("./../service/javascript/utils/CalDav.js");

global.Log.setFilename("test-ctag-404.txt");

global.httpClient = require("./mock.js").httpClient;
global.httpClient.filename = "test-ctag-404.xml";

var future = CalDav.checkForChanges({userAuth: {}, path: "/"});

future.then(function () {
    "use strict";
    console.log("CheckForChanges result: ", future.result);
});
