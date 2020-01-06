/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-globals */
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import axios from 'axios';
import cheerio from 'cheerio';
// import $ from 'jquery';
import dotenv from 'dotenv';

dotenv.config({ silent: true });

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

// starter route
app.post('/check', (req, res) => {
  checkCourse(req.query.subj, req.query.num, req.query.lim);
  res.send(`starting to check for ${req.query.subj} ${req.query.num}`);
});

// START THE SERVER
// =============================================================================
const port = process.env.PORT || 9090;
app.listen(port);

console.log(`checker listening on: ${port}`);

// Download the helper library from https://www.twilio.com/docs/node/install
// Your Account Sid and Auth Token from twilio.com/console
// DANGER! This is insecure. See http://twil.io/secure
const { ACCOUNT_SID } = process.env;
const { AUTH_TOKEN } = process.env;
const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);


const TIMETABLE_URL = 'https://oracle-www.dartmouth.edu/dart/groucho/timetable.course_quicksearch';
const ENGINE_URL = process.env.mode === 'development' ? 'http://localhost:7070' : 'https://course-alert-engine.herokuapp.com';

const checkCourse = (subj, crsenum, lim) => {
  axios.post(`${TIMETABLE_URL}?classyear=2008&subj=${subj}&crsenum=${crsenum}`).then((response) => {
    console.log('Checking the timetable...');

    const $ = cheerio.load(response.data);

    const enroll = $('tr td:nth-of-type(16)').text();
    console.log(enroll);

    if (enroll < parseInt(lim, 10)) {
      console.log('Opening!');

      axios.post(`${ENGINE_URL}/result`, { spotOpened: true }).then((result) => {
        console.log(`engine said it ${result.data}`);
      });
      client.messages
        .create({
          body: `A slot has opened for ${subj} ${crsenum}!`,
          from: '+18608502893',
          to: '+18603017761',
        })
        .then((message) => { return console.log(message.sid); });
    } else {
      axios.post(`${ENGINE_URL}/result`, { spotOpened: false }).then(() => {
        console.log('told engine to keep going');
      });
    }
  }).catch((error) => {
    console.log(error.message);
  });
};
