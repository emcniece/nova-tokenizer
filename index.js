const express = require('express');
const app = express();
const crypto = require('crypto');
const bodyParser = require('body-parser');

/** Store tokens!
  {
    abcdefg: '0000000'
  }
*/
const dataset = {};

app.use(bodyParser.json())
 
app.get('/', function (req, res) {
  res.send('Nova Tokenizer')
});
 
app.post('/tokenize', (req, res) => {
  // This secret should come from a env-constructed file
  const hmac = crypto.createHmac('sha256', 'aljksdflkaskfjasjflelkjajklefljaljgjas');

  const ccNumber = req.body.number;
  hmac.update(ccNumber);
  const token = hmac.digest('hex');
  sendToBackend({ccNumber: token});
  dataset[token] = ccNumber;
  res.send(token)
});

app.post('/fetch', (req, res) => {
  if(!req.headers.password || req.headers.password !== 'password'){
    res.send('Invalid password')
    return;
  }

  console.log('Req from backend: ', req.body.data)

  const token = req.body.data
  report = sendToDataProvider({number: dataset[token]});

  console.log('Report from Data Provider: ', report);

  // Parse body and find CC numbers
  const re = /(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})/
  const reportBody = JSON.stringify(report)
  const matches = re.exec(reportBody);

  if(!!matches && matches.length > 0){
    const sanitized = reportBody.replace(matches[0], token);

    sendToBackend(sanitized)
    res.send(`Fetch success for ${token}`);
    return;
  } else {
    res.send(`Fetch failed for ${token}`);
  }
});


app.listen(3000)



sendToBackend = (tokenized) => {
  console.log('Sending to backend: ', tokenized)
}

sendToDataProvider = (sensitive) => {
  console.log('Sending to data provider: ', sensitive)

  // Mock report returning from Data Provider
  
  // Format 1: JSON object
  //return {report: {cardNumber: sensitive.number}};
  
  // Format 2: Plain text string
  //return `report cardNumber: ${sensitive.number}`;

  // Format 3: XML
  return `<credit-report>${sensitive.number}<credit-report>`;
}






