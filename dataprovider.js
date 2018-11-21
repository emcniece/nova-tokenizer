require('dotenv').config()
const express = require('express');
const app = express();
const crypto = require('crypto');
const bodyParser = require('body-parser');

app.use(bodyParser.json());
app.listen(process.env.DATAPROVIDER_PORT);
console.log(`Dataprovider listening on http://${process.env.DATAPROVIDER_HOSTNAME}:${process.env.DATAPROVIDER_PORT}`);

const reports = [
  {
    // Case 1: single value replacement with tricky characters
    type: 'application/xml',
    template: '<credit-report>NUMBER_PLACEHOLDER<credit-report>'
  },
  {
    // Case 2: multi-value replacement
    type: 'application/text',
    template: 'report cardNumber: NUMBER_PLACEHOLDER - NUMBER_PLACEHOLDER'
  },
  {
    // Case 3: sensitive data that doesn't match the tokenized number
    type: 'application/json',
    template: '{report: {cardNumber: "NUMBER_PLACEHOLDER", secondary: "2345678901234562"}}'
  },
];

function getRandomReport() {
  const min = 0;
  const max = reports.length; // yes, this needs to be the ceiling
  const random = Math.floor(Math.random() * (max - min)) + min;
  return reports[random];
}

app.get('/', function (req, res) {
  res.send('Nova Data Provider');
});

app.post('/getReport', (req, res) => {
  console.log('DataProvider fetching report for number: ', req.body);

  const report = getRandomReport();
  const body = report.template.replace(new RegExp('NUMBER_PLACEHOLDER', 'g'), req.body.number);
  res.type(report.type);
  res.send(body);

  console.log('DataProvider Report type: ', report.type);
  console.log('DataProvider Report: ', body);
});
