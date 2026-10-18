FROM postgres:18-bookworm
USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-boto3 python3-cryptography python3-psycopg2 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backup.py test_backup.py /app/
RUN python3 -m unittest test_backup.py
COPY recover.py /app/recover.py
USER postgres
ENTRYPOINT []
CMD ["python3", "/app/backup.py"]
