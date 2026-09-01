FROM php:8.2-alpine

# Install dependencies and build the IMAP extension on Alpine
RUN apk add --no-cache \
    imap-dev \
    openssl-dev \
    c-client \
    && docker-php-ext-configure imap --with-imap --with-imap-ssl \
    && docker-php-ext-install imap

WORKDIR /app
COPY check_mail.php /app/check_mail.php

# Run the script in an infinite loop every 5 minutes (300 seconds)
CMD ["sh", "-c", "while true; do php /app/check_mail.php; sleep 300; done"]
