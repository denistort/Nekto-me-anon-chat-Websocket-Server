const express = require('express')
const cors = require('cors')
const events = require('events')
const bodyParser = require('body-parser')
const { MESSAGE_EVENTS } = require('./types')
const emmiter = new events.EventEmitter();
const PORT = 5000;
const app = express();

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.get('/connect', (req, res, next) => {
	res.writeHead(200, {
		'Connection': 'keep-alive',
		'Content-type': 'text/event-stream',
		'Cache-control': 'no-cache',
	})
	emmiter.on(MESSAGE_EVENTS.NEW_MESSAGE, (message) => {
		res.write(`data: ${JSON.stringify(message)} \n\n`)
	})
});

app.post('/new-message', (req, res, next) => {
	const message = req.body;
	console.log(message)
	emmiter.emit(MESSAGE_EVENTS.NEW_MESSAGE, message);
	res.status(200);
});

const start = () => {

	// midllewares.forEach(midlleware => app.use(midlleware()));
	app.listen(PORT, () => console.log(`STARTED ON ${PORT}`));
}
start();
