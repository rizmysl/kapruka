<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConciergeLog extends Model
{
    protected $fillable = [
        'session_id',
        'user_message',
        'tool_called',
        'search_query',
        'ai_response',
    ];
}
