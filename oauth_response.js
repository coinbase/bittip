chrome.tabs.query({}, function(tabs) {
	// We send a message to every tab...
	// This looks evil, but the only things that could intercept a message are other extensions,
	// and they can intercept just about anything, so we are hopeless trying to defend from them
	for(var i = 0; i < tabs.length; i++)
		chrome.tabs.sendMessage(tabs[i].id,
			{code_token: window.location.search.split("=").slice(1).join("=")},
			// If we don't wait for a response before closing, chrome loses the messages...
			function(response) {
				window.open('', '_self','');
				window.close();
			});
});
