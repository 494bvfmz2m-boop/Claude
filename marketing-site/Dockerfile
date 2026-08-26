# Static site, no build step -- just nginx serving the files with the same
# clean-URL behavior as the .htaccess rules on the real (Apache) host.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
