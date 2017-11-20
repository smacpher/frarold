py-cloud-fn $FUNC_NAME http -p -f function.py && \
cd cloudfn/target && gcloud beta functions deploy $FUNC_NAME \
--trigger-http --stage-bucket frarold-45ae9.appspot.com --memory 2048MB && cd ../..
