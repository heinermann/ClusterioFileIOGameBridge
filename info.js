"use strict";
const { libConfig } = require("@clusterio/lib");

class InstanceConfigGroup extends libConfig.PluginConfigGroup {}
InstanceConfigGroup.defaultAccess = ["master", "slave", "control"];
InstanceConfigGroup.groupName = "fileio_game_bridge";
InstanceConfigGroup.define({
	name: "interface_directories",
	title: "Interface Directories",
	description: "Semicolon separated list of File IO directories to interface with.",
	type: "string",
	initial_value: "",
});
InstanceConfigGroup.define({
	name: "log_item_transfers",
	title: "Log Item Transfers",
	description: "Spam slave console with item transfers done.",
	type: "boolean",
	initial_value: true,
});
InstanceConfigGroup.define({
	name: "num_messages_before_wipe",
	title: "Number of Messages Before Wiping",
	description: "The number of messages written to the file before requesting it be wiped clean.",
	type: "number",
	initial_value: 40000,
});

InstanceConfigGroup.finalize();

module.exports = {
	name: "fileio_game_bridge",
	title: "File IO Game Bridge",
	description:
		"Allows bridging of subspace storage and other plugins to various "+
		"other games using simplistic File IO streams.",
	instanceEntrypoint: "instance",
	InstanceConfigGroup,
};
