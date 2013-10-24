// The Coinbase access_token
var coinbase_access_token = "";
//TODO: Track its expiration instead of requesting a new one each time

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
				// Ideally we would keep the client_secret secret, however there are essentially no threats that aren't easily addressed with this public.
				// The reason for keeping this secret is so that if a malicious person were to clone the reddit tipbot (or any Coinbase app) and steal user's money, Coinbase could immediately blacklist the client_id making the calls and break the app.
				// Though the possibility that such an attacker could use the real app's secret slows that a bit, it is still possible to push a new client_id/_secret to the real app and disable the old one.
				// Sadly, for any motivated attacker, there is no way to prevent this (especially in Chrome, where we can easily see all the requests being made, including their headers, by simply pulling up the developer tools)
				// (well...unless we were to do a native app and require TXT and a TPM-measured environment.......)
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

var reddit_logged_in_user = $('div#header-bottom-right .user a').text();
// Add links to send tips
var addLinks = function() {
	var user = $(this).parent().find("p.tagline a.author").text();
	if (user == "" || user == $('div#header-bottom-right span.user a').text()) {
		// In the case it is us
		return;
	}
	$(this).append('<li class="reddit_coinbase_li"></li>');

	var onGiveBitcoinClick = function() {};
	var liElement = $(this).find('.reddit_coinbase_li');

	// The amount to send
	var sendAmount = 0;
	var sendCurrency = 'BTC';

	var onSend = function() {
		sendAmount = liElement.find('.reddit_coinbase_send_value').val();
		sendCurrency = liElement.find('.reddit_coinbase_send_currency').val();

		liElement.empty();
		liElement.append('<span class="reddit_coinbase_sending">sending ' + sendAmount + ' ' + sendCurrency + '<img style="width: 10px; height: 10px;" class="reddit_coinbase_spinner" src="' + chrome.extension.getURL('ajax-loader.gif') + '" /></span>');

		onGiveBitcoinClick();
	};

	var enableInput = function() {
		chrome.storage.sync.get("default_value", function(token) {
			if (token["default_value"] == undefined)
				token["default_value"] = "0.001";

			chrome.storage.sync.get("default_currency", function(currency) {
				if (currency["default_currency"] == undefined)
					currency["default_currency"] = "BTC";

				liElement.empty();
				liElement.append('<form action="javascript:" class="reddit_coinbase_send_form" style="font:normal x-small verdana,arial,helvetica,sans-serif">Send <input type="text" pattern="[0-9]*(\.[0-9]*)+" title="Enter a valid BTC amount." size="8" class="reddit_coinbase_send_value" style="font:normal x-small verdana,arial,helvetica,sans-serif" value="' + token["default_value"] + '"/> <select class="reddit_coinbase_send_currency"><option value="BTC" class="reddit_coinbase_send_BTC">BTC</option><option value="USD" class="reddit_coinbase_send_USD">USD</option><option value="EUR" class="reddit_coinbase_send_EUR">EUR</option></select> <input type="submit" class="reddit_coinbase_send_submit" value="Go" style="font:normal x-small verdana,arial,helvetica,sans-serif" /></form>');
				liElement.find('.reddit_coinbase_send_form').on('submit', onSend);
				liElement.find('.reddit_coinbase_send_' + currency["default_currency"]).attr("selected", true);
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

	var sendSuccess = function() {
		addLink();
		liElement.prepend('<span>sent ' + sendAmount + ' ' + sendCurrency + '...</span>');
		liElement.find('.reddit_coinbase_link').text('send more');

		chrome.storage.sync.get("post_comment", function(token) {
			if (token["post_comment"] == undefined)
				token["post_comment"] = true;

			if (token["post_comment"]) {
				liElement.parent().find('a:contains("reply")').get(0).click();
				liElement.parent().parent().parent().parent().find('div.child textarea').val("I just sent you a tip of " + sendAmount + " " + sendCurrency + " using [BitTip!](http://bittip.coinbase.com)");
			}
		});
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
						amount_string: sendAmount,
						amount_currency_iso: sendCurrency,
						notes: "Tip from a Reddit user"
					}
				},
				success: function(response, textStatus, jqXHR) {
					if (response.success == true)
						success_callback();
					else if (response.errors[0].indexOf("You don't have that much") == 0) {
						failure_callback("not enough funds");
                    } else if (response.errors[0].indexOf("This transaction amount is below the current minimum amount to be accepted by the bitcoin network") == 0) {
						failure_callback("value too small to send until the recipient claims their first tip");
                    } else if (response.errors[0].indexOf("This transaction requires a 0.0005 fee to be accepted by the bitcoin network") == 0) {
						failure_callback("value too small to send until the recipient claims their first tip");
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
			chrome.storage.sync.get("anonymous_send", function(token) {
				if (token["anonymous_send"] == undefined)
					token["anonymous_send"] = false;

				var url = "http://bittip.herokuapp.com/getaddress/" + user;
				if (!token["anonymous_send"])
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
			});
		};

		// Now string it all together...
		var postAuth = function() {
			getAddress(function() {
					sendMoney(function() {
							sendSuccess();
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
