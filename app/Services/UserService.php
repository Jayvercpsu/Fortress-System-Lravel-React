<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

class UserService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly UserRepositoryInterface $userRepository
    ) {
    }

    public function indexPayload(Request $request): array
    {
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);

        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 10;
        }

        $paginator = $this->userRepository->paginateForManagement($search, $perPage);

        $users = collect($paginator->items())->map(fn (User $user) => [
            'id' => $user->id,
            'fullname' => $user->fullname,
            'email' => $user->email,
            'role' => $user->role,
            'created_at' => optional($user->created_at)?->toDateTimeString(),
        ])->values();

        return [
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
        ];
    }

    public function createUser(array $validated): void
    {
        $user = $this->userRepository->createUser([
            'fullname' => $validated['fullname'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
        ]);

        $this->userRepository->upsertDetail($user, $this->detailPayloadFromValidated($validated));
    }

    public function updateUser(User $user, array $validated): void
    {
        $payload = [
            'fullname' => $validated['fullname'],
            'email' => $validated['email'],
            'role' => $validated['role'],
        ];

        if (!empty($validated['password'])) {
            $payload['password'] = Hash::make($validated['password']);
        }

        $this->userRepository->updateUser($user, $payload);
        $this->userRepository->upsertDetail($user, $this->detailPayloadFromValidated($validated));
    }

    public function deleteUser(User $user): void
    {
        $this->userRepository->deleteUser($user);
    }

    public function loadUserForEdit(User $user): User
    {
        return $this->userRepository->loadDetail($user);
    }

    public function userFormPayload(User $user): array
    {
        $detail = $user->exists ? $user->detail : null;
        $birthDate = $detail?->birth_date;
        $computedAge = $birthDate ? Carbon::parse($birthDate)->age : null;

        return [
            'id' => $user->id,
            'fullname' => $user->fullname ?? '',
            'email' => $user->email ?? '',
            'role' => $user->role ?? User::ROLE_FOREMAN,
            'age' => $computedAge,
            'birth_date' => optional($birthDate)->toDateString(),
            'place_of_birth' => $detail?->place_of_birth ?? '',
            'sex' => $detail?->sex ?? '',
            'civil_status' => $detail?->civil_status ?? '',
            'phone' => $detail?->phone ?? '',
            'address' => $detail?->address ?? '',
        ];
    }

    public function tableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function detailPayloadFromValidated(array $validated): array
    {
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
}
