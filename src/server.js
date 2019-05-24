import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import axios from 'axios';
import $ from 'jquery';

// initialize
const app = express();

// enable/disable cross origin resource sharing if necessary
app.use(cors());

// enable/disable http request logging
app.use(morgan('dev'));

// enable only if you want templating
app.set('view engine', 'ejs');

// enable only if you want static assets from folder static
app.use(express.static('static'));

// this just allows us to render ejs from the ../app/views directory
app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// additional init stuff should go before hitting the routing

// default index route
app.get('/', (req, res) => {
  res.send('hi');
});

// stopper route
app.get('/stop', (req, res) => {
  spotOpened = true;
  res.send('stopped');
});

// starter route
app.get('/start', (req, res) => {
  spotOpened = false;
  checkCourse(req.query.subj, req.query.num);
  res.send(`starting to check for ${req.query.subj} ${req.query.num}`);
});

// START THE SERVER
// =============================================================================
const port = process.env.PORT || 9090;
app.listen(port);

console.log(`listening on: ${port}`);

// Download the helper library from https://www.twilio.com/docs/node/install
// Your Account Sid and Auth Token from twilio.com/console
// DANGER! This is insecure. See http://twil.io/secure
const accountSid = 'AC5a45cbbe881a50587dcf107cdfb6ee33';
const authToken = '31f9e3efce328eab967cc0db6567d4ec';
const client = require('twilio')(accountSid, authToken);

let spotOpened = false;

const TIMETABLE_URL = 'https://oracle-www.dartmouth.edu/dart/groucho/timetable.course_quicksearch';

const checkCourse = (subj, crsenum) => {
  axios.post(`${TIMETABLE_URL}?classyear=2008&subj=${subj}&crsenum=${crsenum}`).then(response => {
    console.log('Checking the timetable...')
    if (!isNaN(response.data.substring(8702, 8704)) && !spotOpened) {
      if (Number(response.data.substring(8702, 8704)) < 60) {
        console.log('Opening!');
        console.log(Number(response.data.substring(8702, 8704)));
        client.messages
        .create({
           body: `A slot has opened for ${subj} ${crsenum}!`,
           from: '+18608502893',
           to: '+18603017761'
         })
        .then(message => console.log(message.sid));
        spotOpened = true;
      }
    }
    if (!spotOpened) {
      setTimeout(() => checkCourse('COSC', '30'), 1000);
    }
  }).catch(error => {
    console.log(error.message);
  });
}

checkCourse('COSC', '30');




