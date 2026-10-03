# Special Love 3D Print Shop

A complete PHP + MySQL webshop. Drag, drop, extract, open the website — that's it.
No Node.js, no build step, no Composer.

## Requirements

- PHP 8.0 or newer (PDO MySQL, cURL — both standard on cPanel / LiteSpeed hosting)
- A MySQL or MariaDB database

## Install (5 minutes)

1. Upload this ZIP to your hosting and extract it in `public_html` (or a subfolder).
2. In your hosting panel, create a MySQL database and a user, and give that user
   full access to the database. Note the database name, user and password.
3. Open `https://yourshop.com/install.php` in your browser.
4. Fill in the database details, your owner email and password, and your website
   address. Press Install.
5. **Delete `install.php`** from the server.
6. Sign in at `https://yourshop.com/?p=login` and turn on two-step verification
   under Account → Security.

## Folder permissions

`uploads/` must be writable by the web server (usually 755).
The installer writes `config.php` into the site root, so that folder must be
writable during install. You can set it back to read-only afterwards.

## Turning on card payments

1. Sign in as owner → Admin → Payments.
2. Paste your Stripe secret key (test first) and switch "Take card payments" on.
3. Press "Test Stripe connection" to confirm the key works.
4. In Stripe, add a webhook pointing at `https://yourshop.com/webhook.php`
   listening for `checkout.session.completed`, then paste the signing secret
   into the Payments tab.
5. Switch Mode to Live when you're ready to take real money.

Stripe keys live in your own database. Card details never touch your server.

## What's in here

- Storefront: home, best sellers, new products, categories, shop search/filter/sort,
  product pages, cart and worldwide checkout
- Orders: reference numbers, status tracking, confirmation page, tracking numbers
- Custom print requests with model upload (STL/STEP/3MF/OBJ/ZIP up to 100 MB)
- Customer accounts with order history, password change and two-step verification
- Admin: Orders, Products (with photo upload), Print requests, Store settings,
  Payments, Team access
- Admin product controls: categories, descriptions, dimensions, colours, best seller/new
  status and labels such as Popular or Handmade For Sale
- Admin announcement control: show or hide the top bar and change its wording
- Team access: owners can add staff or owner accounts; the last owner is protected

## Everything is stored in your database

Products, orders, customers, requests, settings and admin accounts all live in
your MySQL database. Uploaded model files and product photos are saved in
`uploads/`. Back up both.

## Security notes

- Passwords are hashed (bcrypt). Two-step verification uses standard TOTP apps.
- All forms are protected against cross-site request forgery.
- Sign-in attempts are rate limited.
- `uploads/` is blocked from running PHP, and `config.php` is blocked from the web.
- Always run the shop over HTTPS.

## Files

```
index.php          front controller
install.php        one-time setup (delete after installing)
webhook.php        Stripe webhook receiver
config.php         created by the installer - your database details
inc/               shared code (database, auth, TOTP, Stripe, layout)
pages/             every page of the site
assets/            stylesheet, script, logo, hero image
uploads/           product photos and customer model files
```
