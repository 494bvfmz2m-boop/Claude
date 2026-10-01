<?php
logout_user();
session_start();
flash('You are signed out.');
redirect('?p=home');
