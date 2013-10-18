// The Coinbase access_token
var coinbase_access_token = "";
//TODO: Track its expiration instead of requesting a new one each time

// Used as a unique id sometimes
var success_count = 0;

// Hook up a chrome message handler to get back messages when we finish OAUTH
var login_success_callback;
var login_failure_callback;
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	sendResponse({});
	if (message.code_token == undefined)
		login_failure_callback("error connecting to coinbase");
	else {
		$.ajax("https://coinbase.com/oauth/token", {
			type: "POST",
			data: {
				grant_type: "authorization_code",
				code: message.code_token,
				redirect_uri: chrome.extension.getURL("/oauth_response.html"),
				client_id: "08f13b440b5980b907cb5ec9e7628cc9960deab3e326a3b91433f9641866bf29",
				client_secret: "016d0adf3cfeebab5f5bcd641e8641a67ac42f523d85d6415f1f2a7d39e38346"
			},
			success: function(response, textStatus, jqXHR) {
				if (response.access_token != undefined && response.refresh_token != undefined) {
					coinbase_access_token = response.access_token;
					chrome.storage.local.set({'coinbase-refresh-token': response.refresh_token}, function() {});
					login_success_callback();
				} else {
					console.log("Error getting Coinbase auth token:");
					console.log(response);
					login_failure_callback("error connecting to coinbase");
				}
			},
			error: function(response, textStatus, jqXHR) {
				console.log("Error getting auth_token from Coinbase after OAUTH");
				console.log(response);
				login_failure_callback("error connecting to coinbase");
			},
			cache: false
		});
	}
});

var checkCoinbaseLogin = function(success_callback, failure_callback) {
	chrome.storage.local.get("coinbase-refresh-token", function(token) {
		if (token["coinbase-refresh-token"] != "undefined") {
			$.ajax("https://coinbase.com/oauth/token", {
				type: "POST",
				data: {
					grant_type: "refresh_token",
					refresh_token: token["coinbase-refresh-token"],
					client_id: "08f13b440b5980b907cb5ec9e7628cc9960deab3e326a3b91433f9641866bf29",
					client_secret: "016d0adf3cfeebab5f5bcd641e8641a67ac42f523d85d6415f1f2a7d39e38346"
				},
				success: function(response, textStatus, jqXHR) {
					if (response.access_token != undefined && response.refresh_token != undefined) {
						coinbase_access_token = response.access_token;
						chrome.storage.local.set({'coinbase-refresh-token': response.refresh_token}, function() {});
						success_callback();
					} else {
						console.log("Error getting Coinbase auth token:");
						console.log(response);
						failure_callback("not logged into coinbase");
					}
				},
				error: function(response, textStatus, jqXHR) {
					failure_callback("not logged into coinbase");
				}
			});
		} else
			failure_callback("not logged into coinbase");
	});
};

// Opens up a Coinbase OAUTH window
var coinbaseLogin = function(success_callback, failure_callback) {
	login_success_callback = success_callback;
	login_failure_callback = failure_callback;
	window.showModalDialog("https://coinbase.com/oauth/authorize?response_type=code&client_id=08f13b440b5980b907cb5ec9e7628cc9960deab3e326a3b91433f9641866bf29&client_secret=016d0adf3cfeebab5f5bcd641e8641a67ac42f523d85d6415f1f2a7d39e38346&scope=send&redirect_uri=" + chrome.extension.getURL("/oauth_response.html"));
};

//Responds to an arbitrary reddit object
var respondAfterTip = function(reddit_thing_id, amount) {
	$.ajax("http://www.reddit.com/api/me.json", {
		type: "GET",
		success:  function(response, textStatus, jqXHR) {
			// Yay unreadable nexted AJAX!
			$.ajax("http://www.reddit.com/api/comment", {
				type: "POST",
				data: {
					uh: response.data.modhash,
					api_type: "json",
					thing_id: reddit_thing_id,
					text: "I just sent you a tip of " + amount + " Bitcoin using [BitTip!](http://bittip.coinbase.com)"
				},
				success: function(response, textStatus, jqXHR) {},
				error: function(response, textStatus, jqXHR) {
					console.log("Failed to comment after tip:");
					console.log(response);
				}
			});
		},
		error: function(response, textStatus, jqXHR) {
			onsole.log("Failed to get reddit modhash to comment after tip:");
			console.log(response);
		},
		cache: false
	});
}

var reddit_logged_in_user = $('div#header-bottom-right .user a').text();
// Add links to send tips
var addLinks = function() {
	var user = $(this).parent().find("p.tagline a.author").text();
	if (user == "") {
		// In the case it is us (and we want to tip ourselves?)
		user = $(this).parent().find("p.tagline span.head b").text();
	}
	$(this).append('<li class="reddit_coinbase_li"></li>');

	var onGiveBitcoinClick = function() {};
	var liElement = $(this).find('.reddit_coinbase_li');

	// The amount to send
	var sendAmount = 0;
	// if (true) respond with a comment after tipping
	var postCommentOnSuccess;

	var onSend = function() {
		sendAmount = liElement.find('.reddit_coinbase_send_value').val();

		liElement.empty();
		liElement.append('<span class="reddit_coinbase_sending">sending ' + sendAmount + ' BTC<img style="width: 10px; height: 10px;" class="reddit_coinbase_spinner" src="' + chrome.extension.getURL('ajax-loader.gif') + '" /></span>');

		onGiveBitcoinClick();
	};

	var enableInput = function() {
		chrome.storage.sync.get("default_value", function(token) {
			if (token["default_value"] == undefined)
				token["default_value"] = "0.001";

			liElement.empty();
			liElement.append('<form action="javascript:" class="reddit_coinbase_send_form" style="font:normal x-small verdana,arial,helvetica,sans-serif">Send <input type="text" pattern="[0-9]*(\.[0-9]*)+" title="Enter a valid BTC amount." size="8" class="reddit_coinbase_send_value" style="font:normal x-small verdana,arial,helvetica,sans-serif" value="' + token["default_value"] + '"/> BTC&nbsp;&nbsp;<input type="checkbox" class="reddit_coinbase_send_comment">and respond to tell ' + user + ' that you tipped them <input type="submit" class="reddit_coinbase_send_submit" value="Go" style="font:normal x-small verdana,arial,helvetica,sans-serif" /></form>');
			liElement.find('.reddit_coinbase_send_form').on('submit', onSend);
			liElement.find('.reddit_coinbase_send_comment').on('change', function() {
				postCommentOnSuccess = liElement.find('.reddit_coinbase_send_comment').is(':checked');
				chrome.storage.sync.set({'post_comment': postCommentOnSuccess}, function() {});
			});
			chrome.storage.sync.get("post_comment", function(token) {
				if (token["post_comment"] == undefined)
					token["post_comment"] = false;
				postCommentOnSuccess = token["post_comment"];
				liElement.find('.reddit_coinbase_send_comment').prop('checked', postCommentOnSuccess);
			});
		});
	};

	var addLink = function() {
		liElement.empty();
		liElement.append('<a class="reddit_coinbase_link" href="javascript:">give bitcoin</a>');
		liElement.find('.reddit_coinbase_link').on('click', enableInput);
	};

	var sendFailed = function(msg) {
		addLink();
		liElement.prepend('<span class="reddit_coinbase_failed">' + msg + '...</span>');
		liElement.find('.reddit_coinbase_link').text('try again');
	}

	var sendSuccess = function(value) {
		addLink();
		var count = success_count++;
		liElement.prepend('<span id="reddit_coinbase_success_' + count + '">sent ' + value + ' BTC...</span>');
		liElement.find('.reddit_coinbase_link').text('send more');

		// TODO: why does injecting this with JQuery not work?
		var s = document.createElement('script');
		s.textContent = 'var elem = $("#reddit_coinbase_success_' + count + '"); console.log(elem);elem.addClass(elem.thing_id());';
		(document.head||document.documentElement).appendChild(s);
		s.parentNode.removeChild(s);

		if (postCommentOnSuccess)
			respondAfterTip($(liElement).find('#reddit_coinbase_success_' + count).attr('class'), sendAmount);
	}

	onGiveBitcoinClick = function() {
		// The destination user's Bitcoin address
		var destination_address = "";

		// Sends money using Coinbase
		var sendMoney = function(success_callback, failure_callback) {
			$.ajax("https://coinbase.com/api/v1/transactions/send_money", {
				type: "POST",
				data: {
					access_token: coinbase_access_token,
					transaction: {
						to: destination_address,
						amount: sendAmount,
						notes: "Tip from a Reddit user"
					}
				},
				success: function(response, textStatus, jqXHR) {
					if (response.success == true)
						success_callback();
					else if (response.errors[0].indexOf("You don't have that much") == 0) {
						failure_callback("not enough funds");
                    } else if (response.errors[0].indexOf("This transaction amount is below the current minimum amount to be accepted by the bitcoin network") == 0) {
						failure_callback("value too small to send until the recipient claims their tip");
                    } else if (response.errors[0].indexOf("This transaction requires a 0.0005 fee to be accepted by the bitcoin network") == 0) {
						failure_callback("value too small to send until the recipient claims their tip");
					} else {
						console.log("Error sending money:");
						console.log(response);
						failure_callback("unknown error sending");
					}
				},
				error: function(response, textStatus, jqXHR) {
					console.log("Error sending money:");
					console.log(response);
					failure_callback("unknown error sending");
				}
			});
		};

		// Gets a user's address (possibly having the server create a coinbase account and send a reddit pm)
		var getAddress = function(success_callback, failure_callback) {
			var url = "http://bittip.herokuapp.com/getaddress/" + user;
			if (liElement.find('.reddit_coinbase_send_comment').is(':checked'))
				url += "?sender=" + reddit_logged_in_user;

			$.ajax(url, {
				success: function(response, textStatus, jqXHR) {
					if (response.success == true) {
						destination_address = response.address;
						success_callback();
					} else {
						console.log("Error getting address for send:");
						console.log(response);
						failure_callback("unknown error sending");
					}
				},
				error: function(response, textStatus, jqXHR) {
					console.log("Failed to get address for send::");
					console.log(response);
					failure_callback("unknown error sending");
				}
			});
		};

		// Now string it all together...
		var postAuth = function() {
			getAddress(function() {
					sendMoney(function() {
							sendSuccess(sendAmount);
						}, function(msg) {
							// Failed to send (not enough funds, etc)
							sendFailed(msg);
					});
				}, function(msg) {
					// Failed to create user...
					sendFailed(msg);
			});
		}

		checkCoinbaseLogin(function() {
				// Already logged in...
				postAuth();
			}, function(msg) {
				// Not authed, lets try to log in...
				coinbaseLogin(function() {
						// Authed now...
						postAuth();
					}, function(msg) {
						// Failed to get user to login to their Coinbase acct...
						sendFailed(msg);
				});
		})
	};

	// Now add the link and enable the whole thing
	addLink();
};

//$("div.noncollapsed ul.flat-list").each(addLinks);
$("div.entry ul.flat-list").each(addLinks);
