FROM php:8.2-cli
WORKDIR /app
COPY webhook.php /app/webhook.php
EXPOSE 8080
CMD ["php", "-S", "0.0.0.0:8080", "webhook.php"]
