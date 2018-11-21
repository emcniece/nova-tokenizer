require('dotenv').config()
const express = require('express');
const app = express();
const crypto = require('crypto');
const bodyParser = require('body-parser');
const request = require('request-promise');

// Environment config
const tokenizerUrl = `http://${process.env.TOKENIZER_HOSTNAME}:${process.env.TOKENIZER_PORT}`;
const tokenizerPassword = process.env.BACKEND_PASSWORD;

// Express server config
app.use(bodyParser.json())
app.listen(process.env.BACKEND_PORT);
console.log(`Backend listening on http://${process.env.BACKEND_HOSTNAME}:${process.env.BACKEND_PORT}`);

// Quick auth middleware: plaintext password in visible request header
function checkPassword(req, res, next) {
  if(!req.headers.password || req.headers.password !== tokenizerPassword){
    res.status(401).send('Invalid password')
    return;
  }

  next();
}

app.get('/', function (req, res) {
  res.send('Nova Backend');
});
 
app.post('/store', checkPassword, (req, res) => {
  console.log('Backend storing token: ', req.body);
  res.send(req.body);
});

app.post('/getReport', (req, res) => {
  const data = {token: req.body.token};
  
  console.log('Backend requesting report for token: ', data);

  request({
    method: 'POST',
    uri: `${tokenizerUrl}/fetch`,
    json: true,
    body: data,
    headers: {
      password: req.headers.password
    }
  })
  .then(parsedBody => {
    console.log('Backend POST response to Tokenizer: ', parsedBody);
    res.send(parsedBody);
  })
  .catch(e => {
    console.log('Backend POST error: ', e.message);
    res.status(500).send(e.message);
  }); 

});

app.listen(3001)
