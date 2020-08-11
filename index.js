
const crypto = require('crypto');


const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const port = 3000;

let app = express();
app.use(cors());
let jsonParser = bodyParser.json();

const messageFilePath = './conversations.json';
const userFilePath = './users.json';
const millisPerMinute = 60_000;

const RestAPI = require('./rest-api/restApi');
let conversationAPI = new RestAPI(messageFilePath);
let userAPI = new RestAPI(userFilePath);

baseConversations = {};

function addMessage(conversationCode, message) {
  
  let allConversations = conversationAPI.getAll().data;
  
  console.log(`\n\n\nAdding ${JSON.stringify(message)} to ${conversationCode}\n\n\n`);

  for (index in allConversations) {
    if (Object.keys(allConversations[index]).includes(conversationCode)) {
      let conversation = allConversations[index][conversationCode];
      conversation['messages'].push(message);
    }
  }

  conversationAPI._saveData(allConversations);
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

/*
  Login required. Body must have 'username' and 'sessionKey'.
*/
app.post('/conversations/all', jsonParser, function(req, res) {
  let j = req.body;
  if (validateUser(j)) {
    console.log('/conversations/all');
    let result = conversationAPI.getAll();
    return res.status(result.status).send(result.data);
  } else {
    return res.status(400).send("You do not have access to this resource");
  }
});

/*
  Login required. Body must have 'username' and 'sessionKey'.
  Query arg 'conversationCode' = <u1>-<u2>.
*/
app.post('/conversations/view', jsonParser, function(req, res) {
  
  if (req.query['conversationCode'] === undefined) {
    return res.status(400).send();
  }

  let j = req.body;
  if (validateUser(j)) {
    // Take participants and ensure the code is in sorted order for storage. E.g. C-A -> A-C
    let participantsCode = req.query['conversationCode'].split('-').sort().join('-');
    
    // let conversation = getConversation(participantsCode);
    let conversation = getConversationByID(participantsCode);
    if (conversation === undefined) {
      return res.status(400).send(JSON.stringify(`Conversation ${req.query['conversationCode']} not found`));
    } else {
      let timestamp = req.query['timestamp'];
      if (timestamp === undefined) { // Return all messages.
        console.log('\nundefined timestamp\n');
        return res.status(200).send(conversation);
      } else { // Return only new messages.
        console.log(conversation);
        let allMessages = conversation[participantsCode]['messages'];
        let i = allMessages.findIndex(message => {
          let messageTimestamp = new Date(message['timestamp']).toString();
          return messageTimestamp >= timestamp;
        });
        console.log(typeof timestamp);
        console.log(`\n\nFound last message at ${i}/${allMessages.length}`);
        conversation[participantsCode]['messages'] = allMessages.slice(i+1, allMessages.length);
        return res.status(200).send(conversation);
      }
    }
  } else {
    return res.status(400).send("You do not have access to this resource");
  }
});

/*
  Login required. Body must have 'username' and 'sessionKey'.
  Body also has 'message'.
*/
app.post('/messages/add', jsonParser, function(req, res) {
  let j = req.body;
  if (validateUser(j)) {
    let message = j['message'];
    let participantsCode = [message['sender'], message['receiver']].sort().join('-');
    console.log(`Adding message ${message} to conversation ${participantsCode}`);
    addMessage(participantsCode, message);

    return res.status(200).send(JSON.stringify(`Added message successfully`));
  } else {
    return res.status(400).send("You do not have access to this resource");
  }
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
        let keys = {};
        keys[thisUser['username']] = thisUser['publicKey'];
        keys[otherUser['username']] = otherUser['publicKey'];

        let newConversation = {
          publicKeys: keys,
          messages: []
        };
        
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


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
