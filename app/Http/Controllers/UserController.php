<?php
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class UserController extends Controller {
    public function index(Request $request) {
        $allowedPerPage = [5, 10, 25, 50];
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);

        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $query = User::query()->where('role', '!=', 'head_admin');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('fullname', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('role', 'like', "%{$search}%");
            });
        }

        $paginator = $query
            ->latest()
            ->paginate($perPage)
            ->withQueryString();

        $users = collect($paginator->items())->map(fn (User $user) => [
            'id' => $user->id,
            'fullname' => $user->fullname,
            'email' => $user->email,
            'role' => $user->role,
            'created_at' => optional($user->created_at)?->toDateTimeString(),
        ])->values();

        return Inertia::render('HeadAdmin/Users/Index', [
            'users' => $users,
            'userTable' => [
                'search' => $search,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
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

    public function destroy(Request $request, User $user) {
        if ($user->role === 'head_admin') abort(403);
        $user->delete();

        $query = array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');

        return redirect()->route('users.index', $query)->with('success', 'User deleted.');
    }
}
