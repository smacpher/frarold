gcloud beta functions call fraroldWebhook \
    --data \
'{
    "result": {
        "parameters": {
            "food_item": "chicken",
            "meal": "lunch"
        },
        "metadata": {
            "intentName": "food_search"
        }
    }
}'
