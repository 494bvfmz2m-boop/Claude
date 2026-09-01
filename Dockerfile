FROM php:8.2-alpine

# Install dependencies and build the IMAP extension on Alpine
RUN apk add --no-cache \
    imap-dev \
    openssl-dev \
    c-client \
    oniguruma-dev \
    && docker-php-ext-configure imap --with-imap --with-imap-ssl \
    && docker-php-ext-install imap mbstring

WORKDIR /app
COPY check_mail.php /app/check_mail.php

# check_mail.php processes one batch of unread mail and exits. Coolify
# deploys this as a long-running service, so the container's main process
# has to keep running -- loop the check here instead of letting it exit,
# which was making Coolify restart the container over and over.
CMD ["sh", "-c", "while true; do php /app/check_mail.php; sleep 300; done"]
