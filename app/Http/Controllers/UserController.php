<?php
namespace App\Http\Controllers;

use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Models\User;
use App\Services\UserService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class UserController extends Controller
{
    public function __construct(
        private readonly UserService $userService
    ) {
    }

    public function index(Request $request)
    {
        return Inertia::render('HeadAdmin/Users/Index', [
            ...$this->userService->indexPayload($request),
        ]);
    }

    public function create(Request $request)
    {
        return Inertia::render('HeadAdmin/Users/Create', [
            'user' => $this->userService->userFormPayload(new User()),
            'canManageHeadAdmins' => $this->canManageHeadAdmins($request),
        ]);
    }

    public function edit(Request $request, User $user)
    {
        $this->assertUserManageable($request, $user);

        $loadedUser = $this->userService->loadUserForEdit($user);

        return Inertia::render('HeadAdmin/Users/Edit', [
            'user' => $this->userService->userFormPayload($loadedUser),
            'canManageHeadAdmins' => $this->canManageHeadAdmins($request),
        ]);
    }

    public function store(StoreUserRequest $request)
    {
        $this->userService->createUser($request->validated());

        return redirect()->route('users.index')->with('success', __('messages.users.created'));
    }

    public function update(UpdateUserRequest $request, User $user)
    {
        $this->assertUserManageable($request, $user);

        $this->userService->updateUser($user, $request->validated());

        return redirect()
            ->route('users.index', $this->userService->tableQueryParams($request))
            ->with('success', __('messages.users.updated'));
    }

    public function destroy(Request $request, User $user)
    {
        $this->assertUserManageable($request, $user);

        $this->userService->deleteUser($user);

        return redirect()
            ->route('users.index', $this->userService->tableQueryParams($request))
            ->with('success', __('messages.users.deleted'));
    }

    private function canManageHeadAdmins(Request $request): bool
    {
        return $request->user()?->role === User::ROLE_MASTER_ADMIN;
    }

    private function assertUserManageable(Request $request, User $target): void
    {
        // Master admins are never editable or deletable by anyone.
        if ($target->role === User::ROLE_MASTER_ADMIN) {
            abort(403);
        }

        // Clients are managed from the Clients page, not here.
        if ($target->role === User::ROLE_CLIENT) {
            abort(403);
        }

        // Only the master admin can manage head admin accounts.
        if ($target->role === User::ROLE_HEAD_ADMIN && !$this->canManageHeadAdmins($request)) {
            abort(403);
        }
    }
}
