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
import Database from 'better-sqlite3';
import cron from 'node-cron';
import Axios from 'axios';

dotenv.config({ silent: true });

// initialize
const app = express();

// enable/disable cross origin resource sharing if necessary
app.use(cors());

// enable/disable http request logging
app.use(morgan('dev'));

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let db;

try {
  db = new Database('database.db');
  console.log('Connected to the database.');
} catch (e) {
  console.log(e);
}

db.prepare('CREATE TABLE IF NOT EXISTS courses (subj TEXT, num TEXT, lim TEXT, crn TEXT, phoneNum TEXT, spotOpened BOOLEAN DEFAULT FALSE)').run();
db.prepare('CREATE TABLE IF NOT EXISTS messages (session TEXT, role TEXT, content TEXT, pos INTEGER)').run();

// default index route
app.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM courses').all());
  } catch (e) {
    res.status(500).send(e.messages);
  }
});

app.get('/check', (req, res) => {
  try {
    if (typeof db.prepare('SELECT * FROM courses WHERE crn = ?').get(req.query.crn) == 'undefined') {
      db.prepare('INSERT INTO courses (subj, num, lim, crn, phoneNum) VALUES (?, ?, ?, ?, ?)').run(req.query.subj, req.query.num, req.query.lim, req.query.crn, typeof req.query.phoneNum == 'undefined' ? '+18603017761' : req.query.phoneNum);
    } else {
      console.log('Course already exists, updating.')
      db.prepare('UPDATE courses SET spotOpened = false WHERE crn = ?').run(req.query.crn)
    }
    res.json(db.prepare('SELECT * FROM courses').all());
  } catch (e) {
    res.status(500).send(e.messages);
  }
});

app.get('/stop', (req, res) => {
  try {
    db.prepare('DELETE FROM courses').run();
    res.send('Stopped');
  } catch (e) {
    res.status(500).send(e.messages);
  }
});

const formatMessage = (message, succint = false) => `${message}?${succint ? ' But give me a quick response as if we are in a short conversation.' : ''}`;

app.post('/', (req, res) => {
  try {
    const { session } = req.headers;
    console.log('session:', session);
    const content = formatMessage(req.body.message);
    console.log('message:', content);
    const prevMessages = db.prepare('SELECT role, content FROM messages WHERE session = ? ORDER BY pos ASC').all(session);
    console.log('prevMessages:', prevMessages);
    const maxPos = db.prepare('SELECT MAX(pos) FROM messages WHERE session = ?').get(session)['MAX(pos)'] ?? 0;
    const data = {
      model: 'gpt-3.5-turbo',
      messages: prevMessages.concat([{
        role: 'user',
        content,
      }])
    };
    Axios.post('https://api.openai.com/v1/chat/completions', data, { headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_SEC_KEY}`
    } })
      .then(response => {
        db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?)').run(session, 'user', content, maxPos + 1);
        const { choices } = response.data;
        if (choices.length != 1) {
          console.log('choices:', choices.length);
        }
        response.data.choices.forEach(choice => console.log('\t', JSON.stringify(choice)));
        const reply = choices[0].message.content;
        db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?)').run(session, 'assistant', reply, maxPos + 2);
        res.send(reply);
      })
      .catch(error => {
        console.error(error.message);
        res.send("Sorry, please try that again.");
      });
  } catch (e) {
    console.error(e.message);
    res.status(500).send(e.messages);
  }
});

const port = process.env.PORT || 9090;
app.listen(port);

const { ACCOUNT_SID } = process.env;
const { AUTH_TOKEN } = process.env;
const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);

const TIMETABLE_URL = 'https://oracle-www.dartmouth.edu/dart/groucho/timetable.course_quicksearch';

const checkCourse = (subj, num, lim, crn, phoneNum) => new Promise((resolve, reject) => {
  axios.post(`${TIMETABLE_URL}?classyear=2008&subj=${subj}&crsenum=${num}`).then((response) => {
    const $ = cheerio.load(response.data);

    const get = $('tr td:nth-of-type(18)').text();

    let enroll = 1000;
    for (let i = 0; i <= get.length - 2; i += 2) {
      if (parseInt(get.substring(i, i + 2), 10) < enroll) { enroll = parseInt(get.substring(i, i + 2), 10); }
    }

    console.log(`\t${subj} ${num}: ${enroll}/${lim} enrolled.`);

    if (enroll < parseInt(lim, 10)) {

      client.messages
        .create({
          body: `A slot has opened for ${subj} ${num}, CRN is ${crn}!`,
          from: '+18445450303',
          to: phoneNum,
        })
        .then(() => {
          resolve(true);
        }).catch((e) => {
          reject(e);
        });
    }
    else {
      resolve(false);
    }
  }).catch(e => reject(e));
});

// cron.schedule('*/60 * * * * *', () => {
//   console.log('\nChecking for courses.');
//   const courses = db.prepare('SELECT * FROM courses WHERE spotOpened = false').all();
//   courses.forEach(course => {
//     checkCourse(course.subj, course.num, course.lim, course.crn, course.phoneNum).then((spotOpened) => {
//       if (spotOpened) {
//         try {
//           db.prepare('UPDATE courses SET spotOpened = true WHERE crn = ?').run(course.crn);
//         } catch (e) {
//           console.log(e);
//         }
//       }
//     }).catch(e => console.log(e));
//   });
// });

// cron.schedule('0 0 0 * * *', () => client.messages
//   .create({
//     body: 'Bot still running :)',
//     from: '+18445450303',
//     to: '+18603017761',
//   })
// );