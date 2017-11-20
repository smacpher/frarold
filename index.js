// Copyright 2017, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';
const http = require('http');
const host = 'api.worldweatheronline.com';
const wwoApiKey = '[YOUR_API_KEY]';

const frarold_host = 'https://aspc.pomona.edu/api/menu/';
const frarold_dining_hall_path = 'dining_hall/';
const frarold_day_path = 'day/';
const frarold_meal_path = 'meal/';
const frarold_auth_token = '447715aa4a6d9406e9b613f468bc6ccc9f02f20c';

exports.fraroldWebhook = (req, res) => {

    // Both dining_hall and meal are required parameters.
    // TODO: make conversation branching to fetch these params should the
    // user not provide them.
    let dining_hall = req.body.result.parameters['dining_hall'];
    let meal = req.body.result.parameters['meal'];

    callASPCMenuService(dining_hall, meal).then((output) => {
        // Return the results of the ASPC Menu API to Dialogflow.
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ 'speech': output, 'displayText': output }));
    }).catch((error) => {
        // Let the user know if there is an error.
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({'speech': error, 'displayText': error}));
    });
};

function callASPCMenuService (dining_hall, meal) {
    return new Promise((resolve, reject) => {
    // Create the path for the HTTP request to get ASPC Menu data.
    let path = frarold_dining_hall_path + dining_hall + '/' +
      frarold_day_path + 'mon' + '/' + frarold_meal_path + meal + '?' +
      'auth_token=' + frarold_auth_token;

    console.log("API GET URI: " + host + path);

    // Make the HTTP request to get the weather
    http.get({host: frarold_host, path: path}, (res) => {
      let body = ''; // var to store the response chunks
      res.on('data', (d) => { body += d; }); // store each response chunk
      res.on('end', () => {
        // After all the data has been received parse the JSON for desired data
        let response = JSON.parse(body);

        // Create response
        let output = `You asked for ${meal} at ${dining_hall}.`;
        // Resolve the promise with the output text
        console.log(output);
        resolve(output);
      });
      res.on('error', (error) => {
        reject(error);
      });
    });
  });
}
