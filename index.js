require('dotenv').config();
const express = require('express');
const app = express();
const crypto = require('crypto');
const bodyParser = require('body-parser');
const request = require('request-promise');
const redis = require('async-redis');
const fs = require('fs-extra')

// Environment config
const dataProviderUrl = `http://${process.env.DATAPROVIDER_HOSTNAME}:${process.env.DATAPROVIDER_PORT}`;
const backendUrl = `http://${process.env.BACKEND_HOSTNAME}:${process.env.BACKEND_PORT}`;
const backendPassword = process.env.BACKEND_PASSWORD;

// Redis config
const rClient = redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOSTNAME);
rClient.on('connect', () => {
  console.log(`Tokenizer connected to Redis on ${process.env.REDIS_HOSTNAME}:${process.env.REDIS_PORT}`)
});
rClient.on('error', (err) => {
  console.log('Redis error: ', err);
});

// Express server config
app.use(bodyParser.json());
app.listen(process.env.TOKENIZER_PORT);
console.log(`Tokenizer listening on http://${process.env.TOKENIZER_HOSTNAME}:${process.env.TOKENIZER_PORT}`);

// Quick auth middleware: plaintext password in visible request header
function checkPassword(req, res, next) {
  if(!req.headers.password || req.headers.password !== backendPassword){
    res.status(401).send('Invalid password');
    return;
  }

  next();
}

// Base route
app.get('/', function (req, res) {
  res.send('Nova Tokenizer');
});

// Tokenize: accept a CC number, return a token
app.post('/tokenize', async (req, res) => {

  // Hash the CC number securely to generate a token
  const secret = await fs.readFile('.secret', 'utf8');
  const hmac = crypto.createHmac('sha256', secret);
  const ccNumber = req.body.number;
  hmac.update(ccNumber);
  const token = hmac.digest('hex');
  
  // Send the token to backend, return result to the user
  try {
    const result = await sendToBackend({token: token}, req.headers.password);
    await rClient.set(token, ccNumber);
    res.send(result)
  } catch (e) {
    res.status(500).send(e.message)
  }
});

app.post('/fetch', checkPassword, async (req, res) => {
  const token = req.body.token;
  console.log('Tokenizer proxying to Data Provider: ', token);

  try {
    // Retrieve sensitive data from Redis
    const ccNumber = await rClient.get(token);
    console.log('Tokenizer retrieving from Redis: ', ccNumber);

    if(!ccNumber){
      throw new Error('Token not found in storage');
    }

    // Request report from DataProvider using sensitive data
    const report = await fetchFromDataProvider({number: ccNumber});
    console.log('Report from Data Provider: ', report);

    // Parse report body and find CC numbers
    const re = /(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})/
    const reportBody = JSON.stringify(report)
    const matches = re.exec(reportBody);

    // Replace detected numbers with tokens
    // (doesn't work well for unexpected numbers)
    if(!!matches && matches.length > 0){
      const sanitized = reportBody.replace(new RegExp(re, 'g'), token);
      console.log(`Tokenizer fetch success for ${token}`, sanitized);
      res.send(sanitized);
    } else {
      // Something might be wrong if the report is missing our data
      throw new Error('No CC number detected in DataProvider report');
    }
  } catch (e) {
    res.status(500).send(`Fetch failed for ${token}: ${e.message}`);
  }
});

sendToBackend = async (tokenized, password) => {
  console.log('Tokenizer Sending to backend: ', tokenized);

  const options = {
    method: 'POST',
    uri: `${backendUrl}/store`,
    json: true,
    body: tokenized,
    headers: {
      password: password
    }
  };

  try {
    const response = await request(options);
    console.log('Tokenizer POST response from Backend: ', response);
    return Promise.resolve(response)
  } catch (e) {
    console.log('Tokenizer POST error from Backend: ', e.message);
    return Promise.reject(e)
  }
}

fetchFromDataProvider = async (sensitiveData) => {
  console.log('Tokenizer requesting to Data Provider: ', sensitiveData);

  const options = {
    method: 'POST',
    uri: `${dataProviderUrl}/getReport`,
    json: true,
    body: sensitiveData
  };

  try {
    const response = await request(options);
    console.log('Tokenizer POST response from Data Provider: ', response);
    return Promise.resolve(response)
  } catch (e) {
    console.log('Tokenizer POST error from Data Provider: ', e.message);
    return Promise.reject(e);
  }
}
