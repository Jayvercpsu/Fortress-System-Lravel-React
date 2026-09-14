<?php

namespace App\Http\Middleware;

use App\Services\ProjectManagerApiTokenService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ProjectManagerApiTokenAuth
{
    public function __construct(
        private readonly ProjectManagerApiTokenService $tokens
    ) {
    }

    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user = $this->tokens->resolve($token);

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $request->setUserResolver(fn () => $user);

        // Services reused from the web pages read auth()->user()
        // (session guard), which stays null on stateless token requests.
        // Populate the guard so token requests behave like web sessions.
        Auth::setUser($user);

        return $next($request);
    }
}
