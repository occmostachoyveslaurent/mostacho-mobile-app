# VYBE / Yves Expo App — XAMPP + MySQL Edition

This version connects the Expo app to a PHP REST API running on XAMPP and a MySQL database. Posts, post photos, likes, and comments are stored by the backend instead of being saved only in AsyncStorage.

## Features connected to MySQL

- Load the feed from MySQL when the app opens.
- Create posts with photo uploads and captions.
- Edit existing posts and replace their photos.
- Delete posts from MySQL and remove uploaded photo files.
- Save likes and like counts in MySQL.
- Save comments in MySQL.
- Demo community posts are included in the SQL import so the feed is not empty on first run.

> This is a local-development backend. The sample app still uses a fixed demo username and does not include real account authentication. Do not expose this API publicly until authentication, authorization, rate limiting, and production security are added.

## Part 1 — Set up XAMPP

1. Install and open XAMPP.
2. Start **Apache** and **MySQL**.
3. Copy the entire `xampp/yves-api` folder from this project into your XAMPP `htdocs` folder. The final path should be:

   ```text
   C:\xampp\htdocs\yves-api\
   ```

   The folder should contain `config.php`, `posts.php`, `comments.php`, `likes.php`, `health.php`, and the `uploads` folder.

4. Open phpMyAdmin:

   ```text
   http://localhost/phpmyadmin
   ```

5. Select **Import**, choose `xampp/database.sql` from this project, and click **Import** / **Go**.
6. The SQL file creates the `yves_expo_db` database and its tables (`posts`, `post_comments`, and `post_likes`) and inserts three sample feed posts.

### Check the PHP-to-MySQL connection

Open this URL on the computer running XAMPP:

```text
http://localhost/yves-api/health.php
```

A successful response says that the PHP API and MySQL connection are working. If it fails, check that both Apache and MySQL are running and that the database was imported.

### MySQL credentials

The default settings are in `xampp/yves-api/config.php`:

```php
const DB_HOST = '127.0.0.1';
const DB_NAME = 'yves_expo_db';
const DB_USER = 'root';
const DB_PASS = '';
```

If your MySQL root account has a password or uses a different port/host, update these settings. The XAMPP default MySQL port is usually `3306`.

## Part 2 — Point the Expo app to your computer

Open:

```text
api/config.js
```

Change `API_BASE_URL` to the correct address for the device where the app is running.

### Choose the correct address

- **Physical Android/iPhone:** use your computer's local IPv4 address, for example `http://192.168.1.25/yves-api`.
- **Android Studio emulator:** use `http://10.0.2.2/yves-api`.
- **Expo web on the same computer:** use `http://localhost/yves-api`.

To find your computer's IPv4 address on Windows:

1. Open Command Prompt.
2. Run `ipconfig`.
3. Find the **IPv4 Address** under the Wi-Fi adapter currently connected to the same network as your phone.
4. Put that address in `api/config.js`, keeping `/yves-api` at the end.

Example:

```js
export const API_BASE_URL = "http://192.168.1.25/yves-api";
```

Your phone and computer must be connected to the same Wi-Fi network. If the phone cannot reach the API, allow Apache through Windows Firewall for private networks and confirm that this URL opens on the phone:

```text
http://YOUR-PC-IP/yves-api/health.php
```

Do not use `localhost` on a physical phone: it points to the phone itself, not your computer.

## Part 3 — Run the Expo app

From the project folder, run:

```bash
npm install
npx expo start -c
```

Open the project in the compatible Expo Go app and scan the QR code.

## Photo upload settings

The API accepts JPG, PNG, and WEBP images up to 10 MB. If uploads fail because of PHP limits, open XAMPP Control Panel → Apache → Config → `php.ini`, then check/set:

```ini
file_uploads=On
upload_max_filesize=10M
post_max_size=12M
```

Save the file and restart Apache. Make sure `xampp/yves-api/uploads` is writable by Apache.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `posts.php?user=yves.mostacho` | Load feed posts and comments |
| POST | `posts.php` | Create a post (multipart form with photo) |
| POST | `posts.php` with `id` | Edit a post; photo is optional if unchanged |
| DELETE | `posts.php?id=POST_ID&user=yves.mostacho` | Delete your post and its uploaded photo |
| POST | `likes.php` | Toggle a like and update the MySQL count |
| POST | `comments.php` | Add a comment |
| GET | `health.php` | Check PHP API and MySQL connection |

## Important notes

- Expo does **not** connect directly to MySQL. It sends HTTP requests to the PHP API; PHP safely queries MySQL using PDO prepared statements.
- Post photos selected from the phone are uploaded to `xampp/yves-api/uploads`, while their paths are stored in MySQL.
- Deleting a post also deletes its related comments and likes through MySQL foreign keys.
- The fixed demo username is `yves.mostacho` in `App.js`. A production app should replace this with a real login and server-verified user identity.
- For deployment outside your local network, use HTTPS and add authentication and authorization before making the API publicly accessible.
