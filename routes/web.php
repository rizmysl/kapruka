<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\GiftConciergeController; // Make sure this is imported!

Route::get('/', function () {
    return view('welcome');
});

// Your new AI Chat endpoint
Route::post('/chat/message', [GiftConciergeController::class, 'chat']);