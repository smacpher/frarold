cd .. &&\
gcloud beta functions deploy\
    fraroldWebhook\
    --stage-bucket staging.frarold-56a8d.appspot.com\
    --trigger-http &&\
cd scripts
