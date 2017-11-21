/* 
 * Frarold Cloud Functions.
 */

'use strict';
const https = require('https');
const frarold_host = 'https://aspc.pomona.edu/api/menu/';
const frarold_dining_hall_path = 'dining_hall/';
const frarold_day_path = 'day/';
const frarold_meal_path = 'meal/';
const frarold_auth_token_path = 
    '?auth_token=447715aa4a6d9406e9b613f468bc6ccc9f02f20c';

/*
 * Dialogflow Webhooks.
 */
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

/*
 * Helper functions.
 */
function callASPCMenuService (dining_hall, meal) {
    return new Promise((resolve, reject) => {
        let day = 'mon';
        let path = frarold_host + frarold_dining_hall_path + dining_hall + '/' +
            frarold_day_path + day + '/' + frarold_meal_path + meal + '/' +
            frarold_auth_token_path;

        console.log('callASPCMenuService: HTTP GET ' + path);

        https.get(
            path,
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

function getToday (datetime) {

}

