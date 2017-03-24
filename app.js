var ConversationV1 = require('watson-developer-cloud/conversation/v1');
var conversation = new ConversationV1({
  username: '12db8818-5b78-4a4c-a544-2244c314ce53', // replace with username from service key
  password: 'mHAJssHHJYN4', // replace with password from service key
  path: { workspace_id: '569b828f-df25-468b-9179-57bb5c7ff196' }, // replace with workspace ID
  version_date: '2017-03-24'
});

var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var app = express();
var token = "EAAZABV7q4AjkBAPexL84ga1PYbhMgMXmOAhjzKZBdI0wZAdeiWsLP6JWn9bV5LwaXLKwF41VZBSoIxd7xaXuKW7hlqznXelry9u05Gg51SsZAwUM878wr3rzGPVzpH32gkq1Q3HZAk2YdQhN7FGJ2W1ieUrsDwVKzHqb1OEQfpUgZDZD";

var context = {};
var sender;

var contract = {
            "vertrag":
            {
              "produkt":"RLV_BASIS",
              "betrag":100000,
              "beginn":"2017-04",
              "vertragslaufzeit":10,
              "raucherstatus":false
            },
              "vp":
              {
                "geburtsdatum":"1992-04-01",
                "berufeingabe":"Industriekaufmann, Industriekauffrau"
              }
            }

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())


// This code is called only when subscribing the webhook //
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'mySecretAccessToken') {
        res.send(req.query['hub.challenge']);
    }
    res.send('Error, wrong validation token');
})


// Incoming messages reach this end point //
app.post('/webhook/', function (req, res) {
    messaging_events = req.body.entry[0].messaging;
    for (i = 0; i < messaging_events.length; i++) {
        event = req.body.entry[0].messaging[i];
        sender = event.sender.id;
        if (event.message && event.message.text) {
            newMessage = event.message.text;
            console.log(newMessage);
            conversation.message({
                  input: { text: newMessage },
                  context: context,
                }, processResponse);
        }
    }
    res.sendStatus(200);
});


// This function receives the response text and sends it back to the user //
function sendMessage(sender,text) {
    messageData = {
        text: text
    }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: token},
        method: 'POST',
        json: {
            recipient: {id: sender},
            message: messageData,
        }
    }, function (error, res, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (res.body.error) {
            console.log('Error: ', res.body.error);
        }
    });
};


// This function handles the response from Watson Conversation service
function processResponse(err, response) {
    if (err) {
        res.send('Error in Watson Conversation');
    }
    else {
        context = response.context;
        var responseText = response.output.text[0];
        if (response.intents && response.intents[0].intent === 'test_123') {

            request({
                url: "https://www.allianz.de/oneweb/ajax/aspro/multiofferlebenservice/quickquote/",
                method: "POST",
                json: true,
                headers: {
                    "content-type": "application/json",
                },
                    body: contract
                }, function (error, res, body) {
                if (!error && res.statusCode == 200) {
                    console.log(JSON.stringify(body));
                    responseText = "Die Versicherungsprämie beträgt (netto):" + body.beitrag.netto;
                }
            });
        }
        sendMessage(sender, responseText);
    }
};


// // Process the conversation response.
// function processResponse(err, response) {
//       if (err) {
//         console.error(err); // something went wrong
//         return;
//       }

//     // If an intent was detected, log it out to the console.
//     if (response.intents.length > 0) {
//         console.log('Detected intent: #' + response.intents[0].intent);
//     }
  
//     // Display the output from dialog, if any.
//     if (response.output.text.length != 0) {
//       console.log(response.output.text[0]);
//     }

//     // Send back the context to maintain state.
//     conversation.message({
//                   input: { text: newMessage },
//                   context : response.context,
//                 }, processResponse)
// }


var host = (process.env.VCAP_APP_HOST || 'localhost');
var port = (process.env.VCAP_APP_PORT || 3000);
app.listen(port, host);