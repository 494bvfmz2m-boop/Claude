<?php
logout_user();
session_start();
flash('Je bent uitgelogd.');
redirect('?p=home');
