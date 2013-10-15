import os
from flask import Flask
from flask import Response
import praw
import psycopg2
from urllib import parse
from urllib import request
import json
import re

with open("password.txt") as f:
	r_pass = f.read()

r = praw.Reddit("BitTip")
r.login("BitTipCoins", r_pass)


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

app = Flask(__name__)

@app.route('/getaddress/<user>')
def hello(user):
	headers = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}

	if any(c.isspace() for c in user) or not name_regex.match(user):
		return Response('{"success": false, "error": "Username invalid"}', headers=headers)

	cur.execute("SELECT address FROM name_address WHERE name = %s;", (user,))
	row = cur.fetchone()

	if row is not None:
		return Response('{"success": true, "address": "' + row[0] + '"}', headers=headers)
	else:
		email = user+"+reddit@bittip.io"
		chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
		rand_pass = ''
		for i in range(15):
			rand_pass = rand_pass + chars[os.urandom(1)[0] % 64]

		req = request.Request("https://coinbase.com/api/v1/users", parse.urlencode({"user[email]": email, "user[password]": rand_pass}).encode('utf-8'), headers = {"User-Agent": "BitTip/1.0"})
		data = json.loads(request.urlopen(req).readall().decode())
		if data["success"]:
# TODO: Expire unclaimed address after 60 days?
			r.send_message("TheBlueMatt", "Someone sent you Bitcoins as a tip", "Another Reddit user sent you some Bitcoins as a tip using BitTip! To claim your Bitcoins, please go to https://coinbase.com and log in with the email " + email + " and the password " + rand_pass + ". Click the link to change your email and create an account, change your password and send your Bitcoins anywhere you want (or link your bank account and withdraw them directly for your local currency). Any future tips will go to that account automatically without any further PMs (so keep your password safe!)")
			cur.execute("INSERT INTO name_address (name, address) VALUES (%s, %s);", (user, data["receive_address"]))
			conn.commit()
			return Response('{"success": true, "address": "' + data["receive_address"] + '"}', headers=headers)
		else:
			# TODO: Email doesn't matter, so try again with another random email...
			return Response('{"success": false, "error": "User already existed but we dont know their address"}', headers=headers)
	return Response('{"success": false, "error": "Python broke"}', headers=headers)

if __name__ == '__main__':
	# Bind to PORT if defined, otherwise default to 5000.
	port = int(os.environ.get('PORT', 5000))
	app.run(host='0.0.0.0', port=port)
	cur.close()
	conn.close()
