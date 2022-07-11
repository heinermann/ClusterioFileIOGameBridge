"use strict";
const fs = require('fs');
const path = require('node:path');

const libPlugin = require("@clusterio/lib/plugin");
const Tail = require("tail").Tail


class FileInterface {
    directory
    
    #plugin
    #sendfilename
    #recvfilename

    #sendfile
    #recvfile

    #numWritten

    #isWiping
    #messageQueue

    constructor(plugin, directory) {
        this.#plugin = plugin;
        this.directory = directory;
        
        this.#isWiping = false;
        this.#messageQueue = [];

        this.#sendfilename = path.join(directory, "to_instance.jsonl");
        this.#recvfilename = path.join(directory, "to_slave.jsonl");

        this.#createFiles('a');

        this.#recvfile = new Tail(this.#recvfilename);
        this.#recvfile.on("line", this.#onRecv);
        this.#recvfile.on("error", this.#onRecvError);
    }

    send(message) {
        this.sendMany([message]);
    }

    sendMany(messages) {
        if (this.#isWiping) {
            this.#messageQueue.push(...messages);
        }
        else {
            let textData = messages.map(JSON.stringify).join('\n');
            fs.appendFileSync(this.#sendfile, textData);
            this.#numWritten += messages.length;
    
            if (this.#numWritten >= this.#plugin.numMessagesBeforeWipe) {
                this.#wipe();
            }
        }
    }

    #onRecv(message) {
        // TODO: Try/catch for validity and retry logic (and fallback)
        message = JSON.parse(message);
        switch(message.type) {
            case "chat_event":
                this.#plugin.sendChat(message.data.content);
                break;
            case "ACKWIPE":
                // acknowledged wipe
                this.#dowipe();
                break;
        }
    }

    #onRecvError(error) {
        this.#plugin.logger.error(`Error occurred tailing "${this.#recvfilename}": ${error.message}\n ${error.stack}`);
    }

    #wipe() {
        this.#isWiping = true;
        this.send({ type: "WIPE" });
        this.#closeSend();
        // TODO: Timeout
    }

    #dowipe() {
        this.#closeRecv();
        this.#createFiles('w');
        this.#recvfile.watch();
        this.#isWiping = false;
        this.send({ type: "OK" });
        this.sendMany(this.#messageQueue);
    }

    #createFiles(mode) {
        this.#sendfile = fs.openSync(this.#sendfilename, mode);
        this.#numWritten = 0;

        fs.closeSync(fs.openSync(this.#recvfilename, mode));
    }
    
    #closeSend() {
        fs.closeSync(this.#sendfile);
    }

    #closeRecv() {
        this.#recvfile.unwatch();
    }

    close() {
        // TODO: Close gracefully...
        // TODO: Erase data when all up to speed
        this.#closeSend();
        this.#closeRecv();
    }
}

/**
 * FileIO Game Bridge instance plugin definition.
 */
class InstancePlugin extends libPlugin.BaseInstancePlugin {
    // Base: info, instance, slave, logger

    #interfaces

    async init() {
        // NOTE: Don't assume other plugins are loaded here
        
        this.#interfaces = new Map();

        this.slave.connector.on("message", this.#processMessage);
        this.logger.info("CALLED init");
    }

    async onStart() {
        // All plugins should be loaded here, this relies on a factorio instance though
        this.#updateDirectories();
        this.logger.info("CALLED onStart");
    }

    #removeInterfaces(items) {
        for (const dir of items) {
            let interface = this.#interfaces.get(dir);
            if (interface) interface.close();
            this.#interfaces.delete(dir);
        }
    }

    #createInterfaces(items) {
        for (const directory of items) {
            if (!this.#interfaces.has(directory)) {
                this.#interfaces.set(directory, new FileInterface(this, directory));
            }
        }
    }

    #updateDirectories() {
        let directories = this.interfaceDirectories.split(/[;:]/);
        let oldDirs = this.#interfaces.keys();

        let removals = oldDirs.filter(dir => !directories.includes(dir));
        let additions = directories.filter(dir => !oldDirs.includes(dir));
        
        this.#removeInterfaces(removals);
        this.#createInterfaces(additions);
    }

    async onInstanceConfigFieldChanged(group, field, prev) {
        if (group !== "fileio_game_bridge") return;

        switch (field) {
            case "interface_directories":
                this.#updateDirectories();
                break;
        }
    }
    
    onMasterConnectionEvent(event) {
        switch(event) {
            case "connect":
                this.logger.info("CALLED Master: connect");
                break;
            case "resume":
                this.logger.info("CALLED Master: resume");
                break;
            case "drop":
                this.logger.info("CALLED Master: drop");
                break;
            case "close":
                this.logger.info("CALLED Master: close");
                break;
        }
    }
    
    async onPrepareMasterDisconnect(connection) {

    }

    // I know this is hacky but I couldn't think of a better way to capture events from other plugins
    #processMessage(message) {
        try {
            switch (message.type) {
                case "chat_event":
                    this.recvChat(message);
                    break;
            }
        } catch (err) {
            // whatever, don't care
        }
    }

    /* ####################################################
     * Subspace Storage Implementation
     * ####################################################
     */

    /* ####################################################
     * Research Sync Implementation
     * ####################################################
     */

    /* ####################################################
     * Global Chat Implementation
     * ####################################################
     */
    sendChat(message) {
        if (!this.globalChat) return;
        this.globalChat.sendChat(message);
    }

    recvChat(message) {
        for (const interface of this.#interfaces.values()) {
            interface.send(message);
        }
    }

    /* ####################################################
     * Convenience properties for other plugin access
     * ####################################################
     */
    get subspaceStorage() { return this.instance.plugins.get("subspace_storage"); }
    get globalChat() { return this.instance.plugins.get("global_chat"); }
    get researchSync() { return this.instance.plugins.get("research_sync"); }

    /* ####################################################
     * Convenience properties for config access
     * ####################################################
     */
    get interfaceDirectories() { return this.instance.config.get("fileio_game_bridge.interface_directories"); }
    get logItemTransfers() { return this.instance.config.get("fileio_game_bridge.log_item_transfers"); }
    get numMessagesBeforeWipe() { return this.instance.config.get("fileio_game_bridge.num_messages_before_wipe"); }
}

module.exports = {
	InstancePlugin,
};
