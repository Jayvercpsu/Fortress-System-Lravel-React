<?php
namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Inertia\Inertia;

class AuthController extends Controller {
    private const LOGIN_MAX_ATTEMPTS = 5;
    private const LOGIN_DECAY_SECONDS = 60;

    public function showLogin() {
        if (Auth::check()) {
            return $this->redirectByRole(Auth::user()->role);
        }
        return Inertia::render('Auth/Login');
    }

    public function showClientLogin() {
        if (Auth::check()) {
            return $this->redirectByRole(Auth::user()->role);
        }

        return Inertia::render('Auth/ClientLogin');
    }

    public function login(Request $request) {
        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $throttleKey = $this->throttleKey($request, 'email', 'login');
        if (RateLimiter::tooManyAttempts($throttleKey, self::LOGIN_MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return back()->withErrors([
                'email' => __('Too many login attempts. Please try again in :seconds seconds.', ['seconds' => $seconds]),
            ])->with('cooldown', $seconds)->with('cooldown_for', Str::lower((string) $request->input('email')));
        }

        if (!Auth::attempt($credentials)) {
            RateLimiter::hit($throttleKey, self::LOGIN_DECAY_SECONDS);
            return back()->withErrors(['email' => __('messages.auth.invalid_credentials')]);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->regenerate();
        return $this->redirectByRole(Auth::user()->role);
    }

    public function clientLogin(Request $request) {
        $credentials = $request->validate([
            'username' => 'required|string',
            'password' => 'required',
        ]);

        $throttleKey = $this->throttleKey($request, 'username', 'client_login');
        if (RateLimiter::tooManyAttempts($throttleKey, self::LOGIN_MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return back()->withErrors([
                'username' => __('Too many login attempts. Please try again in :seconds seconds.', ['seconds' => $seconds]),
            ])->with('cooldown', $seconds)->with('cooldown_for', Str::lower((string) $request->input('username')));
        }

        if (!Auth::attempt([
            'username' => $credentials['username'],
            'password' => $credentials['password'],
            'role' => User::ROLE_CLIENT,
        ])) {
            RateLimiter::hit($throttleKey, self::LOGIN_DECAY_SECONDS);
            return back()->withErrors(['username' => __('messages.auth.invalid_client_credentials')]);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->regenerate();

        return $this->redirectByRole(Auth::user()->role);
    }

    public function logout(Request $request) {
        $role = Auth::user()?->role;
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($role === User::ROLE_CLIENT) {
            return redirect()->route('client.login');
        }

        return redirect()->route('login');
    }

    private function redirectByRole(string $role) {
        return match($role) {
            User::ROLE_HEAD_ADMIN => redirect()->route('head_admin.dashboard'),
            User::ROLE_ADMIN      => redirect()->route('admin.dashboard'),
            User::ROLE_HR         => redirect()->route('hr.dashboard'),
            User::ROLE_FOREMAN    => redirect()->route('foreman.dashboard'),
            User::ROLE_CLIENT     => redirect()->route('client.dashboard'),
            User::ROLE_DESIGNER   => redirect()->route('designer.dashboard'),
            default      => redirect()->route('login'),
        };
    }

    private function throttleKey(Request $request, string $field, string $prefix): string {
        $value = Str::lower((string) $request->input($field));
        return $prefix . '|' . $value . '|' . $request->ip();
    }
}
