var autosaveOnClick = false;

function saveOptions() {
	'use strict';
	
	if(!autosaveOnClick) return;
	
	var i = 0;
	// Get values from inputs
	var displayAmazonGoodreads = document.getElementById('displayAmazonGoodreads').checked

	// Set the options object
	var options = {};
	//Generate the keys for the icon
	options.displayAmazonGoodreads = displayAmazonGoodreads;

	chrome.storage.local.set(options, function() {
	});
}

function restoreOptions() {
	'use strict';
	// Set defaults for localStorage get error
	var options = {};
	options.displayAmazonGoodreads = false;
	// Get the items from localStorage
	chrome.storage.local.get(options, function(items) {
		document.getElementById('displayAmazonGoodreads').checked = items.displayAmazonGoodreads;
		autosaveOnClick = true;
	});
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('displayAmazonGoodreads').addEventListener('change', saveOptions);

