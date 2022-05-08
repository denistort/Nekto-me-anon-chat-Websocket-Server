const ws = require('ws')
const { v4: uuidv4 } = require('uuid');

const PORT = 2288


const Events = Object.freeze({
	Connection: 'connection',
	Message: 'message',
	Typing: 'typing',
	Stop_typing: 'stop-typing',
	Disconnect: 'disconnect',
	Close: 'close',
	MessageReaded: 'message-readed',
	Searching: 'searching',
	Cancel_searching: 'cancel-searching',
	Found_User: 'found-user',
	СonversationIsOver: 'conversation-is-over'
})


const wsServer = new ws.Server({
	port: PORT,
}, () => console.log(`Server started on ${PORT}`));

let ONLINE_USERS = {};
let LIST_OF_SEARCHING_USERS = {};
let ROOMS = {};

wsServer.on(Events.Connection, (socket, req) => {
	socket.uuid = uuidv4();
	socket.on(Events.Message, (message) => {
		message = JSON.parse(message)
		const ip = req.socket.remoteAddress;
		console.log(ip);
		// console.log(req.socket)
		switch(message.event) {
			case Events.Message:
				ROOMS[socket.roomId] = [{ ...message, isReaded: false }, ...ROOMS[socket.roomId]];
				broadCastConversationMessage({...message, isReaded: false })
				break;
			case Events.Connection:
				ConnectionHandler(message, socket)
				break;
			case Events.Searching: 
				const {uuid, data} = message;
				if(uuid in LIST_OF_SEARCHING_USERS) console.log(uuid)
				LIST_OF_SEARCHING_USERS[uuid] = { uuid: uuid, searchData: data}
				const {status, firstUser, secondsUser} = searchingUsers(message);
				if(status === 'succes') {
					delete LIST_OF_SEARCHING_USERS[firstUser];
					delete LIST_OF_SEARCHING_USERS[secondsUser];
					const roomId = uuidv4();
					ROOMS[roomId] = [];
					sendMessageToFoundedPair(
						{ firstUserUuid: firstUser, 
							secondUserUuid: secondsUser, 
							message: { event: Events.Found_User, status: 'succes', roomId: roomId }}
							)
				}
				break;
			case Events.СonversationIsOver:
				// {
				// 	event: Events.СonversationIsOver,
				// 	uuid: wqeqweqweqw,
				// 	roomId: qwetiertuoei239424523
				// }
				delete ROOMS[message.roomId];
				broadCastConversationMessage(message)
				break;
			case Events.Typing:
				TypingHandler(message)
				break;
			case Events.Stop_typing:
				StopTypingHandler(message)
				break;
			case Events.MessageReaded:
				messageReaded(message)
				break;
			case Events.Cancel_searching:
				cancelSearching(message, socket)
				break;
		}
	})

	socket.on('close', () => { 	
		delete ONLINE_USERS[socket.uuid]
		delete LIST_OF_SEARCHING_USERS[socket.uuid]
		socket.conversation = [];
		const overconversationMessage = {
			event: Events.СonversationIsOver,
			uuid: socket.uuid,
			roomId: socket.roomId
		}
		broadCastConversationMessage(overconversationMessage)
		const msg = {
			user: socket.uuid,
			event: Events.Close,
			amount_of_online_users: Object.keys(ONLINE_USERS).length,
			amount_of_searching_users: Object.keys(LIST_OF_SEARCHING_USERS).length
		}
		broadCastMessage(msg) 
	})
})

const searchingUsers = (message) => {
	const { data, uuid } = message;

	const keys = Object.keys(LIST_OF_SEARCHING_USERS);

	for (let index = 0; index < keys.length; index++) {
		const uuidFromArr = keys[index];
		const user = LIST_OF_SEARCHING_USERS[uuidFromArr]
		if(uuidFromArr === uuid) continue
		if(data.yourGender !== user.searchData.interlocutorGender && user.searchData.yourGender !== data.interlocutorGender) continue
		if(data.topic !== user.searchData.topic) continue
		if(!user.searchData.interlocutorAge.includes(data.yourAge) && !data.interlocutorAge.includes(user.yourAge)) continue

		return { status: 'succes', firstUser: uuidFromArr, secondsUser: uuid }
	}

	return { status: 'not found' }
}
const broadCastMessage = (message) => {
	wsServer.clients.forEach(client => {
		client.send(JSON.stringify(message))
	})
}
const broadCastConversationMessage = (message) => {
	wsServer.clients.forEach(client => {
		if(client.roomId === message.roomId) {
			client.send(JSON.stringify(message))
		}
	})
}

const broadCastToUserMessage = ({ message, toUserUUID }) => {
	wsServer.clients.forEach(client => {
		if(client.uuid === toUserUUID) {
			client.send(JSON.stringify(message))
		}
	})
}

const sendMessageToFoundedPair = ({ firstUserUuid, secondUserUuid, message }) => {
	console.log(LIST_OF_SEARCHING_USERS)
	wsServer.clients.forEach(client => {
		if(client.uuid === firstUserUuid || client.uuid === secondUserUuid) {
			client.roomId = message.roomId;
			if(client.uuid === firstUserUuid) {
				message.interculorUUID = secondUserUuid
			}
			if(client.uuid === secondUserUuid) {
				message.interculorUUID = firstUserUuid;
			}
			client.send(JSON.stringify(message))
		}
	})
}
const ConnectionHandler = async (_, socket) => {
	ONLINE_USERS[socket.uuid] = {
		uuid: socket.uuid
	}
	const reply = {
		event: Events.Connection,
		uuid: socket.uuid,
		amount_online_users: Object.keys(ONLINE_USERS).length,
		amount_of_searching_users: Object.keys(LIST_OF_SEARCHING_USERS).length
	}
	await socketSend(reply, socket)
}
const TypingHandler = (message) => {
	const reply = {
		event: Events.Typing,
	}	
	broadCastToUserMessage({ message: reply, toUserUUID: message.interculorUuid })
}
const StopTypingHandler = (message) => {
	const reply = {
		event: Events.Stop_typing,
	}

	broadCastToUserMessage({ message: reply, toUserUUID: message.interculorUuid })
}

const messageReaded = (message) => {
	console.log(ROOMS[message.roomId])
	console.log(message)
	if(ROOMS[message.roomId]) {
		ROOMS[message.roomId] = ROOMS[message.roomId].map(msg => {
			if(msg.uuid === message.interculorUuid) {
				return { ...msg, isReaded: true }
			}
			return msg
		})
	}

	const reply = {
		event: Events.MessageReaded,
		messages: ROOMS[message.roomId],
		roomId: message.roomId
	}
	broadCastConversationMessage(reply) 
}


const cancelSearching = ({ uuid }, socket) => {
	const responseMsg = {
		event: Events.Cancel_searching,
		uuid
	};
	delete LIST_OF_SEARCHING_USERS[uuid]
	socketSend(responseMsg, socket);
}

// const msg = {
// 	event: 'message/connection',
// 	id: 123,
// 	date: '21.01.2021',
// 	username: 'Aue UbiIca',
// 	msg: 'wewe'
// }

const socketSend = async (data, socket) => socket.send(JSON.stringify(data))
