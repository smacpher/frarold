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

    // Initialize to today's date.
    let dateObj = new Date();

    // Date is an optional parameter. If present, update to reflect date in req.
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
        let day = getDayAbbrevFromDateObj(dateObj);

        // Construct HTTP GET path.
        let path = aspcMenuEndpoint + diningHallPath + diningHall + '/' +
            dayPath + day + '/' + mealPath + meal + '/' +
            authoTokenPath;

        console.log('callASPCMenuService: http get ' + path);

        // Initialize outputDay to day of the week.
        let outputDay = getDayFromDateObj(dateObj);

        // If dateObj is today, use "today" instead.
        if (new Date().getDay() == dateObj.getDay()) {
            outputDay = 'today';
        }

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
                let noMealDataOutput =
                    'Hmm...that\'s weird. It looks like ' +
                    prettifyDiningHallEntityName(diningHall) +
                    ' didn\'t post ' + meal + ' ' + outputDay + '.';

                // No meal data for some reason.
                if (!result) {
                    resolve(noMealDataOutput)
                }

                let foodItems = result.food_items;
                let output = '';
                output += prettifyDiningHallEntityName(diningHall) + ' has ';
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

/* Converts Javascript Date object to three-letter abbreviation of day. */
function getDayAbbrevFromDateObj(dateObj) {
    // Parse out three-letter abbreviation of day.
    let day = dateObj.toString().split(' ')[0].toLowerCase();

    // Handle invalid date case; default to today's date.
    if (day.toLowerCase() === 'invalid') {
        dateObj = new Date();
        day = getDayFromDateObj(dateObj);
    }

    return day;
}

/* Converts Javascript Date object to full day name. */
function getDayFromDateObj(dateObj) {
    let days = [
        'Monday', 
        'Tuesday', 
        'Wednesday', 
        'Thursday', 
        'Friday', 
        'Saturday',
        'Sunday'
    ];
    return days[dateObj.getDay()];
}

/* Converts Dialogflow Agent dining_hall entity names to prettier names. */
function prettifyDiningHallEntityName(string) {
    let diningHallNameMap = new Map([
        ['frank', 'Frank'],
        ['frary', 'Frary'],
        ['cmc', 'Collins'],
        ['scripps', 'Scripps'],
        ['pitzer', 'Pitzer'],
        ['oldenburg', 'Oldenburg']
    ]);
    return diningHallNameMap.get(string);
}
