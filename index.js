
const crypto = require('crypto');

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

const messageFilePath = './conversations.json';
const userFilePath = './users.json';
const millisPerMinute = 60_000;

const RestAPI = require('./rest-api/restApi');
let conversationAPI = new RestAPI(messageFilePath, true);
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
 conversationAPI._saveData(conversations);
}

/* 
  Most user requests require a username and sessionKey.
  Check that the request has username and sessionKey fields and that they match an existing user.
*/
function validateUser(requestBody) {
  if ('username' in requestBody && 'sessionKey' in requestBody) {
    let users = userAPI.getAll().data;
    for (index in users) {
      let user = users[index];
      if (user['username'] === requestBody['username'] && user['sessionKey'] === requestBody['sessionKey']) {
        return true;
      }
    }
  }
  return false;
}

function getUser(username) {
  let users = userAPI.getAll().data;
  for (let userIndex in users) {
    console.log(`Checking ${username} against ${JSON.stringify(users[userIndex])}`);
    if (users[userIndex]['username'] === username) {
      return users[userIndex];
    }
  }
  return undefined;
}

function getConversationCode(u1, u2) {
  return [u1, u2].sort().join('-');
}

function isConversationUnique(conversationID) {
  console.log(`isConversationUnique(${conversationID})`);
  let conversations = conversationAPI.getAll().data;
  for (conversationIndex in conversations) {
    console.log(`\n${JSON.stringify(conversations[conversationIndex])} === ${conversationID}`);
    if (Object.keys(conversations[conversationIndex])[0] === conversationID) {
      return false;
    }
  }
  return true;
}

function getConversationByID(id) {
  let conversations = conversationAPI.getAll().data;
  for (let index in conversations) {
    let conversation = conversations[index];
    if (Object.keys(conversation)[0] === id) {
      console.log(`Found ${JSON.stringify(conversation)}`);
      return conversation;
    }
  }
  return undefined;
}

app.get('/', function(req, res) {
  return res.status(200).send(JSON.stringify('Hello, World!'));
});

app.get('/setConversations/', function(req, res) {
  saveConversations(baseConversations);
  return res.status(200).send();
});

app.get('/conversations/all', function(req, res) {
  console.log('/conversations/all');
  let result = conversationAPI.getAll();
  return res.status(result.status).send(result.data);
});

/*
  Login required. Body must have 'username' and 'sessionKey'.
*/
app.get('/messages/:conversation', function(req, res) {
  
  if (req.params['conversation'] === undefined) {
    return res.status(400).send();
  }

  // Take participants and ensure the code is in sorted order for storage. E.g. C-A -> A-C
  let participantsCode = req.params['conversation'].split('-').sort().join('-');
  
  // let conversation = getConversation(participantsCode);
  let conversation = getConversationByID(participantsCode);
  if (conversation === undefined) {
    return res.status(400).send(JSON.stringify(`Conversation ${req.params['conversation']} not found`));
  } else {
    return res.status(200).send(conversation);
  }

  /*
    if (conversation === undefined) {
      return res.status(400).send(JSON.stringify(`Conversation ${req.params['conversation']} not found`));
    }
    
    return res.status(200).send(conversation);
  */
});

/*
  Login required. Body must have 'username' and 'sessionKey'.
*/
app.post('/messages/add', jsonParser, function(req, res) {
  let j = req.body;
  let participantsCode = [j['sender'], j['receiver']].sort().join('-');
  console.log(`Adding message ${j} to conversation ${participantsCode}`);
  addMessage(participantsCode, j);

  return res.status(200).send(JSON.stringify(`Added message successfully`));
});

/*
  Login required. Body must have 'username' and 'sessionKey'.
  Add conversation - username, sessionKey, otherUsername
*/
app.post('/conversations/add', jsonParser, function(req, res) {
  let j = req.body;
  console.log('\n\nj:\n\n', j);
  if (validateUser(j)) {
    if ('otherUsername' in j) {
      let thisUser = getUser(j['username']);
      let otherUser = getUser(j['otherUsername']);

      // Make sure the conversation does not already exist.
      if (!isConversationUnique(getConversationCode(thisUser['username'], otherUser['username']))) {
        return res.status(400).send(`A conversation with user ${otherUser['username']} already exists`);
      }

      if (thisUser !== undefined && otherUser !== undefined) {
        let newConversation = {};
        newConversation[thisUser['username']] = {};
        newConversation[otherUser['username']] = {};
        newConversation[thisUser['username']]['publicKey'] = thisUser['publicKey'];
        newConversation[thisUser['username']]['messages'] = [];
        newConversation[otherUser['username']]['publicKey'] = otherUser['publicKey'];
        newConversation[otherUser['username']]['messages'] = [];
        
        let conversationCode = getConversationCode(thisUser['username'], otherUser['username']);
        let indexedConversation = {};
        indexedConversation[conversationCode] = newConversation;
        conversationAPI.add(indexedConversation);
        return res.status(200).send(indexedConversation);
      } else {
        return res.status(500).send("Unable to find this user or the other user");
      }
    } else {
      return res.status(400).send("Invalid body for adding a conversation");
    }
  } else {
    return res.status(400).send("You do not have access to this resource");
  }
});

// --- User API calls ---

/**
 * Register a new user. Expects username, passwordHash, and key in the message body in json format.
 * 
 */
app.post('/users/register', jsonParser, function(req, res) {
  if ('username' in req.body && 'passwordHash' in req.body && 'publicKey' in req.body) {

    // Ensure that a user with that username does not exist.
    let users = userAPI.getAll().data;
    for (index in users) {
      if (users[index]['username'] === req.body['username']) {
        console.log(`A user with username ${req.body['username']} already exists`);
        return res.status(400).send(`A user with username ${req.body['username']} already exists`);
      }
    }
    req.body['sessionKey'] = '';
    userAPI.add(req.body);
    return res.status(200).send(`User ${JSON.stringify(req.body)} added successfully`);
  } else {
    return res.status(400).send('Users must have a \'username\', \'passwordHash\', and a \'key\'');
  }
});

app.post('/users/login', jsonParser, function(req, res) {
  if ('username' in req.body && 'passwordHash' in req.body) {
    let users = userAPI.getAll().data;
    let isSuccessful = false;
    let reqUser;
    console.log(req.body);
    for (index in users) {
      console.log(users[index]);
      if (users[index]['username'] === req.body['username'] && users[index]['passwordHash'] == req.body['passwordHash']) {
        isSuccessful = true;
        reqUser = users[index];
      }
    }
    if (isSuccessful) {
      // Generate session key.
      let sessionKey = crypto.randomBytes(64).toString('hex');
      reqUser['sessionKey'] = sessionKey;
      userAPI._saveData(users);
      return res.status(200).send({msg: 'User logged in successfully', sessionKey: sessionKey, publicKey: reqUser['publicKey']});
    } else {
      return res.status(400).send('Either the username or the password entered was invalid');
    }
  } else {
    return res.status(400).send('Users must have a \'username\', \'passwordHash\'');
  }
});

/*
  this.sender = sender;
  this.receiver = receiver;
  this.timestamp = timestamp;
  this.body = body;
*/

const port = 1443
server.listen(port, () => { console.log('listening on ' + port) });
