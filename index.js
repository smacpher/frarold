/*** 
 * Frarold Cloud Functions.
 *  By Sean MacPherson.
 ***/

'use strict';
const https = require('https');
const Fuse = require('fuse.js');
const moment = require('moment-timezone');

const aspcMenuEndpoint = 'https://aspc.pomona.edu/api/menu/';
const diningHallPath = 'dining_hall/';
const dayPath = 'day/';
const mealPath = 'meal/';
const authTokenPath = 
    '?auth_token=447715aa4a6d9406e9b613f468bc6ccc9f02f20c';
const diningHalls = [
    'frary', 
    'frank', 
    'cmc', 
    'scripps', 
    'pitzer', 
    'oldenburg'
];
const fuseOptions = {
    tokenize: true,
    tokenSeparator: ' ',
    matchAllTokens: true,
    shouldSort: true,
    threshold: 0.2,
    location: 0,
    distance: 25,
    maxPatternLength: 25,
    minMatchCharLength: 1,
    keys: ['name']
};
const timezone = "America/Los_Angeles";
const dialogflowDateFormat = 'YYYY-MM-DD';

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
            console.log('fraroldWebhook: !!unknown intent matched!!');
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
    let date = buildMoment(req.body.result.parameters.date);

    getSingleMealMenu(diningHall, date, meal).then((output) => {
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
    let meal = req.body.result.parameters.meal;
    let date = buildMoment(req);

    getFoodItemsThatMatchAtAllDiningHalls(food_item, 
                                          date, 
                                          meal).then((output) => {
        // Return output to Dialogflow.
        res.setHeader('Content-Type', 'application/json');
        res.send(
            JSON.stringify(
                {'speech': output.join('\n'), 'displayText': output.join('\n')}
            )
        );
    }).catch((error) => {
        // Log error if there is one.
        console.log('foodSearch: ERROR: ' + error.join('\n'));
        res.setHeader('Content-Type', 'application/json');
        res.send(
            JSON.stringify(
                {'speech': error.join('\n'), 'displayText': error.join('\n')}
            )
        );
    });
}

/** HELPER FUNCTIONS **/

/**
 * Fetches menu at given diningHall on given day for given meal.
 * Makes a call to the ASPC Menu API and constructs Frarold's response. 
 * 
 * @param {string} diningHall - Valid options are 'frank', 'frary', 'cmc', 
 *  'scripps', 'pitzer', and 'oldenburg'.
 * @param {moment} date - Javascript moment object; used to fetch meal
 *  for a specific day of the week.
 * @param {string} meal - Valid options are 'breakfast', 'brunch', 'lunch', and
 *  'dinner'.
 */
function getSingleMealMenu (diningHall, date, meal) {
    return new Promise((resolve, reject) => {
        // Get three-letter abbreviation of the date.
        let dayAbbrev = getDayAbbrev(date);
        let path = buildSingleMealMenuHTTPPath(diningHall, dayAbbrev, meal);
        console.log('getSingleMealMenu: http get ' + path);

        https.get(path, (resp) => {

            // Collect chunks of the response.
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
                console.log('getSingleMealMenu: chunk received: ' + chunk);
            });

            // Response done.
            resp.on('end', () => {
                let output;
                let result = JSON.parse(data)[0];
                console.log('getSingleMealMenu: result: ' + result);

                // No meal data at diningHall for given date and meal.
                if (!result) {
                    output = buildNoMealDataResponse(
                        diningHall, 
                        date, 
                        meal
                    );
                } else {
                    output = buildFoodItemsResponse (
                        result.food_items,
                        diningHall, 
                        date, 
                        meal
                    );
                }
                console.log('getSingleMealMenu: output: ' + output);
                resolve(output);
            });

        }).on('error', (error) => {
            console.log('getSingleMealMenu: ERROR: ' + error.message);
            reject(error);
        });
    });
}

/**
 * Finds all dining halls that are serving foodItem for the given day and meal.
 * Makes a call to the ASPC Menu API and constructs Frarold's response. Fuzzy
 * string matches foodItem to menu items.
 *
 * @param {string} foodItem - Food item to search for.
 * @param {moment} date - Javascript moment object; used to match food
 *  item across dining halls for a specific day of the week.
 */
function getFoodItemsThatMatchAtAllDiningHalls (foodItem, 
                                                date, 
                                                meal) {
    let promises = [];
    for (let i in diningHalls) {
        promises.push(
            getFoodItemsThatMatchAtDiningHall(
                foodItem, 
                diningHalls[i], 
                date, 
                meal
            )
        );
    }
    return Promise.all(promises);
}

/**
 * Finds all menu items that are similar to given foodItem through fuzzy string
 * matching for the given day and meal.
 * Makes a call to the ASPC Menu API and constructs Frarold's response.
 *
 * @param {string} foodItem - Food item to search for.
 * @param {moment} date - Javascript moment object; used to match food
 *  item across dining halls for a specific day of the week.
 */
function getFoodItemsThatMatchAtDiningHall (foodItem, diningHall, date, meal) {
    return new Promise((resolve, reject) => {
        // Get three-letter abbreviation of the date.
        let day = getDayAbbrev(date);
        let path = buildSingleMealMenuHTTPPath(diningHall, day, meal);
        console.log('getFoodItemsThatMatchAtDiningHall: http get ' + path);

        https.get(path, (resp) => {

            // Collect chunks of the response.
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
                console.log(
                    'getFoodItemsThatMatchAtDiningHall: chunk received: ' + 
                    chunk
                );
            });

            // Response done.
            resp.on('end', () => {
                let output;
                let result = JSON.parse(data)[0];

                // No meal data at diningHall for given date and meal.
                if (!result) {
                    output = buildNoMealDataResponse(
                        diningHall,
                        date,
                        meal
                    )
                } else {
                    // Search through food_items.
                    let matchedFoodItems = matchFoodItems(
                        foodItem, 
                        result.food_items
                    );

                    // Found an item.
                    if (matchedFoodItems.length > 0) {
                        output = buildFoodItemsResponse (
                            matchedFoodItems,
                            diningHall,
                            date,
                            meal
                        )
                    } else {
                        output = buildFoodItemNotFoundResponse(
                            foodItem,
                            diningHall,
                            date,
                            meal
                        );
                    }
                }

                console.log(
                    'getFoodItemsThatMatchAtDiningHall: output: ' + output
                );
                resolve(output);
            });

        }).on('error', (error) => {
            console.log(
                'getFoodItemsThatMatchAtDiningHall: ERROR: ' + error.message
            );
            reject(error);
        });
    });
}

/**
 * Builds the HTTP GET path that fetches a given meal on a given day at a given
 * dining hall.
 *
 * @param {string} diningHall: Target dining hall. Valid options are 
 *  'frank', 'frary', 'cmc', 'scripps', 'pitzer', and 'oldenburg'.
 * @param {string} day: Target day of the week. Valid options are 
 *  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', or 'sun'.
 * @param {string} meal: Target meal: Valid options are 
 *  'breakfast', 'brunch', 'lunch', and 'dinner'.
 */
function buildSingleMealMenuHTTPPath (diningHall, day, meal) {
    // HTTP GET path.
    let path = aspcMenuEndpoint + diningHallPath + diningHall + '/' +
        dayPath + day + '/' + mealPath + meal + '/' +
        authTokenPath;
    return path
}

/**
 * Builds string response for a query for a single dining halls' 
 * menu on a certain day.
 *
 * @param {Array} foodItems - List of food items in menu.
 * @param {string} diningHall: Target dining hall. Valid options are 
 *  'frank', 'frary', 'cmc', 'scripps', 'pitzer', and 'oldenburg'.
 * @param {string} day: Target day of the week. Valid options are 
 *  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', or 'sun'.
 * @param {string} meal: Target meal: Valid options are 
 *  'breakfast', 'brunch', 'lunch', and 'dinner'.
 */
function buildFoodItemsResponse (foodItems, diningHall, date, meal) {
    let output = '';
    let day = prettifyDayName(date);
    let diningHallName = prettifyDiningHallName(diningHall);

    output += diningHallName + ' has ';

    // Add each food item to the output.
    for (let i in foodItems) {
        let item = foodItems[i];
        if (foodItems.length == 1) {
            output += item + ' ';
        } else if (i < foodItems.length - 1) {
            output += item + ', ';
        } else {
            output += 'and ' + item + ' ';
        }
    }
    output += 'for ' + meal + ' ' + day + '.';
    return output;
}

/**
 * Builds string response for when given foodItem is not found at given 
 * diningHall for the given meal and date.
 *
 * @param {string} foodItem - Food item that was not found.
 * @param {string} diningHall: Target dining hall. Valid options are 
 *  'frank', 'frary', 'cmc', 'scripps', 'pitzer', and 'oldenburg'.
 * @param {string} day: Target day of the week. Valid options are 
 *  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', or 'sun'.
 * @param {string} meal: Target meal: Valid options are 
 *  'breakfast', 'brunch', 'lunch', and 'dinner'.
 */
function buildFoodItemNotFoundResponse (foodItem, diningHall, date, meal) {
    let output = '';
    let day = prettifyDayName(date);
    let diningHallName = prettifyDiningHallName(diningHall);

    output += diningHallName + ' doesn\'t have ' + foodItem + ' for ' + 
        meal + ' ' + day + '.';
    return output;
}

/**
 * Builds a string response for when there is no meal data.
 *
 * @param {string} diningHall - Valid options are 'frank', 'frary', 'cmc', 
 *  'scripps', 'pitzer', and 'oldenburg'.
 * @param {moment} date - Javascript moment object; used to fetch meal
 *  for a specific day of the week.
 * @param {string} meal - Valid options are 'breakfast', 'brunch', 'lunch', and
 *  'dinner'.
 */
function buildNoMealDataResponse (diningHall, date, meal) {
    let day = prettifyDayName(date);
    let noMealDataOutput =
        'Hmm...that\'s weird. It looks like ' +
        prettifyDiningHallName(diningHall) +
        ' didn\'t post ' + meal + ' ' + day + '.';

    return noMealDataOutput;
}

/**
 * Builds Date obj from req.body.result.parameters.date if present, 
 * else returns today's Date obj.
 *
 * @param req - An http request that may or may not have
 *  req.body.result.parameters.date specified 
 *  (since the date entity is optional).
 */
function buildMoment (requestDate) {
    // Initialize to today's date.
    let date = new moment();
    console.log('REQUEST DATE: ' + requestDate);
    console.log('DEFAULT MOMENT: ' + date);

    // Date is an optional parameter. If present, update to reflect date in req.
    if (requestDate) {
        date = new moment(requestDate, dialogflowDateFormat)
        console.log('UPDATED MOMENT: ' + date)
    }

    return date;
}

/**
 * Returns a list of food items from foodItems list that match the
 * given foodItem. Uses the Fuse.js library to fuzzy match strings.
 *
 * @param {string} foodItem - Food item to be searched for.
 * @param {Array} foodItems - Array of string foodItems to be searched.
 */
function matchFoodItems (foodItem, foodItems) {
    let fuseList = [];
    let matchedItems = [];

    // Build Fuse array to be searched.
    for (let i in foodItems) {
        let menuItem = foodItems[i];
        fuseList.push({'name': JSON.stringify(menuItem)});
    }
    console.log("DEBUG FUSE LIST: " + fuseList);
    let fuse = new Fuse(fuseList, fuseOptions);
    let results;

    try {
        results = fuse.search(foodItem);
    } catch (error) {
        console.log("matchFoodItems: error: " + error);
        results = ' ';
    }

    console.log("DEBUG RESULTS: " + results);

    // Unpack results.
    for (let i in results) {
        matchedItems.push(results[i].name);
    }
    console.log("DEBUG MATCHEDITEMS: " + matchedItems);
    return matchedItems
}

/**
 * Converts Javascript moment object to a lowercase three-letter abbreviation of
 * the day of the week - 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', or 'sun'.
 *
 * @param {momilt in Javascript moment object from which day of the week
 *  will be extracted.
 */
function getDayAbbrev (date) {
    // Parse out three-letter abbreviation of day.
    return date.tz(timezone).format('ddd').toLowerCase();
}

/**
 * Converts Javascript moment object into pretty name. If date is today,
 * then uses 'today' rather than day of the week name.
 *
 * @param {moment} date - Moment object to convert.
 */
function prettifyDayName (date) {
    // Initialize outputDay to day of the week.
    let day = date.tz(timezone).format('dddd');
    return day;
}

/**
 * Converts Dialogflow Agent dining_hall entity names to prettier names.
 *
 * @param {String} string - Dining hall to be converted. Valid options are
 *  'frank', 'frary', 'cmc', 'scripps', 'pitzer', and 'oldenburg'.
 */
function prettifyDiningHallName (string) {
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

/*** LOCAL TESTS ***/
// let date = buildMoment('2017-12-19');
// let abb = getDayAbbrev(date);
// let pretty = prettifyDayName(date);
// console.log(date);
// console.log(abb);
// console.log(pretty);

