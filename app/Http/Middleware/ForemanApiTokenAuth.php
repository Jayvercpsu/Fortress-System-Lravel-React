<?php

namespace App\Http\Middleware;

use App\Services\ForemanApiTokenService;
use Closure;
use Illuminate\Http\Request;

class ForemanApiTokenAuth
{
    public function __construct(
        private readonly ForemanApiTokenService $tokens
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

        return $next($request);
    }
}
