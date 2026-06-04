<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Enable CORS globally
        $middleware->use([
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);
        
        // Add this block to allow React to POST without a CSRF token
        $middleware->validateCsrfTokens(except: [
            'chat/message',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();