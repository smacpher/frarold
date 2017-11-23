gcloud beta functions call fraroldWebhook \
    --data \
'{
    "result": {
        "parameters": {
            "dining_hall": "frary", 
            "meal": "lunch"
        },
        "metadata": {
            "intentName": "food_list"
        }
    }
}'
