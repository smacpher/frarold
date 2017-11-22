import json
import os
import sys
import uuid

import apiai

# Dialogflow client access token.
CLIENT_ACCESS_TOKEN = '26e55f8305c6478cb56b6cc8f4fb1e45'

# ASCII art thanks to larryd3 font at http://www.messletters.com/en/big-text/.
FRAROLD_INTRO_STRING ="""
   ___                                   ___        __     
 /'___\                                 /\_ \      /\ \    
/\ \__/  _ __     __      _ __    ___   \//\ \     \_\ \   
\ \ ,__\/\`'__\ /'__`\   /\`'__\ / __`\   \ \ \    /'_` \  
 \ \ \_/\ \ \/ /\ \L\.\_ \ \ \/ /\ \L\ \   \_\ \_ /\ \L\ \ 
  \ \_\  \ \_\ \ \__/.\_\ \ \_\ \ \____/   /\____\\\ \___,_\\
   \/_/   \/_/  \/__/\/_/  \/_/  \/___/    \/____/ \/__,_ /
                                                           
"""

def main():
    """Main routine.
    """
    # Initilize Frarold.
    ai = apiai.ApiAI(CLIENT_ACCESS_TOKEN)

    print(FRAROLD_INTRO_STRING)

    # Dialog loop.
    while True:
        # Format request.
        request = ai.text_request()
        request.lang = 'en'
        request.session_id = create_session_id()

        # Get user query.
        sys.stdout.write('You: ')
        userInput = raw_input()

        # Check to see if user wants to exit.
        if isExitCmd(userInput):
            break

        # Make request to Frarold Dialogflow Agent.
        request.query = userInput
        jsonResponse = request.getresponse()
        response = json.loads(jsonResponse.read())
        print('\n')

        # Output Frarold's response to stdout.
        sys.stdout.write('Frarold: ')
        print(response[u'result'][u'fulfillment'][u'speech'])
        print('\n')

    bye()

def create_session_id():
    """Creates a unique session_id for Dialogflow API call.
    """
    return str(uuid.uuid4())

def isExitCmd(userInput):
    """Returns True if userInput is an exit command and False otherwise.
    """
    if (userInput == 'exit()' or userInput == 'quit()' or
        userInput == 'exit' or userInput == 'quit' or 
        userInput.lower() == 'bye'):
        return True
    return False

def bye():
    print('\n')
    print('Good talk.')

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        bye()
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)

