<?php

namespace App\Http\Middleware;

use Closure;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        $user = Auth::user();

        if (!$user || !in_array($user->role, $roles)) {
            // The master admin outranks every role and inherits head_admin access.
            if ($user && $user->role === User::ROLE_MASTER_ADMIN && in_array(User::ROLE_HEAD_ADMIN, $roles, true)) {
                return $next($request);
            }

            abort(403);
        }

        return $next($request);
    }
}