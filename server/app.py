import os
from flask import Flask, Response, request as flask_request
import praw
import psycopg2
from urllib import parse
from urllib import request
import json
import re

with open("password.txt") as f:
	r_pass = f.read()

r = praw.Reddit("BitTip")
print("Logging into Reddit...")
r.login("BitTipCoins", r_pass)
print("done")


parse.uses_netloc.append("postgres")
url = parse.urlparse(os.environ["DATABASE_URL"])
conn = psycopg2.connect(
	database=url.path[1:],
	user=url.username,
	password=url.password,
	host=url.hostname,
	port=url.port
)

cur = conn.cursor()
cur.execute("CREATE TABLE IF NOT EXISTS name_address (name varchar PRIMARY KEY, address varchar);")
conn.commit()

# Regex to match Reddit username to
name_regex = re.compile(r"\A[\w-]{3,20}\Z", re.UNICODE)

app = Flask(__name__, static_folder='static', static_url_path='')

@app.route('/')
def root():
	return app.send_static_file('index.html')

@app.route('/getaddress/<user>')
def hello(user):
	headers = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}

	if any(c.isspace() for c in user) or not name_regex.match(user):
		return Response('{"success": false, "error": "Username invalid"}', headers=headers)

	sender = flask_request.args.get('sender')
	if sender is None or any(c.isspace() for c in sender) or not name_regex.match(sender):
		sender = ""

	cur.execute("SELECT address FROM name_address WHERE name = %s;", (user,))
	row = cur.fetchone()

	if row is not None:
		return Response('{"success": true, "address": "' + row[0] + '"}', headers=headers)
	else:
		print("Creating token for Reddit user " + user)

		req = request.Request("https://coinbase.com/api/v1/tokens", ''.encode('utf-8'), headers = {"User-Agent": "BitTip/1.0"})
		data = json.loads(request.urlopen(req).readall().decode())
		if data["success"] and data["token"] and data["token"]["token_id"] and data["token"]["address"]:
			if sender is "":
				message = "An anonymous Reddit user"
			else:
				message = "Reddit user " + sender
			message = message + " just sent you some bitcoin as a tip using BitTip!\n\nTO CLAIM YOUR BITCOIN, GO TO  \nhttps://coinbase.com/claim/" + data["token"]["token_id"] + "\n\nOnce you've signed in, future tips will flow directly into your Coinbase account without additional notification.\n\nBitcoin is a decentralized digital currency that can be used all over the world (and converted to your local currency). To send your own tips to Reddit users, grab the Chrome extension at http://bittip.coinbase.com"
			r.send_message(user, "Someone sent you bitcoin using BitTip!", message)
			cur.execute("INSERT INTO name_address (name, address) VALUES (%s, %s);", (user, data["token"]["address"]))
			conn.commit()
			return Response('{"success": true, "address": "' + data["token"]["address"] + '"}', headers=headers)
		else:
			return Response('{"success": false, "error": "Invalid response from coinbase tokens API"}', headers=headers)
	return Response('{"success": false, "error": "Python broke"}', headers=headers)

if __name__ == '__main__':
	# Bind to PORT if defined, otherwise default to 5000.
	port = int(os.environ.get('PORT', 5000))
	app.run(host='0.0.0.0', port=port)
	cur.close()
	conn.close()
