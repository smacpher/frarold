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
const https = require('https');
const frarold_host = 'https://aspc.pomona.edu/api/menu/';
const frarold_dining_hall_path = 'dining_hall/';
const frarold_day_path = 'day/';
const frarold_meal_path = 'meal/';
const frarold_auth_token = '447715aa4a6d9406e9b613f468bc6ccc9f02f20c';

/**
 * HTTP Cloud Function.
 *
 * @param {Object} req Cloud Function request context.
 * @param {Object} res Cloud Function response context.
 */
exports.helloHttp = function helloHttp (req, res) {
  res.send(`Hello ${req.body.name || 'World'}!`);
};

exports.fraroldWebhook = (req, res) => {

    // Both dining_hall and meal are required parameters.
    // TODO: make conversation branching to fetch these params should the
    // user not provide them.
    let dining_hall = req.body.result.parameters['dining_hall'];
    let meal = req.body.result.parameters['meal'];

    callASPCMenuService(dining_hall, meal).then((output) => {
        // Return the results of the ASPC Menu API to Dialogflow.
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({'speech': output, 'displayText': output}));
    }).catch((error) => {
        // Let the user know if there is an error.
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({'speech': error, 'displayText': error}));
    });
};

function callASPCMenuService (dining_hall, meal) {

    return new Promise((resolve, reject) => {
        https.get(
            'https://aspc.pomona.edu/api/menu/dining_hall/frary/day/mon/meal/lunch?auth_token=447715aa4a6d9406e9b613f468bc6ccc9f02f20c',
            (resp) => {
                let data = '';

                resp.on('data', (chunk) => {
                    data += chunk;
                });

                resp.on('end', () => {
                    let result = JSON.parse(data)[0];
                    let food_items = result.food_items;

                    let output = '';
                    for (var i in food_items) {
                        let item = food_items[i];
                        output += item;
                    }
                    resolve(output);

                });

            }).on("error", (err) => {
                console.log("Error: " + err.message);
                reject(error);
            });
  });
}
