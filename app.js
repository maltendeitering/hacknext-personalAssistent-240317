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
var stringSimilarity = require('string-similarity');
var app = express();
var token = "EAAZABV7q4AjkBAPexL84ga1PYbhMgMXmOAhjzKZBdI0wZAdeiWsLP6JWn9bV5LwaXLKwF41VZBSoIxd7xaXuKW7hlqznXelry9u05Gg51SsZAwUM878wr3rzGPVzpH32gkq1Q3HZAk2YdQhN7FGJ2W1ieUrsDwVKzHqb1OEQfpUgZDZD";

var context = {};
var matches = {};
var sender;

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
    var responseText;
    var accessAPI = false;
    var accessGoogleAPI = false;

    if (err) {
        res.send('Error in Watson Conversation');
    }
    else {
        context = response.context;
        console.log(response.output);
        responseText = response.output.text.toString();
        var responseArray = response.output.nodes_visited;

        //Call APIs on specific conversation nodes
        if(responseArray.indexOf("weitergabe_API") > -1) {
            accessAPI = true;
            callAllianzAPI(context, responseText);
        }
        if(responseArray.indexOf("betrag") > -1) {
            checkBerufe(context.berufeingabe);
        }
        if(responseArray.indexOf("Zusammenfassung init") > -1) {
            if(matches.bestMatch.rating < 0.5) {
                responseText = responseText + " Bei deinem Beruf war ich mir nicht ganz sicher. Stimmt dieser so?";
            }
        }
    if(!accessAPI)
        sendMessage(sender, responseText);
    }
};

//Access the Allianz Berufsliste API
function checkBerufe(berufeingabe) {
    request({
        url: "https://www.allianz.de/oneweb/ajax/aspro/multiofferlebenservice/berufeliste",
        method: "GET",
        json: true,
        headers: {
            'Accept': 'application/json',
            'Accept-Charset': 'utf-8'
        }
    }, function (error, response, body) {
      if (!error && response.statusCode == 200) {

            matches = stringSimilarity.findBestMatch(berufeingabe, body);
            context.berufeingabe = matches.bestMatch.target;
        }
        else {
            console.log("Error: " + error);
        }
    });
};


//This function invokes the Allianz API call
function callAllianzAPI(context, responseText) {
    var contract = {
            "vertrag":
            {
              "produkt": context.produkt,
              "betrag": context.betrag,
              "beginn": context.beginn,
              "vertragslaufzeit": context.vertragslaufzeit,
            },
              "vp":
              {
                "geburtsdatum": context.geburtsdatum,
                "berufeingabe": context.berufeingabe
              }
            }

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
                if(body.status === 'OK') {
                    responseText = responseText + " Versicherungsprämie (netto, monatlich): " + body.beitrag.netto + "€";
                    sendMessage(sender, responseText);
                }
                else {
                    responseText = body.error.text;
                    sendMessage(sender, responseText);
                }
            }
        });
};

var host = (process.env.VCAP_APP_HOST || 'localhost');
var port = (process.env.VCAP_APP_PORT || 3000);
app.listen(port, host);