$('#amount').on('change', function() {
	var match = $('#amount').val().match(/[0-9]*(\.[0-9]*)+/g)
	if (match == null || match.length != 1 || match[0] != $('#amount').val()) {
		$('#amount').attr('style', 'background-color:#ff6666;');
	} else {
		$('#amount').attr('style', '');
		chrome.storage.sync.set({'default_value': $('#amount').val()}, function() {});
	}
});
chrome.storage.sync.get('default_value', function(value) {
	if (value['default_value'] != undefined)
		$('#amount').val(value['default_value']);
	else
		$('#amount').val('0.001');
});
