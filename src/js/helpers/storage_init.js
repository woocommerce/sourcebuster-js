var storageModule = null;

module.exports = {
	set: function(module) {
		storageModule = module;
	},
	get: function() {
		return storageModule;
	}
};
