<?php
namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AuthController extends Controller {
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

        if (!Auth::attempt($credentials)) {
            return back()->withErrors(['email' => __('messages.auth.invalid_credentials')]);
        }

        $request->session()->regenerate();
        return $this->redirectByRole(Auth::user()->role);
    }

    public function clientLogin(Request $request) {
        $credentials = $request->validate([
            'username' => 'required|string',
            'password' => 'required',
        ]);

        if (!Auth::attempt([
            'username' => $credentials['username'],
            'password' => $credentials['password'],
            'role' => User::ROLE_CLIENT,
        ])) {
            return back()->withErrors(['username' => __('messages.auth.invalid_client_credentials')]);
        }

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
            default      => redirect()->route('login'),
        };
    }
}
