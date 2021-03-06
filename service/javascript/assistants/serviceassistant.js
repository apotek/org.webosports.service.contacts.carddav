/* ServiceAssistant
* Description: This method handles the high level transport setup.
* This assistant is called before anything within the service.  This is useful to intercept the various endpoints and
* handle various tasks like key storage or customizations
*
* To run manually:
* run-js-service -d /media/cryptofs/apps/usr/palm/services/org.webosports.cdav.service/
*/
/*jslint node: true */
/*global Log, Class, searchAccountConfig, Transport, Sync, Future, Kinds, KindsCalendar, KindsContacts, KindsTasks, checkResult, lockCreateAssistant, servicePath, httpClient */
/*exported ServiceAssistant, OnCredentialsChanged*/

var iCal = require(servicePath + "/javascript/utils/iCal.js");
var vCard = require(servicePath + "/javascript/utils/vCard.js");
var AuthManager = require(servicePath + "/javascript/utils/AuthManager.js");
var KeyStore = require(servicePath + "/javascript/utils/KeyStore.js");
var Base64 = require(servicePath + "/javascript/utils/Base64.js");

var ServiceAssistant = Transport.ServiceAssistantBuilder({
    clientId: "",

    client: Class.create(Sync.AuthSyncClient, {

        kinds: {},

        setup: function setup(service, accountid, launchConfig, launchArgs) {
            "use strict";
            Log.log("\n\n**************************START SERVICEASSISTANT 0.3.19 *****************************");
            //for testing only - will expose credentials to log file if left open
            Log.debug("\n------------------->accountId: ", accountid);
            Log.debug("\n------------------->launchConfig: ", launchConfig);
            Log.debug("\n------------------->launchArgs: ", launchArgs);
            Log.log("Starting ", launchConfig.name, " for account ", launchArgs.accountId, " from activity ", launchArgs.$activity, " with capacity ", launchArgs.capability);

            //this seems necessary for super class constructor during checkCredentials calls.
            this.accountId = launchArgs.accountId || "";

            if (launchConfig.name.indexOf("Create") >= 0) {
                lockCreateAssistant(this.accountId, launchConfig.name);
            }

            if (!this.config) {
                this.config = {};
            }

            this.config.url = launchArgs.url || this.config.url;
            this.config.ignoreSSLCertificateErrors = launchArgs.ignoreSSLCertificateErrors || this.config.ignoreSSLCertificateErrors;

            //in onCreate call we will store config away in transport object. First store it in this, later on will be put into transport.
            if (launchArgs.config) {
                this.config.name =      launchArgs.config.name || this.config.name;
                this.config.url  =      launchArgs.config.url  || this.config.url;
                this.config.username =  launchArgs.config.username || launchArgs.username || this.config.username;
                this.config.accountId = this.accountId || this.config.accountId;
                this.config.ignoreSSLCertificateErrors = launchArgs.config.ignoreSSLCertificateErrors || this.config.ignoreSSLCertificateErrors;

                if (launchArgs.config.credentials) {
                    this.config.username = launchArgs.config.credentials.username || launchArgs.config.credentials.user || this.config.username;
                }
            }

            if (launchArgs.$activity && launchArgs.$activity.name && launchArgs.$activity.name.indexOf("SyncOnEdit") === 0) {
                Log.log("SyncOnEdit => run only this sync!");
                if (launchArgs.$activity.name.indexOf("contact") > 0) {
                    launchArgs.capability = "CONTACTS";
                } else if (launchArgs.$activity.name.indexOf("calendarevent") > 0) {
                    launchArgs.capability = "CALENDAR";
                }
            }

            if (launchConfig.name.indexOf("Calendar") >= 0 || launchArgs.capability === "CALENDAR") {
                Log.debug("Setting Kinds to Calendar.");
                this.kinds = KindsCalendar;
            } else if (launchConfig.name.indexOf("Contacts") >= 0 || launchArgs.capability === "CONTACTS") {
                Log.debug("Setting Kinds to Contacts");
                this.kinds = KindsContacts;
            } else if (launchConfig.name.indexOf("Tasks") >= 0 || launchArgs.capability === "TASKS") {
                Log.debug("Setting Kinds to Tasks");
                this.kinds = KindsTasks;
            } else {
                Log.debug("Setting general kinds...");
                this.kinds = Kinds;
            }

            var future = new Future();

            //get config object from db:
            if (this.accountId) {
                if (!this.config) {
                    this.config = {};
                }
                this.config.accountId = this.accountId;

                //search recursively, first by accountId, then account name then username.
                future.nest(searchAccountConfig(this.config));
            } else {
                Log.log("No accountId, continue execution without config lookup.");
                future.result = { returnValue: false };
            }

            //initialize iCal stuff.
            future.then(this, function () {
                var result = checkResult(future);
                if (result.returnValue === true) {
                    this.config = result.config;
                }

                if (this.config.ignoreSSLCertificateErrors && this.config.url) {
                    httpClient.setIgnoreSSLCertificateErrorsForHost(this.config.url, true);
                }

                future.nest(iCal.initialize());
            });

            future.then(this, function () {
                var result = checkResult(future);
                if (!result.iCal) {
                    Log.debug("iCal init not ok.");
                } else {
                    Log.debug("iCal initialized");
                }
                future.nest(vCard.initialize());
            });

            future.then(this, function () {
                var result = checkResult(future);
                if (!result.vCard) {
                    Log.debug("vCard init not ok.");
                } else {
                    Log.debug("vCard initialized");
                }
                future.result = { returnValue: true };
            });

            future.then(this, function getCredentials() {
                //these two endpoints don't require stored auth data (passed in as default)
                //onEnabled also did not supply creds.. hm. Will this cause problems?
                if (launchConfig.name === "checkCredentials") {
                    this.userAuth = launchArgs; //copy all.
                    this.userAuth.url = this.config.url;
                    future.result = {returnValue: true}; //do continue future execution
                } else if (launchConfig.name === "sync" || launchConfig.name === "discovery") {
                    Log.debug("Getting credentials.");
                    if (!this.accountId) {
                        throw "Need accountId for operation " + launchConfig.name;
                    }

                    future.nest(KeyStore.getKey(this.accountId));

                    future.then(this, function getKeyCB() {
                        var result = checkResult(future);
                        Log.log("------------->Got Key"); //, result);
                        this.userAuth = result.credentials;

                        future.nest(AuthManager.checkAuth(this.userAuth, this.config.url));
                    });

                    future.then(this, function checkAuthCB() {
                        var result = checkResult(future);
                        if (result.credentials) { //need to store changed credentials.
                            KeyStore.putKey(this.accountId, this.userAuth).then(this, function putOAuthCB(putKey) {
                                var result = checkResult(putKey);
                                Log.debug("------------->Saved OAuth Key", result.returnValue);
                                future.result = { returnValue: true }; //continue with future execution.
                            });
                        } else {
                            future.result = { returnValue: true };
                        }
                    });
                } else if (launchConfig.name.indexOf("Create") > 0 || launchConfig.name === "onCredentialsChanged") {
                    future.nest(KeyStore.checkKey(this.accountId));

                    future.then(this, function () {
                        var result = checkResult(future), username, password, authToken;
                        Log.debug("------------->Checked Key" + JSON.stringify(result));

                        if (result.value) {  //found key
                            Log.debug("------------->Existing Key Found, no need to store auth data.");
                            future.result = { returnValue: true }; //continue with future execution.
                        } else { //no key found - check for username / password and save
                            Log.debug("------------->No Key Found - Putting Key Data and storing globally");

                            //somehow this is VERY inconsistent!
                            username = launchArgs.username || launchArgs.user;
                            password = launchArgs.password;
                            if (launchArgs.config) {
                                username = launchArgs.config.user || username;
                                username = launchArgs.config.username || username;
                                password = launchArgs.config.password || password;
                            }

                            if (launchArgs.config && launchArgs.config.credentials) {
                                username = launchArgs.config.credentials.user || username;
                                username = launchArgs.config.credentials.username || username;
                                password = launchArgs.config.credentials.password || password;
                            }

                            if (username && password) {
                                authToken = "Basic " + Base64.encode(username + ":" + password);
                                this.userAuth = {"user": username, "password": password, "authToken": authToken};
                            } else if (launchArgs.config && launchArgs.config.credentials) {
                                Log.log("Saving oAuth2.0 credentials.");
                                this.userAuth = launchArgs.config.credentials;
                            } else {
                                Log.debug("---->No config, can't do anything.");
                                future.result = { returnValue: false }; //continue with future execution.
                            }

                            KeyStore.putKey(this.accountId, this.userAuth).then(this, function (putKey) {
                                var result = checkResult(putKey);
                                Log.debug("------------->Saved Key ", result.returnValue);
                                future.result = { returnValue: true }; //continue with future execution.
                            });
                        }
                    });
                } else { //most assistants do not need credentials, continue.
                    future.result = { returnValue: true };
                }
            });

            //preconfiguration of the service is complete...launch the sync engine
            future.then(this, function () {
                this.$super(setup)(service, this.accountId, undefined, Transport.HandlerFactoryBuilder(Sync.SyncHandler(this.kinds)));
                return true;
            });

            return future;
        },

        getSyncInterval: function () {
            "use strict";
            return new Future("20m");  //default sync interval
        },

        requiresInternet: function () {
            "use strict";
            return true;  //yes, we need internet to connect to Plaxo
        }
    })
});

//these endpoints are delegated to the sync framework to handle - use the serviceassistant code above to intercept
var OnCredentialsChanged = Sync.CredentialsChangedCommand;
