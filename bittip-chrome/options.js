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

$('#currency').on('change', function() {
	chrome.storage.sync.set({'default_currency': $('#currency').val()}, function() {});
});
chrome.storage.sync.get('default_currency', function(value) {
	if (value['default_currency'] != undefined)
		$('#' + value['default_currency']).attr('selected', true);
});

$('#comment').on('change', function() {
	chrome.storage.sync.set({'post_comment': $('#comment').is(':checked')}, function() {});
});
chrome.storage.sync.get('post_comment', function(value) {
	if (value['post_comment'] != undefined)
		$('#comment').prop('checked', value['post_comment']);
	else
		$('#comment').prop('checked', true);
});

$('#anonymous').on('change', function() {
	chrome.storage.sync.set({'anonymous_send': !$('#anonymous').is(':checked')}, function() {});
});
chrome.storage.sync.get('anonymous_send', function(value) {
	if (value['anonymous_send'] != undefined)
		$('#anonymous').prop('checked', !value['anonymous_send']);
	else
		$('#anomymous').prop('checked', true);
});
