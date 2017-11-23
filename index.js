/*** 
 * Frarold Cloud Functions.
 *  By Sean MacPherson.
 ***/

'use strict';
const https = require('https');

const aspcMenuEndpoint = 'https://aspc.pomona.edu/api/menu/';
const diningHallPath = 'dining_hall/';
const dayPath = 'day/';
const mealPath = 'meal/';
const authoTokenPath = 
    '?auth_token=447715aa4a6d9406e9b613f468bc6ccc9f02f20c';

/***
 * Dialogflow Webhooks.
 ***/
exports.fraroldWebhook = (req, res) => {
    let intentName = req.body.result.metadata.intentName;

    switch (intentName) {
        case 'food_list':
            console.log('fraroldWebhook: matched \'food_list\' intent.');
            foodList(req, res);
            break;
        case 'food_search':
            console.log('fraroldWebhook: matched \'food_search\' intent.');
            foodSearch(req, res);
            break;
        default:
            console.log('fraroldWebhook: !!new intent matched!!');
    }
};

/***
 * Intent functions. 
 *  Used to handle different intents that are matched by the
 *  fraroldWebhook. 
 ***/

/* 'food_list' intent. */
/**
 * Constructs response with the menu of the given dining hall for given meal
 * on a given day.
 * Sends an https response to an https request to fulfill the 'food_list'
 * intent.
 *
 * @param req - Request made by the Frarold Dialogflow agent's 
 *  fullfilment API.
 * @param res - Response to be sent back to the Frarold Dialogflow
 *  agent.
 */
function foodList (req, res) {
    // Both diningHall and meal are required parameters.
    let diningHall = req.body.result.parameters.dining_hall;
    let meal = req.body.result.parameters.meal;
    let dateObj = buildDateObj(req);

    getSingleMealMenu(diningHall, dateObj, meal).then((output) => {
        // Return output to Dialogflow.
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({'speech': output, 'displayText': output}));
    }).catch((error) => {
        // Log error if there is one.
        console.log('foodList: ERROR: ' + error);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({'speech': error, 'displayText': error}));
    });
}

/* 'food_search' intent. */
/**
 * Constructs a response with all dining halls with the food_item in the 
 * request for a given day.
 * Sends an https response to an https request to fulfill the 'food_search'
 * intent.
 *g
 * @param req - Request made by the Frarold Dialogflow agent's 
 *  fullfilment API.
 * @param res - Response to be sent back to the Frarold Dialogflow
 *  agent.
 */
function foodSearch (req, res) {
    let food_item = req.body.result.parameters.food_item;
    let dateObj = buildDateObj(req);

    searchDiningHalls(food_item, dateObj).then((output) => {
        // Return output to Dialogflow.
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({'speech': output, 'displayText': output}));
    }).catch((error) => {
        // Log error if there is one.
        console.log('foodSearch: ERROR: ' + error);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({'speech': error, 'displayText': error}));
    });
}

/** HELPER FUNCTIONS **/

/**
 * Fetches menu at given diningHall on given day for given meal.
 * Makes a call to the ASPC Menu API and constructs Frarold's response. 
 * 
 * @param {string} diningHall - Valid options are 'frank', 'frary', 'cmc', 
 *  'scripps', 'pitzer', and 'oldenburg'.
 * @param {Date} dateObj - Built in Javascript Date object; used to fetch meal
 *  for a specific day of the week.
 * @param {string} meal - Valid options are 'breakfast', 'brunch', 'lunch', and
 *  'dinner'.
 */
function getSingleMealMenu (diningHall, dateObj, meal) {
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
                    if (i < foodItems.length - 1) {
                        output += item + ', ';
                    } else {
                        output += 'and ' + item + ' ';
                    }
                }
                output += 'for ' + meal + ' ' + outputDay + '.';
                console.log('callASPCMenuService: output: ' + output);

                // Resolve promise.
                resolve(output);
            });

        }).on("error", (error) => {
            console.log("callASPCMenuService: ERROR: " + error.message);
            reject(error);
        });
    });
}

/**
 * Finds all dining halls that are serving food_item for the given day and meal.
 * Makes a call to the ASPC Menu API and constructs Frarold's response.
 *
 * @param {string} food_item - Food item to search for.
 * @param {Date} dateObj - Built in Javascript Date object; used to match food
 *  item across dining halls for a specific day of the week.
 */
function searchForFoodItem(food_item, dateObj, meal) {
    return new Promise((resolve, reject) => {
       // TODO 
    });
}

/**
 * Builds Date obj from req.body.result.parameters.date if present, 
 * else returns today's Date obj.
 *
 * @param req - An http request that may or may not have
 *  req.body.result.parameters.date specified 
 *  (since the date entity is optional).
 */
function buildDateObj (req) {
    // Initialize to today's date.
    let dateObj = new Date();

    // Date is an optional parameter. If present, update to reflect date in req.
    if (req.body.result.parameters.date) {
        dateObj = new Date(req.body.result.parameters.date);
    }

    return dateObj;
}

/**
 * Converts Javascript Date object to a lowercase three-letter abbreviation of
 * the day of the week - 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', or 'sun'.
 *
 * @param {Date} - Built in Javascript Date object from which day of the week
 *  will be extracted.
 */
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

/**
 * Converts Javascript Date object to full day name. For output speech
 * formatting purposes.
 *
 * @param {Date} - Built in Javascript Date object from which day of the week
 *  will be extracted.
 */
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

/**
 * Converts Dialogflow Agent dining_hall entity names to prettier names.
 *
 * @param {String} string - Dining hall to be converted. Valid options are
 *  'frank', 'frary', 'cmc', 'scripps', 'pitzer', and 'oldenburg'.
 */
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
