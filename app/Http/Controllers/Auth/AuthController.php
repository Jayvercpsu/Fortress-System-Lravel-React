<?php
namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
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

    public function login(Request $request) {
        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($credentials)) {
            return back()->withErrors(['email' => 'Invalid credentials.']);
        }

        $request->session()->regenerate();
        return $this->redirectByRole(Auth::user()->role);
    }

    public function logout(Request $request) {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('login');
    }

    private function redirectByRole(string $role) {
        return match($role) {
            'head_admin' => redirect()->route('head_admin.dashboard'),
            'admin'      => redirect()->route('admin.dashboard'),
            'hr'         => redirect()->route('hr.dashboard'),
            'foreman'    => redirect()->route('foreman.dashboard'),
            default      => redirect()->route('login'),
        };
    }
}