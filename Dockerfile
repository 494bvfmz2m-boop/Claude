FROM php:8.2-cli

# Install dependencies required for PHP IMAP extension on modern Debian
RUN apt-get update && apt-get install -y \
    libc-client-dev \
    libkrb5-dev \
    libssl-dev \
    && docker-php-ext-configure imap --with-kerberos --with-imap-ssl \
    && docker-php-ext-install imap

WORKDIR /app
COPY check_mail.php /app/check_mail.php

CMD ["php", "/app/check_mail.php"]
