/*** 
 * Frarold Cloud Functions.
 *  By Sean MacPherson.
 ***/

'use strict';
const https = require('https');
const Fuse = require('fuse.js');

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
    'oldenburg'];

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
    let meal = req.body.result.parameters.meal;
    let dateObj = buildDateObj(req);

    getFoodItemsThatMatchAtAllDiningHalls(food_item, 
                                          dateObj, 
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
 * @param {Date} dateObj - Built in Javascript Date object; used to fetch meal
 *  for a specific day of the week.
 * @param {string} meal - Valid options are 'breakfast', 'brunch', 'lunch', and
 *  'dinner'.
 */
function getSingleMealMenu (diningHall, dateObj, meal) {
    return new Promise((resolve, reject) => {
        // Get three-letter abbreviation of the date.
        let dayAbbrev = getDayAbbrevFromDateObj(dateObj);
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
                        dateObj, 
                        meal
                    );
                } else {
                    output = buildFoodItemsResponse (
                        result.food_items,
                        diningHall, 
                        dateObj, 
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
 * @param {Date} dateObj - Built in Javascript Date object; used to match food
 *  item across dining halls for a specific day of the week.
 */
function getFoodItemsThatMatchAtAllDiningHalls (foodItem, 
                                                dateObj, 
                                                meal) {
    let promises = [];
    for (let i in diningHalls) {
        promises.push(
            getFoodItemsThatMatchAtDiningHall(
                foodItem, 
                diningHalls[i], 
                dateObj, 
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
 * @param {Date} dateObj - Built in Javascript Date object; used to match food
 *  item across dining halls for a specific day of the week.
 */
function getFoodItemsThatMatchAtDiningHall (foodItem, diningHall, dateObj, meal) {
    return new Promise((resolve, reject) => {
        // Get three-letter abbreviation of the date.
        let day = getDayAbbrevFromDateObj(dateObj);
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
                        dateObj,
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
                            dateObj,
                            meal
                        )
                    } else {
                        output = buildFoodItemNotFoundResponse(
                            foodItem,
                            diningHall,
                            dateObj,
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
function buildFoodItemsResponse (foodItems, diningHall, dateObj, meal) {
    let output = '';
    let day = prettifyDayName(dateObj);
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
function buildFoodItemNotFoundResponse (foodItem, diningHall, dateObj, meal) {
    let output = '';
    let day = prettifyDayName(dateObj);
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
 * @param {Date} dateObj - Built in Javascript Date object; used to fetch meal
 *  for a specific day of the week.
 * @param {string} meal - Valid options are 'breakfast', 'brunch', 'lunch', and
 *  'dinner'.
 */
function buildNoMealDataResponse (diningHall, dateObj, meal) {
    let day = prettifyDayName(dateObj);
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
 * Returns a list of food items from foodItems list that match the
 * given foodItem. Uses the Fuse.js library to fuzzy match strings.
 *
 * @param {string} foodItem - Food item to be searched for.
 * @param {Array} foodItems - Array of string foodItems to be searched.
 */
function matchFoodItems (foodItem, foodItems) {
    let fuseList = [];
    let matchedItems = [];
    let fuseOptions = {
        tokenize: true,
        matchAllTokens: true,
        shouldSort: true,
        threshold: 0.3,
        location: 0,
        distance: 25,
        maxPatternLength: 25,
        minMatchCharLength: 1,
        keys: ['name']
    };

    // Build Fuse array to be searched.
    for (let i in foodItems) {
        let menuItem = foodItems[i];
        fuseList.push({name: menuItem});
    }

    let fuse = new Fuse(fuseList, fuseOptions);
    let results = fuse.search(foodItem);
    
    // Unpack results.
    for (let i in results) {
        matchedItems.push(results[i].name);
    }

    return matchedItems
}

/**
 * Converts Javascript Date object to a lowercase three-letter abbreviation of
 * the day of the week - 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', or 'sun'.
 *
 * @param {Date} - Built in Javascript Date object from which day of the week
 *  will be extracted.
 */
function getDayAbbrevFromDateObj (dateObj) {
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
function getDayFromDateObj (dateObj) {
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
 * Converts Javascript Date object into pretty name. If dateObj is today,
 * then uses 'today' rather than day of the week name.
 *
 * @param {Date} dateObj - Date object to convert.
 */
function prettifyDayName (dateObj) {
    // Initialize outputDay to day of the week.
    let day = getDayFromDateObj(dateObj);

    // If dateObj is today, use "today" instead.
    if (new Date().getDay() == dateObj.getDay()) {
        day = 'today';
    }

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
// getSingleMealMenu('frary', new Date(), 'lunch');
// getFoodItemsThatMatchAtDiningHall('smores', 'frary', new Date(), 'lunch');
// let foodArray = ["Cinnamon Toast Cereal Bars","Smores Bar","Vegetable Spring Rolls with dipping Sauce","Asian Kale","Stir Fry Veg","Jasmine Rice","Asian Black Pepper Beef"]
// console.log(matchFoodItems('smores', foodArray));
// console.log(getFoodItemsThatMatchAtAllDiningHalls('chicken', new Date('11-22-2017'), 'lunch'));

