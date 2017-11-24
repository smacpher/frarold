gcloud beta functions call fraroldWebhook \
    --data \
'{
    "result": {
        "parameters": {
            "food_item": "chicken",
            "meal": "lunch",
            "date": "2017-11-21"
        },
        "metadata": {
            "intentName": "food_search"
        }
    }
}'
