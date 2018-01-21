# Frarold
Ask me about food at the 5C's.

## Talk to me!
So far, you can only talk to me through the command line or through a beta
website provided by Dialogflow: https://bot.dialogflow.com/de1a8ac2-6762-4d5f-ad6b-d4d87a612eef

First, take a look at the Dependencies section below to install
everything that helps me run properly.

Once you're done with that, open Terminal and use the following command:
`python frarold/python_client.py`

### Example queries
Here are some example queries to get you started; essentially, you can
ask about any meal (breakfast, lunch, or dinner) for any day of the week
at any dining hall on campus (Frank, Frary, Collins, Scripps, Oldenburg,
Pitzer, Mudd). Also, don't worry about the phrasing or the names you choose
to use, Frarold can understand pretty much any format!

_Examples_:
- "What's for lunch at CMC tomorrow?"
- "What's oldy having for lunch today?"
- "Pitzer dinner?" (Frarold will assume you want to know about today's meals
if no meal is specified)
- "Who is serving chicken for lunch today?"

## Dependencies
To use the Python CLI Client, you will need to install the
Dialogflow Python SDK here: 
https://github.com/dialogflow/dialogflow-python-client

To interact with the Google Cloud Functions that power Frarold directly
(to use any shell scripts in the scripts/ directory),
you will need to install the Google Cloud SDK found here:
https://cloud.google.com/sdk/downloads

## Acknowledgements
- ASPC Menu API: https://aspc.pomona.edu/api/
- Dialogflow: https://dialogflow.com/

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
