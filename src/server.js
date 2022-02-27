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

app.post('/check', (req, res) => {
  coursesToCheck.push({
    subj: req.query.subj, num: req.query.num, lim: req.query.lim, crn: req.query.crn, spotOpened: false,
  });
  res.send(coursesToCheck);
});

app.get('/start', (req, res) => {
  stop = false;
  start();
  res.send('Started');
});

app.get('/stop', (req, res) => {
  stop = true;
  coursesToCheck = [];
  res.send('Stopped');
});

app.post('/refresh', (req, res) => {
  res.send('Refreshed');
});

// START THE SERVER
// =============================================================================
const port = process.env.PORT || 9090;
app.listen(port);

console.log(`checker listening on: ${port}`);

let coursesToCheck = [];
let stop = false;

// Download the helper library from https://www.twilio.com/docs/node/install
// Your Account Sid and Auth Token from twilio.com/console
// DANGER! This is insecure. See http://twil.io/secure
const { ACCOUNT_SID } = process.env;
const { AUTH_TOKEN } = process.env;
const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);

const TIMETABLE_URL = 'https://oracle-www.dartmouth.edu/dart/groucho/timetable.course_quicksearch';
const SELF_URL = process.env.mode === 'development' ? 'http://localhost:9090' : 'https://course-alert-checker.herokuapp.com';

const checkAllCourses = () => {
  return new Promise((resolve, reject) => {
    console.log(`CHECKING ${coursesToCheck.filter((c) => { return !c.spotOpened; }).length} COURSES`);
    Promise.all(coursesToCheck.map((course) => {
      return new Promise((resolve, reject) => {
        if (!course.spotOpened) {
          checkCourse(course.subj, course.num, course.lim, course.crn).then((opened) => {
            if (opened) { course.spotOpened = true; resolve(); } else { resolve(); }
          }).catch((e) => { console.log(e); });
        } else { resolve(); }
      });
    })).then(() => {
      let allOpened = true;
      coursesToCheck.forEach((course) => {
        if (!course.spotOpened) allOpened = false;
      });
      resolve(allOpened);
    }).catch((e) => { reject(e); });
  });
};

const checkCourse = (subj, crsenum, lim, crn) => {
  return new Promise((resolve, reject) => {
    // console.log(`Starting to check for ${subj} ${crsenum}`);
    axios.post(`${TIMETABLE_URL}?classyear=2008&subj=${subj}&crsenum=${crsenum}`).then((response) => {
      const $ = cheerio.load(response.data);

      const get = $('tr td:nth-of-type(16)').text();

      let enroll = 1000;
      for (let i = 0; i <= get.length - 2; i += 2) {
        if (parseInt(get.substring(i, i + 2), 10) < enroll) { enroll = parseInt(get.substring(i, i + 2), 10); }
      }

      console.log(`${subj} ${crsenum} has ${enroll} enrolled`);

      if (enroll < parseInt(lim, 10)) {
        console.log('Opening!');

        client.messages
          .create({
            body: `A slot has opened for ${subj} ${crsenum}, CRN is ${crn}!`,
            from: '+18059185020',
            to: '+18603017761',
          })
          .then(() => {
            resolve(true);
          }).catch((e) => {
            console.log(e);
          });
      } else { resolve(false); }
    }).catch((error) => {
      reject(error);
    });
  });
};

const start = () => {
  axios.post(`${SELF_URL}/refresh`).then(() => {
    if (!stop) {
      checkAllCourses().then((allOpened) => {
        if (allOpened) {
          stop = true;
          console.log('ALL FOUND');
        } else {
          setTimeout(() => { return start(); }, 7000);
        }
      });
    }
  });
};
