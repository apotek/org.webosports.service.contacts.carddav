/*jslint sloppy: true */
/*global enyo, $L, console, setTimeout, PalmSystem */

function log(msg) {
    console.error(msg);
}

function debug(msg) {
    console.error(msg);
}

enyo.kind({
    name: "Main.CDavApp",
    width: "100%",
    kind: "VFlexBox",
    className: "enyo-bg",
    components: [
        { name: "discovery", kind: "PalmService", service: "palm://org.webosports.cdav.service/",
            method: "discovery", onSuccess: "cdavOK", onFailure: "cdavFailed" },
        { name: "sync", kind: "PalmService", service: "palm://org.webosports.cdav.service/",
            method: "sync", onSuccess: "cdavOK", onFailure: "cdavFailed" },
        { name: "triggerSlowSync", kind: "PalmService", service: "palm://org.webosports.cdav.service/",
            method: "triggerSlowSync", onSuccess: "cdavOK", onFailure: "cdavFailed" },
        { name: "dbAccounts", kind: "DbService", dbKind: "org.webosports.cdav.account.config:1", onFailure: "cdavFailed", components: [
            { name: "findAccounts", method: "find", onSuccess: "refreshAccounts" }
        ]},
        { kind: "PageHeader", content: "C+Dav Application", pack: "center" },
        { kind: "Scroller", flex: 1, style: "margin:30px;", components: [
            { name: "alert", style: "margin-bottom:30px;text-align:center; background-color:red; color:yellow;" },
            { name: "success", style: "margin-bottom:30px;text-align:center; background-color:green; color:yellow;" },
            { kind: "RowGroup", caption: "Connection settings", components: [
                { kind: "Picker", label: "Account: "},
                { kind: "Button", tabIndex: "1",  caption: "Trigger Slow Sync", onclick: "doTriggerSlowSync", className: "enyo-button-dark" },
                { kind: "Button", tabIndex: "2",  caption: "Do Auto Discovery", onclick: "doDiscovery", className: "enyo-button-dark" },
                { kind: "Button", tabIndex: "3",  caption: "Start Sync", onclick: "doSync", className: "enyo-button-dark" }
            ]}
        ]},
        {className: "accounts-footer-shadow", tabIndex: -1}
    ],
    create: function () {
        this.inherited(arguments);

        this.$.findAccounts.call({query: {from: "org.webosports.cdav.account.config:1"}});
    },
    refreshAccounts: function (inSender, inResponse) {
        debug("Response from db: " + JSON.stringify(inResponse));

        this.accounts = inResponse.results;
        var i, items = [];
        for (i = 0; i < this.accounts.length; i += 1) {
            items.push({caption: this.accounts[i].name, value: this.accounts[i].accountId});
        }
        this.$.picker.setItems(items);
        this.$.picker.setValue(items[0].value);
        this.$.picker.render();
    },
    showError: function (msg) {
        debug("Error: " + msg);
        this.$.success.setContent("");
        this.$.alert.setContent(msg);
    },
    showSuccess: function (msg) {
        debug("Success: " + msg);
        this.$.alert.setContent("");
        this.$.success.setContent(msg);
    },
    doTriggerSlowSync: function () {
        var accountId = this.$.picker.getValue();

        debug("AccountId: " + JSON.stringify(accountId));
        if (accountId) {
            enyo.scrim.show();
            this.showError("");
            debug("Starting call...");
            this.$.triggerSlowSync.call({
                accountId: accountId
            });
            debug("... done... ");
        }
    },
    doDiscovery: function () {
        var accountId = this.$.picker.getValue();

        if (accountId) {
            enyo.scrim.show();
            this.showError("");
            this.$.discovery.call({
                accountId: accountId
            });
        }
    },
    doSync: function () {
        var accountId = this.$.picker.getValue();

        if (accountId) {
            enyo.scrim.show();
            this.showError("");
            this.$.sync.call({
                accountId: accountId
            });
        }
    },
    cdavOK: function (inSender, inResponse) {
        enyo.scrim.hide();

        debug("Success Response: " + JSON.stringify(inResponse));
        this.showSuccess("Method success: " + JSON.stringify(inResponse));
    },
    cdavFailed: function (inSender, inResponse) {
        enyo.scrim.hide();

        debug("Error Response: " + JSON.stringify(inResponse));
        this.showError("Method failure: " + JSON.stringify(inResponse));
    }
});
