// Add links to send tips
$("div.noncollapsed ul.flat-list").each(function() {
	//var user = $(this).parent().find("p.tagline a.author").text();
	var user = "TheBlueMatt";
	$(this).append("<li><a class='reddit_coinbase_give' href='javascript:'>give bitcoin</a></li>");
	$(this).click(function() {
		// The Coinbase access_token
		var coinbase_access_token = "";
		//TODO: Track its expiration instead of requesting a new one each time

		// The destination user's Bitcoin address
		var destination_address = "";

		var login_success_callback;
		var login_failure_callback;
		chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
			sendResponse({});
console.log(message);
			if (message.code_token == undefined)
				login_failure_callback("Please allow us to access your coinbase account");
			else {
console.log("3");
				$.ajax("https://coinbase.com/oauth/token", {
					type: "POST",
					data: {
						grant_type: "authorization_code",
						code: message.code_token,
						redirect_uri: "chrome-extension://jbbhpnomhffcdokijijihpgjlcfbcbik/oauth_response.html",
						client_id: "08f13b440b5980b907cb5ec9e7628cc9960deab3e326a3b91433f9641866bf29",
						client_secret: "016d0adf3cfeebab5f5bcd641e8641a67ac42f523d85d6415f1f2a7d39e38346"
					},
					success: function(response, textStatus, jqXHR) {
console.log("4");
						if (response.access_token != undefined && response.refresh_token != undefined) {
							coinbase_access_token = response.access_token;
							chrome.storage.local.set({'coinbase-refresh-token': response.refresh_token}, function() {});
							login_success_callback();
						} else {
							console.log("Error getting Coinbase auth token:");
							console.log(response);
							failure_callback("Unknown error getting Coinbase auth token");
						}
					},
					error: function(response, textStatus, jqXHR) {
						console.log("Error getting auth_token from Coinbase after OAUTH");
						console.log(response);
						login_failure_callback("Unknown error authenticating with Coinbase");
					},
					cache: false
				});
			}
		});

		// Opens up a Coinbase OAUTH window
		var coinbaseLogin = function(success_callback, failure_callback) {
console.log("5");
			login_success_callback = success_callback;
			login_failure_callback = failure_callback;
			window.showModalDialog("https://coinbase.com/oauth/authorize?response_type=code&client_id=08f13b440b5980b907cb5ec9e7628cc9960deab3e326a3b91433f9641866bf29&client_secret=016d0adf3cfeebab5f5bcd641e8641a67ac42f523d85d6415f1f2a7d39e38346&redirect_uri=chrome-extension://jbbhpnomhffcdokijijihpgjlcfbcbik/oauth_response.html&scope=send");
		};

		// TODO: This is broken somewhere
		var checkCoinbaseLogin = function(success_callback, failure_callback) {
			chrome.storage.local.get("coinbase-refresh-token", function(token) {
console.log("6");
				if (token != "undefined") {
console.log("7");
					$.ajax("https://coinbase.com/oauth/token", {
						type: "POST",
						data: {
							grant_type: "refresh_token",
							refresh_token: token,
							client_id: "08f13b440b5980b907cb5ec9e7628cc9960deab3e326a3b91433f9641866bf29",
							client_secret: "016d0adf3cfeebab5f5bcd641e8641a67ac42f523d85d6415f1f2a7d39e38346"
						},
						success: function(response, textStatus, jqXHR) {
console.log("8");
							$.ajax("https://coinbase.com/api/v1/users", {
								type: "GET",
								success: function(response, textStatus, jqXHR) {
console.log("9");
									if (response.access_token != undefined && response.refresh_token != undefined) {
										coinbase_access_token = response.access_token;
										chrome.storage.local.set({'coinbase-refresh-token': response.refresh_token}, function() {});
										success_callback();
									} else {
										console.log("Error refreshing Coinbase auth token:");
										console.log(response);
										failure_callback("Unknown error refreshing Coinbase auth token");
									}
								},
								error: function(response, textStatus, jqXHR) {
									failure_callback("Please login to Coinbase and try again");
								}
							});
						},
						error: function(response, textStatus, jqXHR) {
							failure_callback("Please login to Coinbase and try again");
						}
					});
				} else
					failure_callback("Please login to Coinbase and try again");
			});
		}

		// Sends money using Coinbase
		var sendMoney = function(success_callback, failure_callback) {
			$.ajax("https://coinbase.com/api/v1/transactions/send_money", {
				type: "POST",
				data: {
					access_token: coinbase_access_token,
					transaction: {
						to: destination_address,
						amount: "0.0001", //TODO
						notes: "Tip from a Reddit user"
					}
				},
				success: function(response, textStatus, jqXHR) {
					if (response.success == true)
						success_callback();
					else {
						console.log("Error sending money:");
						console.log(response);
						failure_callback("Error sending money"); // TODO (out of funds, etc)
					}
				},
				error: function(response, textStatus, jqXHR) {
					console.log("Error sending money:");
					console.log(response);
					failure_callback("Unknown error trying to send money");
				}
			});
		};

		// Gets a user's address (possibly having the server create a coinbase account and send a reddit pm)
		var getAddress = function(success_callback, failure_callback) {
			$.ajax("http://bittip.herokuapp.com/getaddress/" + user, {
				success: function(response, textStatus, jqXHR) {
					if (response.success == true) {
						destination_address = response.address;
						success_callback();
					} else {
						console.log("Error getting address for send:");
						console.log(response);
						failure_callback("Unknown error getting address for destination.");
					}
				},
				error: function(response, textStatus, jqXHR) {
					console.log("Failed to create new user for send:");
					console.log(response);
					failure_callback("Unknown error getting address for destination.");
				}
			});
		};

		// Now string it all together...
		var postAuth = function() {
			getAddress(function() {
					sendMoney(function() {
							alert("OMG, IT WORKED!!!11one");
						}, function(msg) {
							alert(msg);
					});
				}, function(msg) {
					// Failed to create user...
					alert(msg);
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
						alert(msg);
				});
		});
	});
});
