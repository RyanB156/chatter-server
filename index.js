
class Message {
  
  constructor(sender, receiver, timestamp, body) {
    this.sender = sender;
    this.receiver = receiver;
    this.timestamp = timestamp;
    this.body = body;
  }
}

const fs = require('fs');
const key = fs.readFileSync('./key.pem');
const cert = fs.readFileSync('./cert.pem');

const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const cors = require('cors');


let app = express();
app.use(cors());
let jsonParser = bodyParser.json();
const server = https.createServer({key: key, cert: cert }, app);

const messageFilePath = './messages.json';
const userFilePath = './users.json';
const millisPerMinute = 60_000;

const RestAPI = require('./rest-api/restApi');
let messageAPI = new RestAPI(messageFilePath, true);
let userAPI = new RestAPI(userFilePath, true);

baseConversations = 
  { 'A-C': [
    new Message('A', 'C', new Date(Date.now() - 20 * millisPerMinute), 'Do you have the stuff?'),
    new Message('C', 'A', new Date(Date.now() - 7.5 * millisPerMinute), 'I do. Are we still meeting under the bridge?'),
    new Message('A', 'C', new Date(Date.now() - 0.3 * millisPerMinute), 'Yes. I will be there at sundown with you 5gs.'),
  ],
    'A-B': [
    new Message('A', 'B', new Date(Date.now() - 10 * millisPerMinute), 'Hi! How are you doing?'),
    new Message('B', 'A', new Date(Date.now() - 9 * millisPerMinute), 'Hey. I am doing well, how about you?'),
    new Message('A', 'B', new Date(Date.now() - 5 * millisPerMinute), 'Good'),
    new Message('A', 'B', new Date(Date.now() - 0.5 * millisPerMinute), 'Whatcha been up to?'),
    new Message('B', 'A', new Date(Date.now() - 0.25 * millisPerMinute), 'I graduated from school with my Bachelor\'s in Computer Science and I just started a job with Honeywell in Raleigh, NC. Everything is going well so far. It\'s good to be starting my career.'),
  ]
};

function getAllConversations() {
  let text = fs.readFileSync(messageFilePath);
  return JSON.parse(text);
}

function getConversation(conversation) {
  let text = fs.readFileSync(messageFilePath);
  let messages = JSON.parse(text);
  return messages[conversation];
}

function addMessage(conversation, message) {
  let allConversations = getAllConversations();
  if (conversation in allConversations) {
    allConversations[conversation].push(message);
    console.log(`Adding ${JSON.stringify(message)} to ${conversation}`);
  } else {
    allConversations[conversation] = [message];
    console.log(`Adding ${JSON.stringify(message)} to new ${conversation}`);
  }
  saveConversations(allConversations);
}

function saveConversations(conversations) {
  /*
    console.log(`Saving ${JSON.stringify(conversations)}`);
    fs.writeFileSync(messageFilePath, JSON.stringify(conversations));
  */
 messageAPI._saveData(conversations);
}

app.get('/', function(req, res) {
  return res.status(200).send(JSON.stringify('Hello, World!'));
});

app.get('/setConversations/', function(req, res) {
  saveConversations(baseConversations);
  return res.status(200).send();
});

app.get('/messages/all', function(req, res) {
  console.log('/messages/all');
  /*
    return res.status(200).send(getAllConversations());
  */
  let result = messageAPI.getAll();
  return res.status(result.status).send(result.data);
});

// http://localhost:3000/messages?conversation=A-B
app.get('/messages/:conversation', function(req, res) {
  
  if (req.params['conversation'] === undefined) {
    return res.status(400).send();
  }

  // Take participants and ensure the code is in sorted order for storage. E.g. C-A -> A-C
  let participantsCode = req.params['conversation'].split('-').sort().join('-');
  
  // let conversation = getConversation(participantsCode);
  let conversationResult = messageAPI.get(participantsCode);
  if (conversationResult.status === 200) {
    return res.status(conversationResult.status).send(conversationResult.data);
  } else {
    return res.status(conversationResult.status).send(JSON.stringify(`Conversation ${req.params['conversation']} not found`));
  }

  /*
    if (conversation === undefined) {
      return res.status(400).send(JSON.stringify(`Conversation ${req.params['conversation']} not found`));
    }
    
    return res.status(200).send(conversation);
  */
});

app.post('/messages/add', jsonParser, function(req, res) {
  let j = req.body;
  let participantsCode = [j['sender'], j['receiver']].sort().join('-');
  console.log(`Adding message ${j} to conversation ${participantsCode}`);
  addMessage(participantsCode, j);

  return res.status(200).send(JSON.stringify(`Added message successfully`));
});

/*
  this.sender = sender;
  this.receiver = receiver;
  this.timestamp = timestamp;
  this.body = body;
*/

const port = 1443
server.listen(port, () => { console.log('listening on ' + port) });
