<?php
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class UserController extends Controller {
    public function index() {
        $users = User::where('role', '!=', 'head_admin')->latest()->get();
        return Inertia::render('HeadAdmin/Users/Index', compact('users'));
    }

    public function create() {
        return Inertia::render('HeadAdmin/Users/Create');
    }

    public function store(Request $request) {
        $request->validate([
            'fullname' => 'required|string|max:255',
            'email'    => 'required|email|unique:users',
            'password' => 'required|min:6',
            'role'     => 'required|in:admin,hr,foreman',
        ]);

        User::create([
            'fullname' => $request->fullname,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'role'     => $request->role,
        ]);

        return redirect()->route('users.index')->with('success', 'User created successfully.');
    }

    public function destroy(User $user) {
        if ($user->role === 'head_admin') abort(403);
        $user->delete();
        return redirect()->route('users.index')->with('success', 'User deleted.');
    }
}