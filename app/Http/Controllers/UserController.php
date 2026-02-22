<?php
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
        return Inertia::render('HeadAdmin/Users/Create', [
            'user' => $this->userFormPayload(new User()),
        ]);
    }

    public function edit(User $user) {
        if ($user->role === 'head_admin') abort(403);

        $user->load('detail');

        return Inertia::render('HeadAdmin/Users/Edit', [
            'user' => $this->userFormPayload($user),
        ]);
    }

    public function store(Request $request) {
        $validated = $request->validate($this->userRules());

        $user = User::create([
            'fullname' => $validated['fullname'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
        ]);

        $user->detail()->create($this->detailPayloadFromValidated($validated));

        return redirect()->route('users.index')->with('success', 'User created successfully.');
    }

    public function update(Request $request, User $user) {
        if ($user->role === 'head_admin') abort(403);

        $validated = $request->validate($this->userRules($user));

        $user->fullname = $validated['fullname'];
        $user->email = $validated['email'];
        $user->role = $validated['role'];

        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();
        $user->detail()->updateOrCreate(
            ['user_id' => $user->id],
            $this->detailPayloadFromValidated($validated)
        );

        $query = array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');

        return redirect()->route('users.index', $query)->with('success', 'User updated.');
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

    private function userRules(?User $user = null): array {
        return [
            'fullname' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . ($user?->id ?? 'NULL'),
            'password' => $user ? 'nullable|string|min:6' : 'required|string|min:6',
            'role' => 'required|in:admin,hr,foreman',
            'birth_date' => [
                'nullable',
                'date',
                'before_or_equal:today',
                function ($attribute, $value, $fail) {
                    if (blank($value)) {
                        return;
                    }

                    try {
                        $age = Carbon::parse($value)->age;
                    } catch (\Throwable $e) {
                        return;
                    }

                    if ($age <= 18) {
                        $fail('The user must be older than 18 years old.');
                    }
                },
            ],
            'place_of_birth' => 'nullable|string|max:255',
            'sex' => 'nullable|in:male,female,other',
            'civil_status' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:500',
        ];
    }

    private function detailPayloadFromValidated(array $validated): array {
        $birthDate = !empty($validated['birth_date']) ? Carbon::parse($validated['birth_date']) : null;

        return [
            'age' => $birthDate?->age,
            'birth_date' => $birthDate?->toDateString(),
            'place_of_birth' => $validated['place_of_birth'] ?? null,
            'sex' => $validated['sex'] ?? null,
            'civil_status' => $validated['civil_status'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'address' => $validated['address'] ?? null,
        ];
    }

    private function userFormPayload(User $user): array {
        $detail = $user->exists ? ($user->relationLoaded('detail') ? $user->detail : $user->detail) : null;
        $birthDate = $detail?->birth_date;
        $computedAge = $birthDate ? Carbon::parse($birthDate)->age : null;

        return [
            'id' => $user->id,
            'fullname' => $user->fullname ?? '',
            'email' => $user->email ?? '',
            'role' => $user->role ?? 'foreman',
            'age' => $computedAge,
            'birth_date' => optional($birthDate)->toDateString(),
            'place_of_birth' => $detail?->place_of_birth ?? '',
            'sex' => $detail?->sex ?? '',
            'civil_status' => $detail?->civil_status ?? '',
            'phone' => $detail?->phone ?? '',
            'address' => $detail?->address ?? '',
        ];
    }
}
