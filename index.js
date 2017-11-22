/* 
 * Frarold Cloud Functions.
 */

'use strict';
const https = require('https');

const aspcMenuEndpoint = 'https://aspc.pomona.edu/api/menu/';
const diningHallPath = 'dining_hall/';
const dayPath = 'day/';
const mealPath = 'meal/';
const authoTokenPath = 
    '?auth_token=447715aa4a6d9406e9b613f468bc6ccc9f02f20c';

/*
 * Dialogflow Webhooks.
 */
exports.fraroldWebhook = (req, res) => {
    // Both diningHall and meal are required parameters.
    let diningHall = req.body.result.parameters.dining_hall;
    let meal = req.body.result.parameters.meal;

    let dateObj = new Date();

    // Date is an optional parameter. If not present, default to today.
    if (req.body.result.parameters.date) {
        dateObj = new Date(req.body.result.parameters.date);
    }

    callASPCMenuService(diningHall, dateObj, meal).then((output) => {
        // Return the results of the ASPC Menu API to Dialogflow.
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({'speech': output, 'displayText': output}));
    }).catch((error) => {
        // Let the user know if there is an error.
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({'speech': "fuck", 'displayText': "fuck"}));
    });
};

/*
 * Helper functions.
 */
function callASPCMenuService (diningHall, dateObj, meal) {
    return new Promise((resolve, reject) => {
        // Get three-letter abbreviation of the date.
        let day = getDayFromDateObj(dateObj);

        // Construct HTTP GET path.
        let path = aspcMenuEndpoint + diningHallPath + diningHall + '/' +
            dayPath + day + '/' + mealPath + meal + '/' +
            authoTokenPath;

        console.log('callASPCMenuService: http get ' + path);

        // Make API call.
        https.get(path, (resp) => {
            // Collect chunks of the response.
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
                console.log('callASPCMenuService: chunk received: ' + chunk);
            });

            // Response done.
            resp.on('end', () => {
                let result = JSON.parse(data)[0];
                let foodItems = result.food_items;
                let output = '';
                output += capitalizeFirstLetter(diningHall) + ' has ';
                for (var i in foodItems) {
                    let item = foodItems[i];
                    if (i != foodItems.length - 1) {
                        output += item + ', ';
                    }
                }
                output += 'for ' + meal + '.'
                console.log('callASPCMenuService: output: ' + output);

                // Resolve promise.
                resolve(output);
            });

        }).on("error", (err) => {
            console.log("callASPCMenuService: ERROR: " + err.message);
            reject(error);
        });
    });
}

function getDayFromDateObj(dateObj) {
    // Parse out three-letter abbreviation of day.
    let day = dateObj.toString().split(' ')[0].toLowerCase();

    // Handle invalid date case; default to today's date.
    if (day.toLowerCase() === 'invalid') {
        dateObj = new Date();
        day = getDayFromDateObj(dateObj);
    }

    return day;
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
l