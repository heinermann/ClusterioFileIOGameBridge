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
        this.#recvfile.on("line", this.#onRecv.bind(this));
        this.#recvfile.on("error", this.#onRecvError.bind(this));
    }

    send(message) {
        this.sendMany([message]);
    }

    sendMany(messages) {
        if (this.#isWiping) {
            this.#messageQueue.push(...messages);
        }
        else {
            const textData = messages.map(JSON.stringify).join('\n');
            fs.appendFileSync(this.#sendfile, `${textData}\n`);
            this.#numWritten += messages.length;
    
            if (this.#numWritten >= this.#plugin.numMessagesBeforeWipe) {
                this.#wipe();
            }
        }
    }

    #onRecv(message) {
        // TODO: Try/catch for validity and retry logic (and fallback)
        const parsed = JSON.parse(message);
        switch(parsed.type) {
            case "chat_event":
                this.#plugin.sendChat(parsed.data.content);
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

        this.slave.connector.on("message", this.#processMessage.bind(this));
        this.logger.info("CALLED init");
    }

    async onStart() {
        // All plugins should be loaded here, this relies on a factorio instance though
        this.#updateDirectories();



        this.logger.info("CALLED onStart");
    }

    #removeInterfaces(items) {
        for (const dir of items) {
            const conn = this.#interfaces.get(dir);
            if (conn) conn.close();
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
        const directories = this.interfaceDirectories.split(/[;]/);
        const oldDirs = Array.from(this.#interfaces.keys());

        const removals = oldDirs.filter(dir => !directories.includes(dir));
        const additions = directories.filter(dir => !oldDirs.includes(dir));
        
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
        switch (message.type) {
            case "chat_event":
                this.recvChat(message);
                break;
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

    #wrapChatMessage(message) {
        return {
            type: "chat_event",
            data: {
                instance_name: this.instance.name,
                content: message,
            }
        }
    }

	async onOutput(output) {
		if (output.type === "action" && output.action === "CHAT") {
            this.recvChat(this.#wrapChatMessage(output.message));
		}
	}

    sendChat(message) {
        if (!this.globalChat) return;
        this.logger.info(`Sending chat msg: ${message}`);

        this.globalChat.sendChat(message);
        this.globalChat.chatEventHandler(this.#wrapChatMessage(message));
    }

    recvChat(message) {
        this.logger.info(`Received chat msg: ${JSON.stringify(message)}`);
        for (const conn of this.#interfaces.values()) {
            conn.send(message);
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
